/**
 * Admin API + HTML dashboard.
 * All routes: requireAuth → requireAdmin.
 */

import { Router, Request, Response } from 'express';

import { pool } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { runFollowUpSequences } from '../services/correspondence/followups';
import {
  updateCorrespondence,
} from '../services/correspondence/store';
import { sendEmail, isEmailConfigured, getDefaultFromAddress } from '../services/email';
import { isBedrockConfigured } from '../services/llm/bedrock';
import { isDuffelConfigured } from '../services/booking/duffel';
import { buildTripPdfUrl } from '../services/verification';
import { adminLayout, escapeHtml } from '../utils/adminHtml';
import { apiError } from '../utils/response';

const router = Router();

router.use(requireAuth, requireAdmin);

function destLabel(
  destinations: Array<{ iso?: string; name?: string }> | null | undefined
): string {
  if (!destinations?.length) return '—';
  return destinations
    .map((d) => d.name || d.iso)
    .filter(Boolean)
    .join(', ');
}

function datesLabel(
  travelDates: { start?: string; end?: string } | null | undefined
): string {
  if (!travelDates?.start) return '—';
  return `${travelDates.start}${travelDates.end ? ` → ${travelDates.end}` : ''}`;
}

function sendAdminHtml(res: Response, html: string, status = 200): void {
  res.status(status);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; img-src 'self' data:; base-uri 'none'"
  );
  res.send(html);
}

// ─── JSON: trip list ─────────────────────────────────────────────────────────

router.get('/trips', async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const tier = typeof req.query.tier === 'string' ? req.query.tier : null;
    const escalated =
      req.query.escalated === 'true'
        ? true
        : req.query.escalated === 'false'
          ? false
          : null;

    const clauses: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      clauses.push(`t.status = $${params.length}`);
    }
    if (tier) {
      params.push(tier);
      clauses.push(`t.service_tier = $${params.length}`);
    }
    if (escalated === true) {
      clauses.push(`t.escalation_flag = true`);
    } else if (escalated === false) {
      clauses.push(`t.escalation_flag = false`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.service_tier,
        t.status,
        t.destinations,
        t.travel_dates,
        t.created_at,
        t.updated_at,
        t.escalation_flag,
        t.escalation_reason,
        c.name AS client_name,
        c.email AS client_email,
        (
          SELECT json_build_object(
            'version_number', v.version_number,
            'status', v.status
          )
          FROM itinerary_versions v
          WHERE v.trip_id = t.id
          ORDER BY v.version_number DESC
          LIMIT 1
        ) AS latest_version,
        (
          SELECT COUNT(*)::int FROM bookings b WHERE b.trip_id = t.id
        ) AS booking_count,
        (
          SELECT COALESCE(json_agg(b.status), '[]'::json)
          FROM bookings b WHERE b.trip_id = t.id
        ) AS booking_statuses
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      ${where}
      ORDER BY t.updated_at DESC
      LIMIT 200
      `,
      params
    );

    res.json({ success: true, trips: result.rows });
  } catch (err) {
    console.error('[admin] trips list error:', err);
    res.status(500).json(apiError('Failed to list trips'));
  }
});

// ─── JSON: trip detail ───────────────────────────────────────────────────────

router.get('/trips/:tripId', async (req: Request, res: Response) => {
  try {
    const tripId = String(req.params.tripId ?? '');
    const trip = await pool.query(
      `
      SELECT t.*, c.name AS client_name, c.email AS client_email,
             c.phone AS client_phone, c.email_verified
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [tripId]
    );
    if (trip.rows.length === 0) {
      res.status(404).json(apiError('Trip not found'));
      return;
    }

    const [versions, bookings, correspondence] = await Promise.all([
      pool.query(
        `SELECT id, version_number, version_type, status, pdf_path,
                composition_metadata, created_at, updated_at
         FROM itinerary_versions WHERE trip_id = $1
         ORDER BY version_number ASC`,
        [tripId]
      ),
      pool.query(
        `SELECT * FROM bookings WHERE trip_id = $1 ORDER BY created_at ASC`,
        [tripId]
      ),
      pool.query(
        `SELECT * FROM correspondence WHERE trip_id = $1 ORDER BY created_at ASC`,
        [tripId]
      ),
    ]);

    res.json({
      success: true,
      trip: trip.rows[0],
      itineraryVersions: versions.rows,
      bookings: bookings.rows,
      correspondence: correspondence.rows,
    });
  } catch (err) {
    console.error('[admin] trip detail error:', err);
    res.status(500).json(apiError('Failed to load trip'));
  }
});

// ─── JSON: escalations ───────────────────────────────────────────────────────

router.get('/escalations', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT
        corr.*,
        t.id AS trip_id,
        t.status AS trip_status,
        t.service_tier,
        t.destinations,
        t.escalation_flag AS trip_escalation_flag,
        t.escalation_reason AS trip_escalation_reason,
        c.name AS client_name,
        c.email AS client_email
      FROM correspondence corr
      LEFT JOIN trips t ON t.id = corr.trip_id
      LEFT JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE corr.escalation_flag = true
         OR (t.escalation_flag = true AND corr.direction = 'inbound')
      ORDER BY corr.created_at DESC
      LIMIT 100
      `
    );

    const items = [];
    for (const row of result.rows) {
      let history: unknown[] = [];
      if (row.trip_id) {
        const h = await pool.query(
          `SELECT id, direction, subject, body_text, classification, created_at, escalation_flag
           FROM correspondence WHERE trip_id = $1
           ORDER BY created_at DESC LIMIT 10`,
          [row.trip_id]
        );
        history = h.rows;
      }
      items.push({ ...row, conversationHistory: history });
    }

    res.json({ success: true, escalations: items });
  } catch (err) {
    console.error('[admin] escalations error:', err);
    res.status(500).json(apiError('Failed to load escalations'));
  }
});

// ─── JSON: respond to escalated correspondence ───────────────────────────────

router.post(
  '/correspondence/:correspondenceId/respond',
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.correspondenceId ?? '');
      const body = String((req.body as { body?: string })?.body ?? '').trim();
      if (body.length < 2) {
        res.status(400).json(apiError('Response body is required'));
        return;
      }

      const found = await pool.query<{
        id: string;
        trip_id: string | null;
        from_email: string;
        to_email: string;
        subject: string | null;
      }>(`SELECT * FROM correspondence WHERE id = $1 LIMIT 1`, [id]);

      if (found.rows.length === 0) {
        res.status(404).json(apiError('Correspondence not found'));
        return;
      }

      const inbound = found.rows[0];
      const clientEmail = inbound.from_email;
      const subject = inbound.subject?.toLowerCase().startsWith('re:')
        ? inbound.subject
        : `Re: ${inbound.subject || 'Your Outbound trip'}`;

      const html = `<p style="white-space:pre-wrap;font-family:sans-serif;font-size:15px;line-height:1.55;">${escapeHtml(body)}</p>`;
      const emailResult = await sendEmail({
        to: clientEmail,
        subject: subject ?? 'Outbound',
        html,
        text: body,
        tripId: inbound.trip_id,
        from: getDefaultFromAddress(),
      });

      if (!emailResult.ok) {
        res.status(502).json(apiError(emailResult.error || 'Failed to send email'));
        return;
      }

      await updateCorrespondence(id, {
        escalationFlag: false,
        escalationReason: null,
      });

      if (inbound.trip_id) {
        const remaining = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM correspondence
           WHERE trip_id = $1 AND escalation_flag = true`,
          [inbound.trip_id]
        );
        if (Number(remaining.rows[0]?.n ?? 0) === 0) {
          await pool.query(
            `UPDATE trips
             SET escalation_flag = false, escalation_reason = NULL, updated_at = NOW()
             WHERE id = $1`,
            [inbound.trip_id]
          );
        }
      }

      const wantsHtml =
        String(req.headers.accept ?? '').includes('text/html') ||
        String(req.headers['content-type'] ?? '').includes(
          'application/x-www-form-urlencoded'
        );

      if (wantsHtml) {
        const redirect =
          inbound.trip_id
            ? `/api/admin/dashboard/trips/${inbound.trip_id}`
            : '/api/admin/dashboard/escalations';
        res.redirect(303, redirect);
        return;
      }

      res.json({ success: true, emailId: emailResult.id ?? null });
    } catch (err) {
      console.error('[admin] respond error:', err);
      res.status(500).json(apiError('Failed to send response'));
    }
  }
);

// ─── JSON: health ────────────────────────────────────────────────────────────

router.get('/health', async (req: Request, res: Response) => {
  try {
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM trips) AS trips,
        (SELECT COUNT(*)::int FROM bookings) AS bookings,
        (SELECT COUNT(*)::int FROM correspondence) AS correspondence,
        (SELECT COUNT(*)::int FROM itinerary_versions) AS itinerary_versions,
        (SELECT COUNT(*)::int FROM client_profiles) AS client_profiles,
        (SELECT COUNT(*)::int FROM trips WHERE escalation_flag = true) AS trip_escalations,
        (SELECT COUNT(*)::int FROM correspondence WHERE escalation_flag = true) AS correspondence_escalations,
        (SELECT MAX(updated_at) FROM trips) AS latest_trip_activity,
        (SELECT MAX(created_at) FROM market_signals) AS latest_signal,
        (SELECT MAX(created_at) FROM correspondence WHERE direction = 'outbound') AS last_outbound_email
    `);

    const byStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM trips GROUP BY status ORDER BY status`
    );
    const bookingsByStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM bookings GROUP BY status ORDER BY status`
    );

    const payload = {
      success: true,
      database: { ok: true, counts: counts.rows[0] },
      resend: {
        configured: isEmailConfigured(),
        lastOutboundAt: counts.rows[0].last_outbound_email,
      },
      bedrock: { configured: isBedrockConfigured() },
      duffel: { configured: isDuffelConfigured() },
      tripsByStatus: byStatus.rows,
      bookingsByStatus: bookingsByStatus.rows,
      escalationBacklog: Number(counts.rows[0].correspondence_escalations ?? 0),
      latestTripActivity: counts.rows[0].latest_trip_activity,
      signalFreshness: counts.rows[0].latest_signal,
    };

    const wantsHtml = String(req.headers.accept ?? '').includes('text/html');
    if (wantsHtml) {
      const c = counts.rows[0];
      sendAdminHtml(
        res,
        adminLayout({
          title: 'Health',
          active: 'health',
          bodyHtml: `
            <h1>System health</h1>
            <div class="cards">
              <div class="card"><div class="n">${isEmailConfigured() ? 'OK' : '—'}</div><div class="l">Resend</div></div>
              <div class="card"><div class="n">${isBedrockConfigured() ? 'OK' : '—'}</div><div class="l">Bedrock</div></div>
              <div class="card"><div class="n">${isDuffelConfigured() ? 'OK' : '—'}</div><div class="l">Duffel</div></div>
              <div class="card"><div class="n">${c.trips}</div><div class="l">Trips</div></div>
              <div class="card"><div class="n">${c.correspondence_escalations}</div><div class="l">Escalations</div></div>
            </div>
            <h2>Trips by status</h2>
            <table><tr><th>Status</th><th>Count</th></tr>
              ${byStatus.rows.map((r) => `<tr><td>${escapeHtml(r.status)}</td><td>${r.n}</td></tr>`).join('')}
            </table>
            <h2>Bookings by status</h2>
            <table><tr><th>Status</th><th>Count</th></tr>
              ${bookingsByStatus.rows.map((r) => `<tr><td>${escapeHtml(r.status)}</td><td>${r.n}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">None</td></tr>'}
            </table>
            <p class="muted">Latest trip activity: ${escapeHtml(String(c.latest_trip_activity ?? '—'))}</p>
            <p class="muted">Latest market signal: ${escapeHtml(String(c.latest_signal ?? '—'))}</p>
            <p class="muted">Last outbound email: ${escapeHtml(String(c.last_outbound_email ?? '—'))}</p>
            <pre class="muted">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
          `,
        })
      );
      return;
    }

    res.json(payload);
  } catch (err) {
    console.error('[admin] health error:', err);
    res.status(500).json(apiError('Health check failed'));
  }
});

// ─── Follow-ups (upgrade already behind requireAuth+requireAdmin via router.use)

router.post('/follow-ups/run', async (req: Request, res: Response) => {
  try {
    const report = await runFollowUpSequences();
    const wantsHtml =
      String(req.headers.accept ?? '').includes('text/html') ||
      String(req.headers['content-type'] ?? '').includes(
        'application/x-www-form-urlencoded'
      );
    if (wantsHtml) {
      sendAdminHtml(
        res,
        adminLayout({
          title: 'Follow-ups',
          active: 'dashboard',
          bodyHtml: `
            <h1>Follow-ups ran</h1>
            <pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
            <p><a href="/api/admin/dashboard">Back to dashboard</a></p>
          `,
        })
      );
      return;
    }
    res.status(200).json({
      success: true,
      report,
      totals: {
        postDraft48h: report.postDraft48h.length,
        preTrip14d: report.preTrip14d.length,
        preTrip2d: report.preTrip2d.length,
        postTrip7d: report.postTrip7d.length,
      },
    });
  } catch (err) {
    console.error('[admin] follow-ups run failed:', err);
    res.status(500).json(apiError('Failed to run follow-up sequences'));
  }
});

// ─── HTML: dashboard ─────────────────────────────────────────────────────────

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const summary = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM trips) AS total_trips,
        (SELECT COUNT(*)::int FROM trips WHERE status NOT IN ('completed','cancelled')) AS active_trips,
        (SELECT COUNT(*)::int FROM correspondence WHERE escalation_flag = true) AS pending_escalations,
        (SELECT COUNT(*)::int FROM trips WHERE created_at >= NOW() - INTERVAL '7 days') AS trips_this_week
    `);
    const byStatus = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM trips GROUP BY status ORDER BY status`
    );
    const recent = await pool.query(
      `
      SELECT t.id, t.status, t.service_tier, t.destinations, t.updated_at, t.escalation_flag,
             c.name AS client_name
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      ORDER BY t.updated_at DESC
      LIMIT 20
      `
    );

    const s = summary.rows[0];
    const escClass = Number(s.pending_escalations) > 0 ? 'warn' : '';

    sendAdminHtml(
      res,
      adminLayout({
        title: 'Dashboard',
        active: 'dashboard',
        bodyHtml: `
          <h1>Dashboard</h1>
          <div class="cards">
            <div class="card"><div class="n">${s.total_trips}</div><div class="l">Total trips</div></div>
            <div class="card"><div class="n">${s.active_trips}</div><div class="l">Active</div></div>
            <div class="card ${escClass}"><div class="n">${s.pending_escalations}</div><div class="l"><a href="/api/admin/dashboard/escalations">Escalations</a></div></div>
            <div class="card"><div class="n">${s.trips_this_week}</div><div class="l">This week</div></div>
          </div>
          <h2>Status breakdown</h2>
          <table>
            <tr><th>Status</th><th>Count</th></tr>
            ${byStatus.rows
              .map(
                (r) =>
                  `<tr><td>${escapeHtml(r.status)}</td><td>${r.n}</td></tr>`
              )
              .join('') || '<tr><td colspan="2" class="muted">No trips yet</td></tr>'}
          </table>
          <h2>Recent trips</h2>
          <table>
            <tr>
              <th>Client</th><th>Destination</th><th>Tier</th><th>Status</th><th>Updated</th><th></th>
            </tr>
            ${recent.rows
              .map((t) => {
                const flag = t.escalation_flag
                  ? ' <span class="pill danger">esc</span>'
                  : '';
                return `<tr>
                  <td>${escapeHtml(t.client_name)}${flag}</td>
                  <td>${escapeHtml(destLabel(t.destinations))}</td>
                  <td>${escapeHtml(t.service_tier)}</td>
                  <td><span class="pill">${escapeHtml(t.status)}</span></td>
                  <td class="muted">${escapeHtml(new Date(t.updated_at).toISOString().slice(0, 16))}</td>
                  <td><a href="/api/admin/dashboard/trips/${t.id}">Open</a></td>
                </tr>`;
              })
              .join('') || '<tr><td colspan="6" class="muted">No trips</td></tr>'}
          </table>
        `,
      })
    );
  } catch (err) {
    console.error('[admin] dashboard error:', err);
    res.status(500).send('Dashboard failed');
  }
});

// ─── HTML: trip detail ───────────────────────────────────────────────────────

router.get('/dashboard/trips/:tripId', async (req: Request, res: Response) => {
  try {
    const tripId = String(req.params.tripId ?? '');
    const tripRes = await pool.query(
      `
      SELECT t.*, c.name AS client_name, c.email AS client_email
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE t.id = $1
      `,
      [tripId]
    );
    if (tripRes.rows.length === 0) {
      sendAdminHtml(
        res,
        adminLayout({
          title: 'Not found',
          active: 'dashboard',
          bodyHtml: '<h1>Trip not found</h1>',
        }),
        404
      );
      return;
    }
    const trip = tripRes.rows[0];
    const versions = await pool.query(
      `SELECT id, version_number, status, version_type, created_at
       FROM itinerary_versions WHERE trip_id = $1 ORDER BY version_number`,
      [tripId]
    );
    const bookings = await pool.query(
      `SELECT booking_type, status, provider_booking_ref, pricing, failure_reason, created_at
       FROM bookings WHERE trip_id = $1 ORDER BY created_at`,
      [tripId]
    );
    const corr = await pool.query(
      `SELECT id, direction, subject, body_text, classification, escalation_flag, escalation_reason, created_at
       FROM correspondence WHERE trip_id = $1 ORDER BY created_at ASC`,
      [tripId]
    );

    const lastInboundEsc = [...corr.rows]
      .reverse()
      .find((m) => m.direction === 'inbound' && m.escalation_flag);

    sendAdminHtml(
      res,
      adminLayout({
        title: `Trip ${tripId.slice(0, 8)}`,
        active: 'dashboard',
        bodyHtml: `
          <p class="muted"><a href="/api/admin/dashboard">← Dashboard</a></p>
          <h1>${escapeHtml(destLabel(trip.destinations))}</h1>
          <p>
            <span class="pill">${escapeHtml(trip.status)}</span>
            <span class="pill">${escapeHtml(trip.service_tier)}</span>
            ${trip.escalation_flag ? '<span class="pill danger">escalated</span>' : ''}
          </p>
          <p>
            <strong>${escapeHtml(trip.client_name)}</strong>
            &lt;${escapeHtml(trip.client_email)}&gt;<br />
            <span class="muted">${escapeHtml(datesLabel(trip.travel_dates))}</span>
          </p>
          ${trip.escalation_reason ? `<p class="pill danger">${escapeHtml(trip.escalation_reason)}</p>` : ''}

          <h2>Itinerary versions</h2>
          <table>
            <tr><th>#</th><th>Type</th><th>Status</th><th>Created</th><th>PDF</th></tr>
            ${versions.rows
              .map(
                (v) => `<tr>
                  <td>${v.version_number}</td>
                  <td>${escapeHtml(v.version_type)}</td>
                  <td>${escapeHtml(v.status)}</td>
                  <td class="muted">${escapeHtml(new Date(v.created_at).toISOString().slice(0, 16))}</td>
                  <td><a href="${escapeHtml(buildTripPdfUrl(tripId))}" target="_blank">PDF</a></td>
                </tr>`
              )
              .join('') || '<tr><td colspan="5" class="muted">None</td></tr>'}
          </table>

          <h2>Bookings</h2>
          <table>
            <tr><th>Type</th><th>Status</th><th>Ref</th><th>Price</th><th>Failure</th></tr>
            ${bookings.rows
              .map((b) => {
                const price =
                  b.pricing && typeof b.pricing === 'object'
                    ? `${(b.pricing as { amount?: number }).amount ?? ''} ${(b.pricing as { currency?: string }).currency ?? ''}`
                    : '';
                return `<tr>
                  <td>${escapeHtml(b.booking_type)}</td>
                  <td>${escapeHtml(b.status)}</td>
                  <td>${escapeHtml(b.provider_booking_ref ?? '—')}</td>
                  <td>${escapeHtml(price.trim() || '—')}</td>
                  <td class="muted">${escapeHtml(b.failure_reason ?? '')}</td>
                </tr>`;
              })
              .join('') || '<tr><td colspan="5" class="muted">No bookings</td></tr>'}
          </table>

          <h2>Correspondence</h2>
          <div class="thread">
            ${corr.rows
              .map((m) => {
                const cls = [
                  'msg',
                  m.direction === 'inbound' ? 'in' : 'out',
                  m.escalation_flag ? 'esc' : '',
                ].join(' ');
                return `<div class="${cls}">
                  <div class="muted">
                    ${escapeHtml(m.direction)} · ${escapeHtml(new Date(m.created_at).toISOString().slice(0, 16))}
                    ${m.classification ? ` · <span class="pill">${escapeHtml(m.classification)}</span>` : ''}
                    ${m.escalation_flag ? ' · <span class="pill danger">escalated</span>' : ''}
                  </div>
                  <strong>${escapeHtml(m.subject ?? '(no subject)')}</strong>
                  <pre>${escapeHtml((m.body_text ?? '').slice(0, 2000))}</pre>
                  ${m.escalation_reason ? `<p class="muted">${escapeHtml(m.escalation_reason)}</p>` : ''}
                </div>`;
              })
              .join('') || '<p class="muted">No correspondence yet</p>'}
          </div>

          ${
            lastInboundEsc
              ? `
            <h2>Reply to escalation</h2>
            <form method="POST" action="/api/admin/correspondence/${lastInboundEsc.id}/respond">
              <textarea name="body" required placeholder="Write your reply to the client…"></textarea>
              <p style="margin-top:10px;"><button type="submit">Send reply</button></p>
            </form>`
              : ''
          }
        `,
      })
    );
  } catch (err) {
    console.error('[admin] trip page error:', err);
    res.status(500).send('Trip page failed');
  }
});

// ─── HTML: escalations inbox ─────────────────────────────────────────────────

router.get('/dashboard/escalations', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT
        corr.id,
        corr.body_text,
        corr.subject,
        corr.classification,
        corr.escalation_reason,
        corr.created_at,
        corr.trip_id,
        t.destinations,
        t.status AS trip_status,
        c.name AS client_name
      FROM correspondence corr
      LEFT JOIN trips t ON t.id = corr.trip_id
      LEFT JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE corr.escalation_flag = true
      ORDER BY corr.created_at DESC
      LIMIT 50
      `
    );

    sendAdminHtml(
      res,
      adminLayout({
        title: 'Escalations',
        active: 'escalations',
        bodyHtml: `
          <h1>Escalation inbox</h1>
          <p class="muted">${result.rows.length} unresolved item(s)</p>
          ${result.rows
            .map((row) => {
              const snippet = (row.body_text ?? '').slice(0, 280);
              return `
              <div class="card" style="margin-bottom:12px;min-width:100%;">
                <p>
                  <strong>${escapeHtml(row.client_name ?? 'Unknown')}</strong>
                  · ${escapeHtml(destLabel(row.destinations))}
                  · <span class="pill">${escapeHtml(row.trip_status ?? 'n/a')}</span>
                  ${row.classification ? `<span class="pill">${escapeHtml(row.classification)}</span>` : ''}
                </p>
                <p class="pill danger">${escapeHtml(row.escalation_reason ?? 'Escalated')}</p>
                <p class="muted">${escapeHtml(new Date(row.created_at).toISOString())}</p>
                <pre>${escapeHtml(snippet)}</pre>
                ${
                  row.trip_id
                    ? `<p><a href="/api/admin/dashboard/trips/${row.trip_id}">Open trip</a></p>`
                    : ''
                }
                <form method="POST" action="/api/admin/correspondence/${row.id}/respond">
                  <textarea name="body" required placeholder="Quick reply…"></textarea>
                  <p style="margin-top:8px;"><button type="submit">Send</button></p>
                </form>
              </div>`;
            })
            .join('') || '<p class="muted">No open escalations. Nice.</p>'}
        `,
      })
    );
  } catch (err) {
    console.error('[admin] escalations page error:', err);
    res.status(500).send('Escalations page failed');
  }
});

export default router;
