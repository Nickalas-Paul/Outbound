/**
 * Route classified inbound email to autonomous response or escalation.
 */

import { pool } from '../../config/database';
import { scheduleExecuteBookings } from '../booking/executor';
import { scheduleComposeItinerary } from '../composition';
import { sendEmail } from '../email';
import {
  isItineraryContent,
  type ItineraryContent,
} from '../itinerary-types';
import {
  composeWithSonnet,
  LLM_UNAVAILABLE_PREFIX,
} from '../llm/bedrock';
import {
  getTripCorrespondence,
  updateCorrespondence,
  type CorrespondenceRecord,
} from './store';

const CONCIERGE_SYSTEM = `You are a personal travel concierge named Nico. You have lived in Korea, Spain, Argentina, and Mexico, and bring firsthand international experience to every trip you plan. Respond warmly, concisely, and professionally. Use first person. Never mention AI, automation, or algorithms. You are a real person helping a client with their trip.`;

const CONFIDENCE_THRESHOLD = 0.7;

type TripContext = {
  id: string;
  status: string;
  service_tier: string;
  destinations: Array<{ iso?: string; name?: string }> | null;
  travel_dates: { start?: string; end?: string } | null;
  group_size: number;
  notes: string | null;
  client_name: string;
  client_email: string;
};

function stripReplyDraft(raw: string): string {
  let text = raw.trim();
  if (text.startsWith(LLM_UNAVAILABLE_PREFIX)) {
    return "Thanks for writing — I'm looking into this and will get back to you shortly.";
  }
  const fence = text.match(/^```(?:\w+)?\s*([\s\S]*?)```\s*$/);
  if (fence) text = fence[1].trim();
  return text;
}

function condenseItinerary(content: ItineraryContent | null): string {
  if (!content) return '(no itinerary on file yet)';
  const days = (content.days ?? [])
    .slice(0, 8)
    .map(
      (d) =>
        `Day ${d.dayNumber}: ${d.location} — ${d.theme}; stay: ${d.accommodation?.name ?? 'n/a'}`
    )
    .join('\n');
  return [
    `Title: ${content.title}`,
    `Summary: ${content.summary}`,
    `Destinations: ${(content.destinations ?? []).join(', ')}`,
    `Days:\n${days}`,
  ].join('\n');
}

function formatHistory(history: CorrespondenceRecord[]): string {
  return history
    .slice(0, 5)
    .reverse()
    .map((m) => {
      const who = m.direction === 'inbound' ? 'Client' : 'Nico';
      return `${who}: ${(m.body_text ?? '').slice(0, 400)}`;
    })
    .join('\n\n');
}

async function loadTripContext(tripId: string): Promise<TripContext | null> {
  const result = await pool.query<TripContext>(
    `
    SELECT
      t.id, t.status, t.service_tier, t.destinations, t.travel_dates,
      t.group_size, t.notes,
      c.name AS client_name, c.email AS client_email
    FROM trips t
    JOIN client_profiles c ON c.id = t.client_profile_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [tripId]
  );
  return result.rows[0] ?? null;
}

async function loadLatestItinerary(
  tripId: string
): Promise<{ id: string; content: ItineraryContent } | null> {
  const result = await pool.query<{ id: string; content: unknown }>(
    `
    SELECT id, content
    FROM itinerary_versions
    WHERE trip_id = $1
      AND status IN ('sent', 'composed', 'confirmed', 'revision_requested')
    ORDER BY version_number DESC
    LIMIT 1
    `,
    [tripId]
  );
  if (!result.rows[0] || !isItineraryContent(result.rows[0].content)) {
    return null;
  }
  return {
    id: result.rows[0].id,
    content: result.rows[0].content,
  };
}

async function loadBookingsSummary(tripId: string): Promise<string> {
  const result = await pool.query<{
    booking_type: string;
    status: string;
    provider_booking_ref: string | null;
    pricing: { amount?: number; currency?: string } | null;
  }>(
    `
    SELECT booking_type, status, provider_booking_ref, pricing
    FROM bookings
    WHERE trip_id = $1
    ORDER BY created_at ASC
    `,
    [tripId]
  );
  if (result.rows.length === 0) return '(no bookings yet)';
  return result.rows
    .map(
      (b) =>
        `${b.booking_type}: ${b.status}${
          b.provider_booking_ref ? ` ref=${b.provider_booking_ref}` : ''
        }${
          b.pricing?.amount != null
            ? ` ${b.pricing.amount} ${b.pricing.currency ?? ''}`
            : ''
        }`
    )
    .join('\n');
}

async function draftAndSendReply(opts: {
  trip: TripContext;
  emailText: string;
  subject: string;
  history: CorrespondenceRecord[];
  itinerarySummary: string;
  bookingsSummary: string;
  extraInstruction?: string;
}): Promise<boolean> {
  const userMessage = [
    'Draft a reply to this client email. Be helpful, specific, and concise.',
    "If you need information you don't have, say you'll look into it and get back to them.",
    opts.extraInstruction ?? '',
    '',
    '--- Trip context ---',
    `Client: ${opts.trip.client_name}`,
    `Status: ${opts.trip.status}`,
    `Service: ${opts.trip.service_tier}`,
    `Destinations: ${JSON.stringify(opts.trip.destinations)}`,
    `Travel dates: ${JSON.stringify(opts.trip.travel_dates)}`,
    `Group size: ${opts.trip.group_size}`,
    '',
    '--- Itinerary summary ---',
    opts.itinerarySummary,
    '',
    '--- Bookings ---',
    opts.bookingsSummary,
    '',
    '--- Recent conversation ---',
    formatHistory(opts.history) || '(none)',
    '',
    '--- Client email ---',
    `Subject: ${opts.subject}`,
    opts.emailText,
  ].join('\n');

  const draft = stripReplyDraft(
    await composeWithSonnet(CONCIERGE_SYSTEM, userMessage)
  );

  const replySubject = opts.subject.toLowerCase().startsWith('re:')
    ? opts.subject
    : `Re: ${opts.subject || 'Your Outbound trip'}`;

  const html = `<p style="white-space:pre-wrap;font-family:sans-serif;font-size:15px;line-height:1.55;">${draft
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</p>`;

  const result = await sendEmail({
    to: opts.trip.client_email,
    subject: replySubject,
    html,
    text: draft,
    tripId: opts.trip.id,
  });

  return result.ok;
}

async function escalate(
  correspondenceId: string,
  tripId: string,
  reason: string
): Promise<void> {
  await updateCorrespondence(correspondenceId, {
    escalationFlag: true,
    escalationReason: reason,
    autoResponseSent: false,
  });
  await pool.query(
    `
    UPDATE trips
    SET escalation_flag = true,
        escalation_reason = CASE
          WHEN escalation_reason IS NULL OR escalation_reason = '' THEN $2
          ELSE escalation_reason || ' | ' || $2
        END,
        updated_at = NOW()
    WHERE id = $1
    `,
    [tripId, reason]
  );
  console.info('[correspondence] escalated', { correspondenceId, tripId, reason });
}

export async function routeClassifiedEmail(params: {
  correspondenceId: string;
  tripId: string;
  classification: string;
  confidence: number;
  emailText: string;
  subject: string;
}): Promise<void> {
  const {
    correspondenceId,
    tripId,
    classification,
    confidence,
    emailText,
    subject,
  } = params;

  await updateCorrespondence(correspondenceId, {
    classification,
    classificationConfidence: confidence,
  });

  if (confidence < CONFIDENCE_THRESHOLD) {
    await escalate(
      correspondenceId,
      tripId,
      'Low classification confidence'
    );
    return;
  }

  if (
    classification === 'complaint' ||
    classification === 'escalation_request' ||
    classification === 'modification_request' ||
    classification === 'cancellation_request'
  ) {
    const reason =
      classification === 'complaint'
        ? 'Client complaint'
        : classification === 'escalation_request'
          ? 'Client requested human contact'
          : classification === 'modification_request'
            ? 'Booking modification requested'
            : 'Cancellation requested';
    await escalate(correspondenceId, tripId, reason);
    return;
  }

  const trip = await loadTripContext(tripId);
  if (!trip) {
    await escalate(correspondenceId, tripId, 'Trip not found during routing');
    return;
  }

  const history = await getTripCorrespondence(tripId, 8);
  const itinerary = await loadLatestItinerary(tripId);
  const itinerarySummary = condenseItinerary(itinerary?.content ?? null);
  const bookingsSummary = await loadBookingsSummary(tripId);

  // Revision request → trigger recompose + ack
  if (classification === 'revision_request') {
    if (trip.status !== 'draft_delivered' && trip.status !== 'in_revision') {
      await escalate(
        correspondenceId,
        tripId,
        `Revision requested but trip status is ${trip.status}`
      );
      return;
    }

    if (!itinerary) {
      await escalate(
        correspondenceId,
        tripId,
        'Revision requested but no itinerary found'
      );
      return;
    }

    if (trip.status === 'draft_delivered') {
      await pool.query(
        `UPDATE itinerary_versions
         SET status = 'revision_requested', updated_at = NOW()
         WHERE id = $1`,
        [itinerary.id]
      );
      await pool.query(
        `UPDATE trips SET status = 'in_revision', updated_at = NOW() WHERE id = $1`,
        [tripId]
      );
    }

    scheduleComposeItinerary(tripId, {
      revisionNotes: emailText.slice(0, 8000),
      previousContent: itinerary.content,
    });

    const ack =
      "Thanks for the feedback — I'm working on an updated version now and will have it in your inbox shortly.";
    const ackResult = await sendEmail({
      to: trip.client_email,
      subject: subject.toLowerCase().startsWith('re:')
        ? subject
        : `Re: ${subject || 'Your itinerary'}`,
      html: `<p>${ack}</p>`,
      text: ack,
      tripId,
    });
    if (ackResult.ok) {
      await updateCorrespondence(correspondenceId, { autoResponseSent: true });
    }
    return;
  }

  // Verbal confirmation
  if (classification === 'confirmation') {
    if (trip.status === 'draft_delivered' || trip.status === 'in_revision') {
      if (itinerary) {
        await pool.query(
          `UPDATE itinerary_versions
           SET status = 'confirmed', version_type = 'confirmed', updated_at = NOW()
           WHERE id = $1`,
          [itinerary.id]
        );
      }
      await pool.query(
        `UPDATE trips SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
        [tripId]
      );
      if (trip.service_tier === 'full_service') {
        scheduleExecuteBookings(tripId);
      }
    }

    const sent = await draftAndSendReply({
      trip,
      emailText,
      subject,
      history,
      itinerarySummary,
      bookingsSummary,
      extraInstruction:
        'The client is confirming the plan. Acknowledge warmly and briefly outline next steps based on their service tier.',
    });
    if (sent) {
      await updateCorrespondence(correspondenceId, { autoResponseSent: true });
    }
    return;
  }

  // Gratitude — short warm ack without heavy Sonnet spend if preferred; still use Sonnet for voice consistency
  if (classification === 'gratitude') {
    const text =
      'That means a lot — I hope you have an incredible trip. Reach out anytime if you need anything.';
    const result = await sendEmail({
      to: trip.client_email,
      subject: subject.toLowerCase().startsWith('re:')
        ? subject
        : `Re: ${subject || 'Your Outbound trip'}`,
      html: `<p>${text}</p>`,
      text,
      tripId,
    });
    if (result.ok) {
      await updateCorrespondence(correspondenceId, { autoResponseSent: true });
    }
    return;
  }

  // question / logistics / booking_inquiry / other (high confidence)
  const extra =
    classification === 'booking_inquiry'
      ? 'Answer using the bookings context. Include confirmation references when available.'
      : classification === 'logistics'
        ? 'Focus on practical coordination details.'
        : undefined;

  const sent = await draftAndSendReply({
    trip,
    emailText,
    subject,
    history,
    itinerarySummary,
    bookingsSummary,
    extraInstruction: extra,
  });
  if (sent) {
      await updateCorrespondence(correspondenceId, { autoResponseSent: true });
    }
}
