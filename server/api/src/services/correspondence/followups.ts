/**
 * Scheduled follow-up sequences (invoked manually via admin endpoint for now).
 */

import { pool } from '../../config/database';
import { sendEmail } from '../email';
import {
  confirmationReminderEmail,
  postTripEmail,
  preTripEmail,
} from '../../templates/emails';
import { getDefaultFromAddress } from '../email';
import { buildTripPdfUrl } from '../verification';

export type FollowUpReport = {
  postDraft48h: Array<{ tripId: string; email: string; ok: boolean }>;
  preTrip14d: Array<{ tripId: string; email: string; ok: boolean }>;
  preTrip2d: Array<{ tripId: string; email: string; ok: boolean }>;
  postTrip7d: Array<{ tripId: string; email: string; ok: boolean }>;
};

async function alreadySentFollowUp(
  tripId: string,
  marker: string
): Promise<boolean> {
  const result = await pool.query<{ n: string }>(
    `
    SELECT COUNT(*)::text AS n
    FROM correspondence
    WHERE trip_id = $1
      AND direction = 'outbound'
      AND (
        subject ILIKE $2
        OR body_text ILIKE $2
      )
    `,
    [tripId, `%${marker}%`]
  );
  return Number(result.rows[0]?.n ?? 0) > 0;
}

async function destinationLabel(tripId: string): Promise<string> {
  const result = await pool.query<{
    destinations: Array<{ iso?: string; name?: string }> | null;
  }>(`SELECT destinations FROM trips WHERE id = $1`, [tripId]);
  const dests = result.rows[0]?.destinations ?? [];
  const label = dests
    .map((d) => d.name || d.iso)
    .filter(Boolean)
    .join(', ');
  return label || 'your trip';
}

async function signalAlertsForTrip(tripId: string): Promise<string> {
  const result = await pool.query<{
    title: string;
    severity: number | null;
    description: string | null;
    signal_type: string;
  }>(
    `
    SELECT ms.title, ms.severity, ms.description, ms.signal_type
    FROM trips t
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.destinations, '[]'::jsonb)) AS d
    JOIN geographies g ON g.iso_code = upper(COALESCE(d->>'iso', ''))
    JOIN market_signals ms ON ms.geography_id = g.id
    WHERE t.id = $1
      AND ms.resolved = false
      AND (ms.expires_at IS NULL OR ms.expires_at > NOW())
    ORDER BY ms.severity DESC NULLS LAST, ms.created_at DESC
    LIMIT 8
    `,
    [tripId]
  );
  if (result.rows.length === 0) {
    return 'No active destination alerts at the moment.';
  }
  return result.rows
    .map(
      (s) =>
        `• [${s.signal_type}] ${s.title}${
          s.severity != null ? ` (severity ${s.severity})` : ''
        }${s.description ? ` — ${s.description.slice(0, 200)}` : ''}`
    )
    .join('\n');
}

async function bookingDetailsForTrip(tripId: string): Promise<string> {
  const result = await pool.query<{
    booking_type: string;
    status: string;
    provider_booking_ref: string | null;
    confirmation_details: Record<string, unknown> | null;
  }>(
    `
    SELECT booking_type, status, provider_booking_ref, confirmation_details
    FROM bookings
    WHERE trip_id = $1 AND status = 'confirmed'
    ORDER BY created_at ASC
    `,
    [tripId]
  );
  if (result.rows.length === 0) {
    return 'Booking confirmations will follow as they settle.';
  }
  return result.rows
    .map(
      (b) =>
        `• ${b.booking_type}: ${b.provider_booking_ref ?? 'confirmed'}${
          b.confirmation_details
            ? ` — ${JSON.stringify(b.confirmation_details).slice(0, 180)}`
            : ''
        }`
    )
    .join('\n');
}

/**
 * Run all follow-up sequences once. Safe to call repeatedly — skips trips
 * that already received a matching outbound marker.
 */
export async function runFollowUpSequences(): Promise<FollowUpReport> {
  const report: FollowUpReport = {
    postDraft48h: [],
    preTrip14d: [],
    preTrip2d: [],
    postTrip7d: [],
  };

  // 1) 48h post-draft with no inbound since delivery
  const draftTrips = await pool.query<{
    id: string;
    client_name: string;
    client_email: string;
  }>(
    `
    SELECT t.id, c.name AS client_name, c.email AS client_email
    FROM trips t
    JOIN client_profiles c ON c.id = t.client_profile_id
    WHERE t.status = 'draft_delivered'
      AND t.updated_at < NOW() - INTERVAL '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM correspondence corr
        WHERE corr.trip_id = t.id
          AND corr.direction = 'inbound'
          AND corr.created_at >= t.updated_at
      )
    `
  );

  for (const trip of draftTrips.rows) {
    if (await alreadySentFollowUp(trip.id, 'draft itinerary is ready whenever')) {
      continue;
    }
    const dest = await destinationLabel(trip.id);
    const content = confirmationReminderEmail({
      name: trip.client_name,
      tripSummary: `Your draft itinerary for ${dest} is still waiting for your review.`,
    });
    const result = await sendEmail({
      to: trip.client_email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tripId: trip.id,
    });
    report.postDraft48h.push({
      tripId: trip.id,
      email: trip.client_email,
      ok: result.ok,
    });
  }

  // 2) Pre-trip 14 days
  const pre14 = await pool.query<{
    id: string;
    client_name: string;
    client_email: string;
    travel_dates: { start?: string; end?: string } | null;
  }>(
    `
    SELECT t.id, c.name AS client_name, c.email AS client_email, t.travel_dates
    FROM trips t
    JOIN client_profiles c ON c.id = t.client_profile_id
    WHERE t.status IN ('confirmed', 'booked')
      AND (t.travel_dates->>'start') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (t.travel_dates->>'start')::date
          BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
    `
  );

  for (const trip of pre14.rows) {
    if (await alreadySentFollowUp(trip.id, 'pre-departure briefing')) {
      continue;
    }
    const dest = await destinationLabel(trip.id);
    const alerts = await signalAlertsForTrip(trip.id);
    const content = preTripEmail({
      name: trip.client_name,
      tripSummary: `Your trip to ${dest} starts soon (${trip.travel_dates?.start ?? ''}). Here's a quick briefing.`,
      signalAlerts: alerts,
    });
    const result = await sendEmail({
      to: trip.client_email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tripId: trip.id,
    });
    report.preTrip14d.push({
      tripId: trip.id,
      email: trip.client_email,
      ok: result.ok,
    });
  }

  // 3) Pre-trip 2 days (full-service booked)
  const pre2 = await pool.query<{
    id: string;
    client_name: string;
    client_email: string;
    travel_dates: { start?: string } | null;
  }>(
    `
    SELECT t.id, c.name AS client_name, c.email AS client_email, t.travel_dates
    FROM trips t
    JOIN client_profiles c ON c.id = t.client_profile_id
    WHERE t.status = 'booked'
      AND t.service_tier = 'full_service'
      AND (t.travel_dates->>'start') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (t.travel_dates->>'start')::date
          BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
    `
  );

  for (const trip of pre2.rows) {
    if (await alreadySentFollowUp(trip.id, 'final trip details')) {
      continue;
    }
    const dest = await destinationLabel(trip.id);
    const bookings = await bookingDetailsForTrip(trip.id);
    const text = [
      `Hi ${trip.client_name.trim() || 'there'},`,
      '',
      `Your ${dest} trip is almost here. Here are your final trip details and booking confirmations:`,
      '',
      bookings,
      '',
      `Itinerary PDF: ${buildTripPdfUrl(trip.id)}`,
      '',
      'Safe travels — I\'ll be here if anything comes up.',
      '',
      'Outbound — Personal travel concierge',
    ].join('\n');
    const html = `<p style="white-space:pre-wrap;font-family:sans-serif;font-size:15px;line-height:1.55;">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</p>`;
    const result = await sendEmail({
      to: trip.client_email,
      from: getDefaultFromAddress(),
      subject: `Final trip details for ${dest} — Outbound`,
      html,
      text,
      tripId: trip.id,
    });
    // Stamp a marker phrase into body for idempotency (already in text via "final trip details")
    report.preTrip2d.push({
      tripId: trip.id,
      email: trip.client_email,
      ok: result.ok,
    });
  }

  // 4) Post-trip 7 days after end
  const post = await pool.query<{
    id: string;
    client_name: string;
    client_email: string;
  }>(
    `
    SELECT t.id, c.name AS client_name, c.email AS client_email
    FROM trips t
    JOIN client_profiles c ON c.id = t.client_profile_id
    WHERE t.status IN ('booked', 'active', 'confirmed', 'completed')
      AND (t.travel_dates->>'end') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND (t.travel_dates->>'end')::date = CURRENT_DATE - INTERVAL '7 days'
    `
  );

  for (const trip of post.rows) {
    if (await alreadySentFollowUp(trip.id, 'How was your trip')) {
      continue;
    }
    const dest = await destinationLabel(trip.id);
    const content = postTripEmail({
      name: trip.client_name,
      destination: dest,
    });
    const result = await sendEmail({
      to: trip.client_email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      tripId: trip.id,
    });
    report.postTrip7d.push({
      tripId: trip.id,
      email: trip.client_email,
      ok: result.ok,
    });
  }

  console.info('[followups] complete', {
    postDraft48h: report.postDraft48h.length,
    preTrip14d: report.preTrip14d.length,
    preTrip2d: report.preTrip2d.length,
    postTrip7d: report.postTrip7d.length,
  });

  return report;
}
