/**
 * Classify inbound client email with Haiku.
 */

import {
  classifyWithHaiku,
  LLM_UNAVAILABLE_PREFIX,
  parseModelJson,
} from '../llm/bedrock';
import type { CorrespondenceRecord } from './store';

export const EMAIL_CLASSIFICATIONS = [
  'revision_request',
  'question',
  'confirmation',
  'logistics',
  'booking_inquiry',
  'modification_request',
  'cancellation_request',
  'complaint',
  'escalation_request',
  'gratitude',
  'other',
] as const;

export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];

export type ClassifyEmailResult = {
  classification: EmailClassification;
  confidence: number;
};

const SYSTEM_PROMPT = `You classify inbound emails for Outbound, a personal travel concierge service.
Respond with ONLY a JSON object — no markdown fences, no commentary:
{ "classification": "<category>", "confidence": <number 0.0-1.0> }

Categories (pick exactly one):
- revision_request — client wants changes to the itinerary draft
- question — asking about the trip, destination, or logistics in general
- confirmation — verbally confirming the itinerary (not clicking a link)
- logistics — practical coordination (arrival times, pickup, transfers)
- booking_inquiry — questions about existing bookings/confirmations
- modification_request — wants to change a confirmed booking
- cancellation_request — wants to cancel bookings or the whole trip
- complaint — negative feedback or dissatisfaction
- escalation_request — explicitly asking to speak with a person
- gratitude — thanks or positive feedback
- other — does not fit the above

Use trip status to disambiguate. Example: "looks good" at draft_delivered → confirmation;
at booked it may be gratitude. Be conservative with confidence when unclear.`;

function formatHistory(history: CorrespondenceRecord[]): string {
  if (!history.length) return '(no prior messages)';
  return history
    .slice(0, 5)
    .reverse()
    .map((m) => {
      const who = m.direction === 'inbound' ? 'Client' : 'Outbound';
      const body = (m.body_text ?? '').slice(0, 500);
      return `[${who}] ${m.subject ?? '(no subject)'}\n${body}`;
    })
    .join('\n\n---\n\n');
}

export async function classifyEmail(params: {
  emailText: string;
  subject: string;
  conversationHistory: CorrespondenceRecord[];
  tripStatus: string;
}): Promise<ClassifyEmailResult> {
  const userMessage = JSON.stringify(
    {
      tripStatus: params.tripStatus,
      subject: params.subject,
      emailText: params.emailText.slice(0, 8000),
      recentConversation: formatHistory(params.conversationHistory),
    },
    null,
    2
  );

  const raw = await classifyWithHaiku(SYSTEM_PROMPT, userMessage);

  if (raw.startsWith(LLM_UNAVAILABLE_PREFIX)) {
    console.warn('[classifier] Haiku unavailable — defaulting to other/low');
    return { classification: 'other', confidence: 0.3 };
  }

  try {
    const parsed = parseModelJson<{
      classification?: string;
      confidence?: number;
    }>(raw);
    const classification = EMAIL_CLASSIFICATIONS.includes(
      parsed.classification as EmailClassification
    )
      ? (parsed.classification as EmailClassification)
      : 'other';
    let confidence =
      typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    if (!Number.isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    return { classification, confidence };
  } catch (err) {
    console.error('[classifier] parse failed:', err);
    return { classification: 'other', confidence: 0.3 };
  }
}
