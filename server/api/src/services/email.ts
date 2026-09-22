/**
 * Resend-backed transactional email service.
 * When RESEND_API_KEY is unset, send helpers no-op (dev-friendly).
 * Successful sends are logged to correspondence when possible.
 */

import { Resend } from 'resend';

import {
  extractEmailAddress,
  findActiveTripByEmail,
  insertCorrespondence,
} from './correspondence/store';

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** When set, outbound mail is linked to this trip in correspondence. */
  tripId?: string | null;
  inReplyTo?: string;
  /** Skip correspondence logging (rare). */
  skipCorrespondenceLog?: boolean;
};

export type SendEmailResult = {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
};

let resend: Resend | null | undefined;
let warnedMissingKey = false;

function getResend(): Resend | null {
  if (resend !== undefined) return resend;
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? '';
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.warn(
        '[email] RESEND_API_KEY not set — email sending disabled (no-op)'
      );
      warnedMissingKey = true;
    }
    resend = null;
    return null;
  }
  resend = new Resend(apiKey);
  return resend;
}

export function isEmailConfigured(): boolean {
  return Boolean(getResend());
}

export function getDefaultFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
}

async function logOutbound(params: {
  to: string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  tripId?: string | null;
  resendMessageId?: string | null;
  inReplyTo?: string;
  skipped?: boolean;
}): Promise<void> {
  try {
    let tripId = params.tripId ?? null;
    if (!tripId && params.to[0]) {
      const match = await findActiveTripByEmail(params.to[0]);
      tripId = match?.tripId ?? null;
    }

    await insertCorrespondence({
      tripId,
      direction: 'outbound',
      fromEmail: extractEmailAddress(params.from) || params.from,
      toEmail: extractEmailAddress(params.to[0] ?? '') || params.to.join(','),
      subject: params.subject,
      bodyText: params.text ?? null,
      bodyHtml: params.html,
      resendMessageId: params.resendMessageId ?? null,
      inReplyTo: params.inReplyTo ?? null,
      rawPayload: params.skipped
        ? { skipped: true }
        : { provider: 'resend' },
    });
  } catch (err) {
    console.warn('[email] correspondence log failed:', err);
  }
}

/**
 * Send a transactional email via Resend.
 * Returns ok:true with skipped:true when the API key is not configured.
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  const from = params.from?.trim() || getDefaultFromAddress();
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const client = getResend();

  if (!client) {
    console.info('[email] skip send (no API key)', {
      to,
      subject: params.subject,
    });
    if (!params.skipCorrespondenceLog) {
      await logOutbound({
        to,
        from,
        subject: params.subject,
        html: params.html,
        text: params.text,
        tripId: params.tripId,
        inReplyTo: params.inReplyTo,
        skipped: true,
      });
    }
    return { ok: true, skipped: true };
  }

  try {
    const { data, error } = await client.emails.send({
      from,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return {
        ok: false,
        error: error.message || 'resend_error',
      };
    }

    console.info('[email] sent', { id: data?.id, to, subject: params.subject });

    if (!params.skipCorrespondenceLog) {
      await logOutbound({
        to,
        from,
        subject: params.subject,
        html: params.html,
        text: params.text,
        tripId: params.tripId,
        resendMessageId: data?.id ?? null,
        inReplyTo: params.inReplyTo,
      });
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] send failed:', message);
    return { ok: false, error: message };
  }
}
