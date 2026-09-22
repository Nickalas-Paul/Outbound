/**
 * Inbound email processing pipeline.
 */

import { classifyEmail } from './classifier';
import { routeClassifiedEmail } from './router';
import {
  extractEmailAddress,
  findActiveTripByEmail,
  getTripCorrespondence,
  insertCorrespondence,
  updateCorrespondence,
} from './store';

export type InboundEmailPayload = {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string> | null;
  message_id?: string;
  email_id?: string;
};

export async function processInboundEmail(
  payload: InboundEmailPayload
): Promise<{ correspondenceId: string; tripId: string | null }> {
  const fromRaw = String(payload.from ?? '').trim();
  const toRaw = String(payload.to ?? '').trim();
  const subject = String(payload.subject ?? '').trim();
  const text = String(payload.text ?? '').trim();
  const html = String(payload.html ?? '').trim();
  const headers = payload.headers ?? {};
  const inReplyTo =
    headers['in-reply-to'] ||
    headers['In-Reply-To'] ||
    headers['in_reply_to'] ||
    null;
  const resendId =
    payload.message_id ||
    payload.email_id ||
    headers['message-id'] ||
    null;

  const fromEmail = extractEmailAddress(fromRaw) || fromRaw || 'unknown@unknown';
  const toEmail = extractEmailAddress(toRaw) || toRaw || 'concierge@outbound.com';

  const match = await findActiveTripByEmail(fromEmail);

  const stored = await insertCorrespondence({
    tripId: match?.tripId ?? null,
    direction: 'inbound',
    fromEmail,
    toEmail,
    subject,
    bodyText: text || null,
    bodyHtml: html || null,
    rawPayload: payload,
    resendMessageId: resendId,
    inReplyTo,
    escalationFlag: !match,
    escalationReason: match ? null : 'Unmatched inbound email — no active trip',
  });

  if (!match) {
    console.warn('[correspondence] unmatched inbound', {
      correspondenceId: stored.id,
      fromEmail,
    });
    return { correspondenceId: stored.id, tripId: null };
  }

  const history = await getTripCorrespondence(match.tripId, 6);
  const classified = await classifyEmail({
    emailText: text || html.replace(/<[^>]+>/g, ' '),
    subject,
    conversationHistory: history.filter((h) => h.id !== stored.id),
    tripStatus: match.status,
  });

  await updateCorrespondence(stored.id, {
    classification: classified.classification,
    classificationConfidence: classified.confidence,
  });

  await routeClassifiedEmail({
    correspondenceId: stored.id,
    tripId: match.tripId,
    classification: classified.classification,
    confidence: classified.confidence,
    emailText: text || html.replace(/<[^>]+>/g, ' '),
    subject,
  });

  return { correspondenceId: stored.id, tripId: match.tripId };
}

export function scheduleProcessInbound(payload: InboundEmailPayload): void {
  setImmediate(() => {
    void processInboundEmail(payload).catch((err) => {
      console.error('[correspondence] inbound processing failed:', err);
    });
  });
}
