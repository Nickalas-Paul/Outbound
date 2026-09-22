/**
 * Shared correspondence types and DB helpers.
 */

import { pool } from '../../config/database';

export type CorrespondenceRecord = {
  id: string;
  trip_id: string | null;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  classification: string | null;
  classification_confidence: number | null;
  auto_response_sent: boolean;
  escalation_flag: boolean;
  escalation_reason: string | null;
  resend_message_id: string | null;
  in_reply_to: string | null;
  created_at: Date;
};

export type InsertCorrespondenceInput = {
  tripId?: string | null;
  direction: 'inbound' | 'outbound';
  fromEmail: string;
  toEmail: string;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  rawPayload?: unknown;
  classification?: string | null;
  classificationConfidence?: number | null;
  autoResponseSent?: boolean;
  escalationFlag?: boolean;
  escalationReason?: string | null;
  resendMessageId?: string | null;
  inReplyTo?: string | null;
};

export async function insertCorrespondence(
  input: InsertCorrespondenceInput
): Promise<CorrespondenceRecord> {
  const result = await pool.query<CorrespondenceRecord>(
    `
    INSERT INTO correspondence (
      trip_id, direction, from_email, to_email, subject, body_text, body_html,
      raw_payload, classification, classification_confidence,
      auto_response_sent, escalation_flag, escalation_reason,
      resend_message_id, in_reply_to
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8::jsonb, $9, $10,
      $11, $12, $13,
      $14, $15
    )
    RETURNING *
    `,
    [
      input.tripId ?? null,
      input.direction,
      input.fromEmail,
      input.toEmail,
      input.subject ?? null,
      input.bodyText ?? null,
      input.bodyHtml ?? null,
      input.rawPayload != null ? JSON.stringify(input.rawPayload) : null,
      input.classification ?? null,
      input.classificationConfidence ?? null,
      input.autoResponseSent ?? false,
      input.escalationFlag ?? false,
      input.escalationReason ?? null,
      input.resendMessageId ?? null,
      input.inReplyTo ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateCorrespondence(
  id: string,
  patch: {
    classification?: string;
    classificationConfidence?: number;
    autoResponseSent?: boolean;
    escalationFlag?: boolean;
    escalationReason?: string | null;
  }
): Promise<void> {
  await pool.query(
    `
    UPDATE correspondence SET
      classification = COALESCE($2, classification),
      classification_confidence = COALESCE($3, classification_confidence),
      auto_response_sent = COALESCE($4, auto_response_sent),
      escalation_flag = COALESCE($5, escalation_flag),
      escalation_reason = COALESCE($6, escalation_reason)
    WHERE id = $1
    `,
    [
      id,
      patch.classification ?? null,
      patch.classificationConfidence ?? null,
      patch.autoResponseSent ?? null,
      patch.escalationFlag ?? null,
      patch.escalationReason ?? null,
    ]
  );
}

export async function getTripCorrespondence(
  tripId: string,
  limit = 20
): Promise<CorrespondenceRecord[]> {
  const result = await pool.query<CorrespondenceRecord>(
    `
    SELECT *
    FROM correspondence
    WHERE trip_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [tripId, limit]
  );
  return result.rows;
}

/** Extract bare email from "Name <email@x.com>" or plain email. */
export function extractEmailAddress(raw: string): string {
  const s = raw.trim();
  const angle = s.match(/<([^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  return s.toLowerCase();
}

export async function findActiveTripByEmail(email: string): Promise<{
  tripId: string;
  clientProfileId: string;
  status: string;
  serviceTier: string;
  clientName: string;
  clientEmail: string;
} | null> {
  const addr = extractEmailAddress(email);
  const result = await pool.query<{
    trip_id: string;
    client_profile_id: string;
    status: string;
    service_tier: string;
    client_name: string;
    client_email: string;
  }>(
    `
    SELECT
      t.id AS trip_id,
      t.client_profile_id,
      t.status,
      t.service_tier,
      c.name AS client_name,
      c.email AS client_email
    FROM client_profiles c
    JOIN trips t ON t.client_profile_id = c.id
    WHERE lower(c.email) = $1
      AND t.status NOT IN ('completed', 'cancelled')
    ORDER BY t.updated_at DESC
    LIMIT 1
    `,
    [addr]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    tripId: row.trip_id,
    clientProfileId: row.client_profile_id,
    status: row.status,
    serviceTier: row.service_tier,
    clientName: row.client_name,
    clientEmail: row.client_email,
  };
}
