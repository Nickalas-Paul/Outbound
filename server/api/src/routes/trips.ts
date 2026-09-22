/**
 * Trip-facing routes: itinerary PDF, confirmation, and revision.
 *
 * GET  /api/trips/:tripId/itinerary/pdf
 * GET  /api/trips/:tripId/confirm?token=
 * GET  /api/trips/:tripId/revise?token=
 * POST /api/trips/:tripId/revise
 */

import fs from 'fs/promises';
import path from 'path';

import { Router, Request, Response } from 'express';

import { pool } from '../config/database';
import {
  scheduleComposeItinerary,
} from '../services/composition';
import { scheduleExecuteBookings } from '../services/booking/executor';
import { sendEmail } from '../services/email';
import { renderItineraryPdf } from '../services/itinerary-pdf';
import {
  isItineraryContent,
  type ItineraryContent,
} from '../services/itinerary-types';
import { validateTripToken } from '../services/verification';
import {
  itineraryConfirmedEmail,
} from '../templates/emails';
import { escapeHtml, htmlPage } from '../utils/htmlPage';
import { apiError } from '../utils/response';

const router = Router();

const UUID_RE = /^[0-9a-f-]{36}$/i;

const ALREADY_CONFIRMED = new Set([
  'confirmed',
  'booking_in_progress',
  'booked',
  'active',
  'completed',
]);

function sendHtml(
  res: Response,
  page: { status: number; html: string }
): void {
  res.status(page.status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Allow inline styles for these simple server pages (helmet CSP otherwise blocks)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"
  );
  res.send(page.html);
}

function tokenErrorPage(reason: string): { status: number; html: string } {
  const expiredLike =
    reason === 'expired' ||
    reason === 'invalid' ||
    reason === 'already_used' ||
    reason === 'wrong_trip';
  return htmlPage({
    status: expiredLike ? 400 : 400,
    title: 'Link unavailable — Outbound',
    bodyHtml: `
      <h1>This link is no longer valid</h1>
      <p>This link has expired. Please reply to your most recent email from me and I'll send a fresh link.</p>
      <p class="muted">Outbound — Personal travel concierge</p>
    `,
  });
}

function destinationLabel(
  destinations: Array<{ iso?: string; name?: string }> | null,
  content: ItineraryContent | null
): string {
  if (content?.destinations?.length) {
    return content.destinations.join(', ');
  }
  if (destinations?.length) {
    return destinations
      .map((d) => d.name || d.iso || 'your destination')
      .filter(Boolean)
      .join(', ');
  }
  return 'your trip';
}

router.get(
  '/:tripId/itinerary/pdf',
  async (req: Request, res: Response) => {
    try {
      const tripId = String(req.params.tripId ?? '').trim();
      if (!UUID_RE.test(tripId)) {
        res.status(400).json(apiError('Invalid trip id'));
        return;
      }

      const result = await pool.query<{
        id: string;
        version_number: number;
        content: ItineraryContent;
        pdf_path: string | null;
        status: string;
      }>(
        `
        SELECT id, version_number, content, pdf_path, status
        FROM itinerary_versions
        WHERE trip_id = $1
          AND status IN ('composed', 'sent', 'confirmed', 'revision_requested')
        ORDER BY version_number DESC
        LIMIT 1
        `,
        [tripId]
      );

      if (result.rows.length === 0) {
        res.status(404).json(apiError('No itinerary available for this trip'));
        return;
      }

      const row = result.rows[0];
      if (!isItineraryContent(row.content)) {
        res.status(500).json(apiError('Itinerary content is invalid'));
        return;
      }

      let buffer: Buffer | null = null;
      if (row.pdf_path) {
        try {
          buffer = await fs.readFile(row.pdf_path);
        } catch {
          buffer = null;
        }
      }
      if (!buffer) {
        buffer = await renderItineraryPdf(row.content);
        try {
          const dir = path.resolve(__dirname, '../../data/itineraries');
          await fs.mkdir(dir, { recursive: true });
          const absolute = path.join(
            dir,
            `${tripId}-v${row.version_number}.pdf`
          );
          await fs.writeFile(absolute, buffer);
          await pool.query(
            `UPDATE itinerary_versions SET pdf_path = $1, updated_at = NOW() WHERE id = $2`,
            [absolute, row.id]
          );
        } catch (err) {
          console.warn('[trips] could not cache PDF:', err);
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="outbound-itinerary-v${row.version_number}.pdf"`
      );
      res.send(buffer);
    } catch (err) {
      console.error('[trips] itinerary pdf error:', err);
      res.status(500).json(apiError('Failed to generate itinerary PDF'));
    }
  }
);

router.get('/:tripId/confirm', async (req: Request, res: Response) => {
  try {
    const tripId = String(req.params.tripId ?? '').trim();
    const token = String(req.query.token ?? '').trim();

    if (!UUID_RE.test(tripId)) {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Invalid link — Outbound',
          bodyHtml: `<h1>Invalid link</h1><p>This confirmation link looks incomplete. Please use the link from your most recent email.</p>`,
        })
      );
      return;
    }

    const tokenResult = await validateTripToken({
      token,
      type: 'trip_confirmation',
      tripId,
      markUsed: false,
    });

    if (!tokenResult.valid) {
      sendHtml(res, tokenErrorPage(tokenResult.reason));
      return;
    }

    const tripResult = await pool.query<{
      id: string;
      status: string;
      service_tier: string;
      destinations: Array<{ iso?: string; name?: string }>;
      client_name: string;
      client_email: string;
    }>(
      `
      SELECT
        t.id, t.status, t.service_tier, t.destinations,
        c.name AS client_name, c.email AS client_email
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE t.id = $1 AND t.client_profile_id = $2
      LIMIT 1
      `,
      [tripId, tokenResult.clientProfileId]
    );

    if (tripResult.rows.length === 0) {
      sendHtml(res, tokenErrorPage('wrong_trip'));
      return;
    }

    const trip = tripResult.rows[0];

    if (ALREADY_CONFIRMED.has(trip.status)) {
      sendHtml(
        res,
        htmlPage({
          title: 'Already confirmed — Outbound',
          bodyHtml: `
            <h1>Already confirmed</h1>
            <p>This itinerary has already been confirmed.</p>
          `,
        })
      );
      return;
    }

    if (trip.status !== 'draft_delivered' && trip.status !== 'in_revision') {
      if (trip.status === 'composing') {
        sendHtml(
          res,
          htmlPage({
            title: 'Still working — Outbound',
            bodyHtml: `
              <h1>Still working on it</h1>
              <p>I'm already working on updates to your itinerary. You'll receive the new version shortly.</p>
            `,
          })
        );
        return;
      }
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Not ready — Outbound',
          bodyHtml: `
            <h1>Not ready to confirm yet</h1>
            <p>This itinerary isn't ready for confirmation. Please use the link in your most recent draft email, or reply to that email and I'll help.</p>
          `,
        })
      );
      return;
    }

    const consumed = await pool.query(
      `UPDATE verification_tokens
       SET used_at = NOW()
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [tokenResult.tokenId]
    );
    if (consumed.rows.length === 0) {
      sendHtml(
        res,
        htmlPage({
          title: 'Already confirmed — Outbound',
          bodyHtml: `
            <h1>Already confirmed</h1>
            <p>This itinerary has already been confirmed.</p>
          `,
        })
      );
      return;
    }

    const versionResult = await pool.query<{
      id: string;
      content: ItineraryContent;
    }>(
      `
      SELECT id, content
      FROM itinerary_versions
      WHERE trip_id = $1
        AND status IN ('sent', 'composed', 'revision_requested')
      ORDER BY version_number DESC
      LIMIT 1
      `,
      [tripId]
    );

    if (versionResult.rows.length === 0) {
      sendHtml(
        res,
        htmlPage({
          status: 404,
          title: 'Itinerary not found — Outbound',
          bodyHtml: `<h1>Itinerary not found</h1><p>I couldn't find a draft to confirm. Please reply to your email and I'll sort it out.</p>`,
        })
      );
      return;
    }

    const version = versionResult.rows[0];
    const content = isItineraryContent(version.content)
      ? version.content
      : null;

    await pool.query(
      `UPDATE itinerary_versions
       SET status = 'confirmed', version_type = 'confirmed', updated_at = NOW()
       WHERE id = $1`,
      [version.id]
    );
    await pool.query(
      `UPDATE trips
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1`,
      [tripId]
    );

    const dest = destinationLabel(trip.destinations, content);
    const emailContent = itineraryConfirmedEmail({
      name: trip.client_name,
      destinationLabel: dest,
      serviceTier: trip.service_tier,
    });
    void sendEmail({
      to: trip.client_email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }).catch((err) => {
      console.error('[trips] confirmation email failed:', err);
    });

    if (trip.service_tier === 'full_service') {
      scheduleExecuteBookings(tripId);
    }

    const acceptsHtml = String(req.headers.accept ?? '').includes('text/html');
    if (acceptsHtml || !req.headers.accept) {
      sendHtml(
        res,
        htmlPage({
          title: 'Confirmed — Outbound',
          bodyHtml: `
            <h1>You're confirmed</h1>
            <p>Thanks for confirming! Your itinerary for ${escapeHtml(dest)} is locked in.</p>
            <p>${
              trip.service_tier === 'full_service'
                ? "I'll begin coordinating your bookings now."
                : "You're all set — enjoy planning with your finalized itinerary."
            }</p>
          `,
        })
      );
      return;
    }

    res.status(200).json({
      success: true,
      tripId,
      status: 'confirmed',
      message: `Thanks for confirming! Your itinerary for ${dest} is locked in.`,
    });
  } catch (err) {
    console.error('[trips] confirm error:', err);
    sendHtml(
      res,
      htmlPage({
        status: 500,
        title: 'Something went wrong — Outbound',
        bodyHtml: `<h1>Something went wrong</h1><p>Please reply to your most recent email and I'll help from there.</p>`,
      })
    );
  }
});

router.get('/:tripId/revise', async (req: Request, res: Response) => {
  try {
    const tripId = String(req.params.tripId ?? '').trim();
    const token = String(req.query.token ?? '').trim();

    if (!UUID_RE.test(tripId)) {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Invalid link — Outbound',
          bodyHtml: `<h1>Invalid link</h1><p>This revision link looks incomplete.</p>`,
        })
      );
      return;
    }

    const tokenResult = await validateTripToken({
      token,
      type: 'trip_revision',
      tripId,
      markUsed: false,
    });

    if (!tokenResult.valid) {
      sendHtml(res, tokenErrorPage(tokenResult.reason));
      return;
    }

    const tripResult = await pool.query<{
      id: string;
      status: string;
      destinations: Array<{ iso?: string; name?: string }>;
    }>(
      `
      SELECT id, status, destinations
      FROM trips
      WHERE id = $1 AND client_profile_id = $2
      LIMIT 1
      `,
      [tripId, tokenResult.clientProfileId]
    );

    if (tripResult.rows.length === 0) {
      sendHtml(res, tokenErrorPage('wrong_trip'));
      return;
    }

    const trip = tripResult.rows[0];

    if (ALREADY_CONFIRMED.has(trip.status)) {
      sendHtml(
        res,
        htmlPage({
          title: 'Already confirmed — Outbound',
          bodyHtml: `
            <h1>Already confirmed</h1>
            <p>This itinerary has already been confirmed. If you need changes, reply to your confirmation email and I'll help.</p>
          `,
        })
      );
      return;
    }

    if (trip.status === 'composing' || trip.status === 'in_revision') {
      sendHtml(
        res,
        htmlPage({
          title: 'Still working — Outbound',
          bodyHtml: `
            <h1>Still working on it</h1>
            <p>I'm already working on updates to your itinerary. You'll receive the new version shortly.</p>
          `,
        })
      );
      return;
    }

    if (trip.status !== 'draft_delivered') {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Not ready — Outbound',
          bodyHtml: `
            <h1>Not ready for revisions yet</h1>
            <p>Please use the link from your most recent draft email, or reply to that email and I'll help.</p>
          `,
        })
      );
      return;
    }

    const versionResult = await pool.query<{ content: ItineraryContent }>(
      `
      SELECT content
      FROM itinerary_versions
      WHERE trip_id = $1 AND status IN ('sent', 'composed')
      ORDER BY version_number DESC
      LIMIT 1
      `,
      [tripId]
    );
    const content = versionResult.rows[0]?.content;
    const title =
      content && isItineraryContent(content)
        ? content.title
        : 'Your trip itinerary';
    const dest = destinationLabel(trip.destinations, content && isItineraryContent(content) ? content : null);

    sendHtml(
      res,
      htmlPage({
        title: 'Request changes — Outbound',
        bodyHtml: `
          <h1>Request changes</h1>
          <p><strong>${escapeHtml(title)}</strong></p>
          <p class="muted">Destinations: ${escapeHtml(dest)}</p>
          <p>Tell me what you'd like adjusted. I'll revise the plan and send an updated draft.</p>
          <form method="POST" action="/api/trips/${escapeHtml(tripId)}/revise">
            <input type="hidden" name="token" value="${escapeHtml(token)}" />
            <label for="revisionNotes">What would you like changed?</label>
            <textarea id="revisionNotes" name="revisionNotes" required placeholder="e.g. Replace the day 3 temple visit with a cooking class"></textarea>
            <button type="submit">Submit changes</button>
          </form>
        `,
      })
    );
  } catch (err) {
    console.error('[trips] revise form error:', err);
    sendHtml(
      res,
      htmlPage({
        status: 500,
        title: 'Something went wrong — Outbound',
        bodyHtml: `<h1>Something went wrong</h1><p>Please reply to your email and I'll help from there.</p>`,
      })
    );
  }
});

router.post('/:tripId/revise', async (req: Request, res: Response) => {
  try {
    const tripId = String(req.params.tripId ?? '').trim();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = String(body.token ?? req.query.token ?? '').trim();
    const revisionNotes = String(body.revisionNotes ?? '').trim();

    if (!UUID_RE.test(tripId)) {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Invalid link — Outbound',
          bodyHtml: `<h1>Invalid link</h1><p>This revision link looks incomplete.</p>`,
        })
      );
      return;
    }

    if (!revisionNotes || revisionNotes.length < 3) {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Add a note — Outbound',
          bodyHtml: `
            <h1>Add a bit more detail</h1>
            <p>Please describe the changes you'd like so I can revise the itinerary.</p>
            <p><a href="/api/trips/${escapeHtml(tripId)}/revise?token=${escapeHtml(token)}">Go back</a></p>
          `,
        })
      );
      return;
    }

    const tokenResult = await validateTripToken({
      token,
      type: 'trip_revision',
      tripId,
      markUsed: false,
    });

    if (!tokenResult.valid) {
      sendHtml(res, tokenErrorPage(tokenResult.reason));
      return;
    }

    const tripResult = await pool.query<{
      id: string;
      status: string;
    }>(
      `
      SELECT id, status
      FROM trips
      WHERE id = $1 AND client_profile_id = $2
      LIMIT 1
      `,
      [tripId, tokenResult.clientProfileId]
    );

    if (tripResult.rows.length === 0) {
      sendHtml(res, tokenErrorPage('wrong_trip'));
      return;
    }

    const trip = tripResult.rows[0];

    if (ALREADY_CONFIRMED.has(trip.status)) {
      sendHtml(
        res,
        htmlPage({
          title: 'Already confirmed — Outbound',
          bodyHtml: `
            <h1>Already confirmed</h1>
            <p>This itinerary has already been confirmed.</p>
          `,
        })
      );
      return;
    }

    if (trip.status === 'composing' || trip.status === 'in_revision') {
      sendHtml(
        res,
        htmlPage({
          title: 'Still working — Outbound',
          bodyHtml: `
            <h1>Still working on it</h1>
            <p>I'm already working on updates to your itinerary. You'll receive the new version shortly.</p>
          `,
        })
      );
      return;
    }

    if (trip.status !== 'draft_delivered') {
      sendHtml(
        res,
        htmlPage({
          status: 400,
          title: 'Not ready — Outbound',
          bodyHtml: `
            <h1>Not ready for revisions yet</h1>
            <p>Please use the link from your most recent draft email.</p>
          `,
        })
      );
      return;
    }

    const versionResult = await pool.query<{
      id: string;
      content: ItineraryContent;
      version_number: number;
    }>(
      `
      SELECT id, content, version_number
      FROM itinerary_versions
      WHERE trip_id = $1 AND status IN ('sent', 'composed')
      ORDER BY version_number DESC
      LIMIT 1
      `,
      [tripId]
    );

    if (
      versionResult.rows.length === 0 ||
      !isItineraryContent(versionResult.rows[0].content)
    ) {
      sendHtml(
        res,
        htmlPage({
          status: 404,
          title: 'Itinerary not found — Outbound',
          bodyHtml: `<h1>Itinerary not found</h1><p>I couldn't find a draft to revise. Please reply to your email.</p>`,
        })
      );
      return;
    }

    const previous = versionResult.rows[0];

    await pool.query(
      `UPDATE itinerary_versions
       SET status = 'revision_requested', updated_at = NOW()
       WHERE id = $1`,
      [previous.id]
    );
    await pool.query(
      `UPDATE trips
       SET status = 'in_revision', updated_at = NOW()
       WHERE id = $1`,
      [tripId]
    );

    scheduleComposeItinerary(tripId, {
      revisionNotes: revisionNotes.slice(0, 8000),
      previousContent: previous.content,
    });

    sendHtml(
      res,
      htmlPage({
        title: 'Thanks — Outbound',
        bodyHtml: `
          <h1>Got it</h1>
          <p>Thanks for your feedback. I'm working on an updated version and will have it in your inbox shortly.</p>
        `,
      })
    );
  } catch (err) {
    console.error('[trips] revise submit error:', err);
    sendHtml(
      res,
      htmlPage({
        status: 500,
        title: 'Something went wrong — Outbound',
        bodyHtml: `<h1>Something went wrong</h1><p>Please reply to your email and I'll help from there.</p>`,
      })
    );
  }
});

export default router;
