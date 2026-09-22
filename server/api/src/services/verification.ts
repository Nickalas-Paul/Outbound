/**
 * Email verification tokens for trip intake.
 */

import crypto from 'crypto';

import { pool } from '../config/database';

const TOKEN_TTL_HOURS = 24;

export type VerifyTokenResult =
  | { valid: true; clientProfileId: string; tripId: string | null }
  | { valid: false; reason: 'invalid' | 'expired' | 'already_used' };

/**
 * Generate a cryptographically random token, store with 24h expiry, return token.
 */
export async function createVerificationToken(
  clientProfileId: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO verification_tokens (client_profile_id, token, type, expires_at)
     VALUES ($1, $2, 'email_verification', $3)`,
    [clientProfileId, token, expiresAt.toISOString()]
  );

  return token;
}

/**
 * Validate token: not expired, not used.
 * On success: mark used, set email_verified, move latest intake_received trip → composing.
 */
export async function verifyToken(token: string): Promise<VerifyTokenResult> {
  const trimmed = token?.trim() ?? '';
  if (!trimmed) {
    return { valid: false, reason: 'invalid' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query<{
      id: string;
      client_profile_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, client_profile_id, expires_at, used_at
       FROM verification_tokens
       WHERE token = $1
       FOR UPDATE`,
      [trimmed]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return { valid: false, reason: 'invalid' };
    }

    const row = found.rows[0];

    if (row.used_at != null) {
      await client.query('ROLLBACK');
      return { valid: false, reason: 'already_used' };
    }

    const expiresAt =
      row.expires_at instanceof Date
        ? row.expires_at
        : new Date(row.expires_at);
    if (expiresAt.getTime() <= Date.now()) {
      await client.query('ROLLBACK');
      return { valid: false, reason: 'expired' };
    }

    await client.query(
      `UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`,
      [row.id]
    );

    await client.query(
      `UPDATE client_profiles
       SET email_verified = true, updated_at = NOW()
       WHERE id = $1`,
      [row.client_profile_id]
    );

    const trip = await client.query<{ id: string }>(
      `UPDATE trips
       SET status = 'composing', updated_at = NOW()
       WHERE id = (
         SELECT id FROM trips
         WHERE client_profile_id = $1
           AND status = 'intake_received'
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING id`,
      [row.client_profile_id]
    );

    await client.query('COMMIT');

    return {
      valid: true,
      clientProfileId: row.client_profile_id,
      tripId: trip.rows[0]?.id ?? null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function getAppBaseUrl(): string {
  return (
    process.env.OUTBOUND_APP_URL?.trim() ||
    process.env.EXPO_PUBLIC_APP_URL?.trim() ||
    'http://localhost:8081'
  );
}

export function buildVerificationUrl(token: string): string {
  const base = getAppBaseUrl().replace(/\/$/, '');
  return `${base}/verify?token=${encodeURIComponent(token)}`;
}
