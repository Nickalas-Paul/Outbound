/**
 * Phase 3 admin + itinerary-only e2e smoke.
 * Run: node scripts/admin-e2e.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');

const BASE = process.env.OUTBOUND_API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = (process.env.ADMIN_EMAILS || 'nico@outbound.local')
  .split(',')[0]
  .trim();
const ADMIN_PASSWORD = 'AdminTest123!';
const CLIENT_EMAIL = 'phase3-e2e@example.com';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function json(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

(async () => {
  const report = { steps: [] };

  // Ensure admin user exists
  let reg = await json('POST', '/api/auth/register', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  report.steps.push({ register: reg.status, note: reg.data?.error || 'ok' });

  let login = await json('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (login.status !== 200 || !login.data?.accessToken) {
    console.error('LOGIN FAILED', login);
    process.exit(1);
  }
  const token = login.data.accessToken;
  report.steps.push({ login: 200 });

  // 1) Intake
  const intake = await json('POST', '/api/intake', {
    name: 'Test Traveler',
    email: CLIENT_EMAIL,
    destinations: [{ iso: 'JP', name: 'Japan' }],
    tripType: 'couple',
    travelDates: {
      start: '2027-03-01',
      end: '2027-03-14',
      flexible: true,
    },
    groupSize: 2,
    budgetRange: { min: 3000, max: 6000, currency: 'USD' },
    serviceTier: 'itinerary_only',
    turnstileToken: 'test',
  });
  report.steps.push({
    intake: intake.status,
    tripId: intake.data?.tripId,
    success: intake.data?.success,
  });
  const tripId = intake.data?.tripId;
  if (!tripId) {
    console.error('No tripId from intake', intake);
    process.exit(1);
  }

  // 2) Verification token from DB
  const tok = await pool.query(
    `SELECT token FROM verification_tokens
     WHERE type = 'email_verification'
     ORDER BY created_at DESC LIMIT 1`
  );
  const verifyToken = tok.rows[0]?.token;
  report.steps.push({ verifyToken: Boolean(verifyToken) });

  // 3) Verify
  const verify = await json(
    'GET',
    `/api/intake/verify?token=${encodeURIComponent(verifyToken)}`
  );
  report.steps.push({
    verify: verify.status,
    message: verify.data?.message,
  });

  // 4) Wait for composition (up to 120s)
  let status = null;
  let version = null;
  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const t = await pool.query(`SELECT status FROM trips WHERE id = $1`, [
      tripId,
    ]);
    status = t.rows[0]?.status;
    const v = await pool.query(
      `SELECT version_number, status FROM itinerary_versions
       WHERE trip_id = $1 ORDER BY version_number DESC LIMIT 1`,
      [tripId]
    );
    version = v.rows[0] ?? null;
    if (status === 'draft_delivered' || status === 'confirmed') break;
    if (version && ['failed', 'failed_parsing'].includes(version.status)) break;
  }
  report.steps.push({ afterCompose: { status, version } });

  // 5) Confirm if draft delivered
  if (status === 'draft_delivered') {
    const ct = await pool.query(
      `SELECT token FROM verification_tokens
       WHERE type = 'trip_confirmation'
       ORDER BY created_at DESC LIMIT 1`
    );
    const confirmToken = ct.rows[0]?.token;
    const conf = await fetch(
      `${BASE}/api/trips/${tripId}/confirm?token=${encodeURIComponent(confirmToken)}`,
      { headers: { Accept: 'application/json' } }
    );
    const confBody = await conf.json().catch(() => ({}));
    report.steps.push({ confirm: conf.status, body: confBody });
    const t2 = await pool.query(`SELECT status FROM trips WHERE id = $1`, [
      tripId,
    ]);
    status = t2.rows[0]?.status;
  }

  // 6) Simulated correspondence
  const inbound = await json('POST', '/api/correspondence/inbound', {
    from: CLIENT_EMAIL,
    to: 'concierge@outbound.com',
    subject: 'Quick question about Japan',
    text: 'What should I pack for Tokyo in March?',
    headers: {},
  });
  report.steps.push({ inbound: inbound.status, body: inbound.data });

  // Wait for classify
  let classified = null;
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const q = await pool.query(
      `SELECT classification, classification_confidence, escalation_flag
       FROM correspondence
       WHERE direction = 'inbound' AND lower(from_email) = $1
       ORDER BY created_at DESC LIMIT 1`,
      [CLIENT_EMAIL]
    );
    if (q.rows[0]?.classification) {
      classified = q.rows[0];
      break;
    }
  }
  report.steps.push({ classified });

  // 7) Admin APIs
  const trips = await json('GET', '/api/admin/trips', null, token);
  const detail = await json('GET', `/api/admin/trips/${tripId}`, null, token);
  const health = await json('GET', '/api/admin/health', null, token);
  const dash = await fetch(`${BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/html' },
  });

  report.steps.push({
    adminTrips: trips.status,
    tripCount: trips.data?.trips?.length,
    adminDetail: detail.status,
    versions: detail.data?.itineraryVersions?.length,
    correspondence: detail.data?.correspondence?.length,
    adminHealth: health.status,
    bedrock: health.data?.bedrock,
    resend: health.data?.resend,
    duffel: health.data?.duffel,
    dashboardHtml: dash.status,
  });

  console.log(JSON.stringify(report, null, 2));
  await pool.end();
})().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
