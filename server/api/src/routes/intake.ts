/**
 * Trip intake — public (optionalAuth). Guests and signed-in users submit trip requests.
 *
 * POST /api/intake
 * GET  /api/intake/verify?token=
 */

import {
  intakeSchema,
  isGroupSizeSoftWarning,
  type IntakePayload,
} from '@outbound/core';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { pool } from '../config/database';
import { optionalAuth } from '../middleware/optionalAuth';
import { sendEmail } from '../services/email';
import {
  buildVerificationUrl,
  createVerificationToken,
  verifyToken,
} from '../services/verification';
import { verificationEmail } from '../templates/emails';
import { apiError } from '../utils/response';

const router = Router();

const SUCCESS_MESSAGE =
  "Your trip request has been received. We'll be in touch soon.";

/** Stricter than global limiter: 5 submissions / 15 minutes / IP. */
const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: apiError('Too many trip requests. Please try again later.'),
});

function fakeSuccessResponse() {
  return {
    success: true as const,
    tripId: '00000000-0000-0000-0000-000000000000',
    message: SUCCESS_MESSAGE,
  };
}

function formatZodIssues(
  issues: Array<{ path: PropertyKey[]; message: string }>
): Array<{ path: string; message: string }> {
  return issues.map((issue) => ({
    path: issue.path.length ? issue.path.map(String).join('.') : '(root)',
    message: issue.message,
  }));
}

async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.warn(
      '[intake] TURNSTILE_SECRET_KEY not set — skipping Turnstile verification (dev only)'
    );
    return { ok: true };
  }

  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }
    );
    const json = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
    };
    if (!json.success) {
      return {
        ok: false,
        reason: (json['error-codes'] ?? []).join(', ') || 'verification_failed',
      };
    }
    return { ok: true };
  } catch (err) {
    console.error('[intake] Turnstile verification error:', err);
    return { ok: false, reason: 'turnstile_unreachable' };
  }
}

async function upsertClientProfile(
  payload: IntakePayload,
  userId: string | null
): Promise<string> {
  const travelerDetails: Record<string, string> = {};
  if (payload.fullLegalName?.trim()) {
    travelerDetails.fullLegalName = payload.fullLegalName.trim();
  }
  if (payload.dateOfBirth?.trim()) {
    travelerDetails.dateOfBirth = payload.dateOfBirth.trim();
  }
  if (payload.passportCountry?.trim()) {
    travelerDetails.passportCountry = payload.passportCountry.trim();
  }
  const hasTravelerDetails = Object.keys(travelerDetails).length > 0;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO client_profiles (
       email, name, phone, service_tier_preference, user_id, communication_preferences
     ) VALUES (
       $1, $2, $3, $4, $5,
       CASE WHEN $6::boolean THEN $7::jsonb ELSE NULL END
     )
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       phone = EXCLUDED.phone,
       service_tier_preference = EXCLUDED.service_tier_preference,
       user_id = COALESCE(EXCLUDED.user_id, client_profiles.user_id),
       communication_preferences = CASE
         WHEN $6::boolean THEN
           COALESCE(client_profiles.communication_preferences, '{}'::jsonb) || $7::jsonb
         ELSE client_profiles.communication_preferences
       END,
       updated_at = NOW()
     RETURNING id`,
    [
      payload.email.toLowerCase().trim(),
      payload.name.trim(),
      payload.phone?.trim() || null,
      payload.serviceTier,
      userId,
      hasTravelerDetails,
      JSON.stringify(travelerDetails),
    ]
  );
  return result.rows[0].id;
}

function successMessage(payload: IntakePayload): string {
  const email = payload.email.trim();
  return `Your trip request has been received. Please check ${email} to verify your email — we'll prepare your trip plan once you confirm.`;
}

async function createTrip(
  clientProfileId: string,
  payload: IntakePayload
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO trips (
       client_profile_id,
       service_tier,
       status,
       destinations,
       trip_type,
       travel_dates,
       group_size,
       budget_range,
       accommodation_style,
       interests,
       special_requirements,
       already_booked,
       notes,
       point_of_contact
     ) VALUES (
       $1, $2, 'intake_received', $3::jsonb, $4, $5::jsonb, $6,
       $7::jsonb, $8, $9, $10::jsonb, $11, $12, $13::jsonb
     )
     RETURNING id`,
    [
      clientProfileId,
      payload.serviceTier,
      JSON.stringify(payload.destinations),
      payload.tripType,
      JSON.stringify(payload.travelDates),
      payload.groupSize,
      payload.budgetRange ? JSON.stringify(payload.budgetRange) : null,
      payload.accommodationStyle ?? null,
      payload.interests ?? null,
      payload.specialRequirements
        ? JSON.stringify(payload.specialRequirements)
        : null,
      payload.alreadyBooked ?? null,
      payload.notes ?? null,
      payload.pointOfContact ? JSON.stringify(payload.pointOfContact) : null,
    ]
  );
  return result.rows[0].id;
}

/**
 * Send verification email after intake. Failures are logged only —
 * the trip record is already persisted.
 */
async function sendVerificationEmailSafe(
  clientProfileId: string,
  payload: IntakePayload
): Promise<void> {
  try {
    const token = await createVerificationToken(clientProfileId);
    const verificationUrl = buildVerificationUrl(token);
    const content = verificationEmail({
      name: payload.name,
      verificationUrl,
    });
    const result = await sendEmail({
      to: payload.email.toLowerCase().trim(),
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (!result.ok) {
      console.error('[intake] Verification email failed:', result.error, {
        clientProfileId,
      });
    } else if (result.skipped) {
      console.info('[intake] Verification email skipped (no RESEND_API_KEY)', {
        clientProfileId,
        verificationUrl,
      });
    }
  } catch (err) {
    console.error('[intake] Verification email error (non-fatal):', err);
  }
}

/**
 * POST /api/intake
 * Public — optionalAuth. Guests submit without an account; auth links user_id.
 */
router.post('/', intakeLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = intakeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatZodIssues(parsed.error.issues),
      });
      return;
    }

    const payload = parsed.data;

    // Honeypot: pretend success, store nothing
    if (payload.honeypotField != null && payload.honeypotField.trim() !== '') {
      res.status(200).json(fakeSuccessResponse());
      return;
    }

    const turnstile = await verifyTurnstile(
      payload.turnstileToken,
      req.ip
    );
    if (!turnstile.ok) {
      console.warn('[intake] Turnstile failed:', turnstile.reason);
      res.status(403).json(apiError('Verification failed. Please try again.'));
      return;
    }

    if (isGroupSizeSoftWarning(payload)) {
      console.warn(
        '[intake] Soft warning: tripType=group with groupSize<=1',
        { email: payload.email, groupSize: payload.groupSize }
      );
    }

    const userId = req.user?.id ?? null;
    const clientProfileId = await upsertClientProfile(payload, userId);
    const tripId = await createTrip(clientProfileId, payload);

    // Fire-and-forget email — never fail the intake response
    void sendVerificationEmailSafe(clientProfileId, payload);

    res.status(200).json({
      success: true,
      tripId,
      message: successMessage(payload),
    });
  } catch (err) {
    console.error('[intake] Failed to store submission:', err);
    res.status(500).json(apiError('Failed to save trip request'));
  }
});

/**
 * GET /api/intake/verify?token=
 * Public — validates email verification token and advances trip to composing.
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token ?? '');
    const result = await verifyToken(token);

    if (!result.valid) {
      const messages: Record<string, string> = {
        invalid: 'Invalid verification link.',
        expired: 'This verification link has expired. Please submit again.',
        already_used: 'This verification link has already been used.',
      };
      res.status(400).json({
        success: false,
        error: messages[result.reason] ?? 'Verification failed.',
        reason: result.reason,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Email verified. We're preparing your trip plan.",
      clientProfileId: result.clientProfileId,
      tripId: result.tripId,
    });
  } catch (err) {
    console.error('[intake] verify error:', err);
    res.status(500).json(apiError('Verification failed'));
  }
});

export default router;
