/**
 * Itinerary composition pipeline: research → Sonnet → parse → PDF → email.
 */

import fs from 'fs/promises';
import path from 'path';

import { pool } from '../config/database';
import { sendEmail } from './email';
import {
  composeWithSonnet,
  isBedrockConfigured,
  LLM_UNAVAILABLE_PREFIX,
  parseModelJson,
  SONNET_MODEL_ID,
} from './llm/bedrock';
import { renderItineraryPdf } from './itinerary-pdf';
import {
  isItineraryContent,
  type ItineraryContent,
} from './itinerary-types';
import { researchDestinations, type DestinationResearch } from './research';
import { getAppBaseUrl } from './verification';
import { itineraryDraftEmail } from '../templates/emails';

type TripRow = {
  id: string;
  client_profile_id: string;
  service_tier: string;
  status: string;
  destinations: Array<{ iso?: string; name?: string }>;
  trip_type: string;
  travel_dates: { start?: string; end?: string; flexible?: boolean };
  group_size: number;
  budget_range: { min?: number; max?: number; currency?: string } | null;
  accommodation_style: string | null;
  interests: string[] | null;
  special_requirements: Record<string, string> | null;
  already_booked: string | null;
  notes: string | null;
  client_name: string;
  client_email: string;
};

function itineraryDataDir(): string {
  return path.resolve(__dirname, '../../data/itineraries');
}

function buildSystemPrompt(): string {
  return `You are Outbound's expert travel itinerary composer.
You create practical, day-by-day travel plans grounded in the destination research provided.
Respond with ONLY a single JSON object — no markdown fences, no preamble, no commentary.
The JSON MUST match this TypeScript shape exactly (all fields required unless marked optional):

{
  "title": string,
  "summary": string,
  "destinations": string[],          // ISO codes
  "totalDays": number,
  "estimatedBudgetPerPerson": { "low": number, "high": number, "currency": string },
  "days": [{
    "dayNumber": number,
    "date": string | undefined,      // YYYY-MM-DD when dates known
    "location": string,
    "theme": string,
    "accommodation": {
      "name": string,
      "type": string,
      "estimatedCostPerNight": number,
      "bookingNotes": string
    },
    "activities": [{
      "time": string,
      "name": string,
      "description": string,
      "estimatedCost": number,
      "duration": string,
      "bookingRequired": boolean
    }],
    "meals": [{
      "type": string,
      "suggestion": string,
      "estimatedCost": number
    }],
    "logistics": string,
    "tips": string
  }],
  "generalTips": string[],
  "packingNotes": string[],
  "importantNotes": string[]         // safety, visa, signal-based alerts
}

Rules:
- Use realistic costs in the client's currency when provided (else USD).
- Respect budget, trip type, accommodation style, interests, and special requirements.
- Incorporate active safety/travel signals into importantNotes and daily logistics when relevant.
- Prefer walkable / efficient day plans; avoid impossible logistics.
- Cover every day from start to end inclusive when dates are provided.`;
}

function buildUserMessage(
  trip: TripRow,
  research: DestinationResearch[]
): string {
  const dates = trip.travel_dates || {};
  const budget = trip.budget_range;
  return JSON.stringify(
    {
      trip: {
        tripType: trip.trip_type,
        groupSize: trip.group_size,
        serviceTier: trip.service_tier,
        travelDates: dates,
        budgetRange: budget,
        accommodationStyle: trip.accommodation_style,
        interests: trip.interests,
        specialRequirements: trip.special_requirements,
        alreadyBooked: trip.already_booked,
        notes: trip.notes,
        requestedDestinations: trip.destinations,
      },
      destinationResearch: research.map((r) => ({
        isoCode: r.isoCode,
        name: r.name,
        region: r.region,
        population: r.population,
        tviOverall: r.tvi.overall,
        tviConfidence: r.tvi.confidence,
        dimensions: r.tvi.dimensions,
        activeSignals: r.signals.map((s) => ({
          type: s.signalType,
          title: s.title,
          severity: s.severity,
          direction: s.direction,
          description: s.description,
        })),
      })),
    },
    null,
    2
  );
}

async function nextVersionNumber(tripId: string): Promise<number> {
  const result = await pool.query<{ max: number | null }>(
    `SELECT MAX(version_number) AS max FROM itinerary_versions WHERE trip_id = $1`,
    [tripId]
  );
  return (result.rows[0]?.max ?? 0) + 1;
}

/**
 * Compose itinerary for a trip. Safe to call fire-and-forget; errors are logged.
 */
export async function composeItinerary(tripId: string): Promise<void> {
  console.info('[composition] starting', { tripId });
  const startedAt = Date.now();

  try {
    const tripResult = await pool.query<TripRow>(
      `
      SELECT
        t.id,
        t.client_profile_id,
        t.service_tier,
        t.status,
        t.destinations,
        t.trip_type,
        t.travel_dates,
        t.group_size,
        t.budget_range,
        t.accommodation_style,
        t.interests,
        t.special_requirements,
        t.already_booked,
        t.notes,
        c.name AS client_name,
        c.email AS client_email
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      console.error('[composition] trip not found', { tripId });
      return;
    }

    const trip = tripResult.rows[0];
    const research = await researchDestinations(trip.destinations || []);
    const versionNumber = await nextVersionNumber(tripId);
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(trip, research);

    const raw = await composeWithSonnet(systemPrompt, userMessage);
    const metadata: Record<string, unknown> = {
      modelId: SONNET_MODEL_ID,
      bedrockConfigured: isBedrockConfigured(),
      promptChars: systemPrompt.length + userMessage.length,
      rawResponseChars: raw.length,
      startedAt: new Date(startedAt).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    };

    if (raw.startsWith(LLM_UNAVAILABLE_PREFIX)) {
      metadata.rawResponse = raw.slice(0, 8000);
      await pool.query(
        `INSERT INTO itinerary_versions (
           trip_id, version_number, version_type, content, status, composition_metadata
         ) VALUES ($1, $2, 'draft', $3::jsonb, 'failed', $4::jsonb)`,
        [
          tripId,
          versionNumber,
          JSON.stringify({ error: 'llm_unavailable', message: raw }),
          JSON.stringify(metadata),
        ]
      );
      console.error('[composition] LLM unavailable', { tripId, raw });
      return;
    }

    let content: ItineraryContent;
    try {
      const parsed = parseModelJson<ItineraryContent>(raw);
      if (!isItineraryContent(parsed)) {
        throw new Error('Parsed JSON missing required itinerary fields');
      }
      content = parsed;
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : String(parseErr);
      metadata.parseError = message;
      metadata.rawResponse = raw.slice(0, 20000);
      await pool.query(
        `INSERT INTO itinerary_versions (
           trip_id, version_number, version_type, content, status, composition_metadata
         ) VALUES ($1, $2, 'draft', $3::jsonb, 'failed_parsing', $4::jsonb)`,
        [
          tripId,
          versionNumber,
          JSON.stringify({ error: 'failed_parsing', message }),
          JSON.stringify(metadata),
        ]
      );
      console.error('[composition] JSON parse failed', { tripId, message });
      return;
    }

    const insert = await pool.query<{ id: string }>(
      `INSERT INTO itinerary_versions (
         trip_id, version_number, version_type, content, status, composition_metadata
       ) VALUES ($1, $2, 'draft', $3::jsonb, 'composed', $4::jsonb)
       RETURNING id`,
      [tripId, versionNumber, JSON.stringify(content), JSON.stringify(metadata)]
    );
    const versionId = insert.rows[0].id;

    // PDF
    let pdfPath: string | null = null;
    try {
      const dir = itineraryDataDir();
      await fs.mkdir(dir, { recursive: true });
      const filename = `${tripId}-v${versionNumber}.pdf`;
      const absolute = path.join(dir, filename);
      const buffer = await renderItineraryPdf(content);
      await fs.writeFile(absolute, buffer);
      pdfPath = absolute;
      await pool.query(
        `UPDATE itinerary_versions
         SET pdf_path = $1, updated_at = NOW()
         WHERE id = $2`,
        [pdfPath, versionId]
      );
    } catch (pdfErr) {
      console.error('[composition] PDF generation failed (continuing):', pdfErr);
    }

    // Draft email
    const appUrl = getAppBaseUrl().replace(/\/$/, '');
    const itineraryUrl = `${appUrl.replace('8081', '3001')}/api/trips/${tripId}/itinerary/pdf`;
    // Prefer API host for PDF download link
    const apiBase =
      process.env.OUTBOUND_API_URL?.trim() ||
      process.env.EXPO_PUBLIC_API_URL?.trim() ||
      'http://localhost:3001';
    const pdfUrl = `${apiBase.replace(/\/$/, '')}/api/trips/${tripId}/itinerary/pdf`;

    const emailContent = itineraryDraftEmail({
      name: trip.client_name,
      tripSummary: `${content.title}\n\n${content.summary}`,
      itineraryUrl: pdfUrl || itineraryUrl,
    });

    const emailResult = await sendEmail({
      to: trip.client_email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!emailResult.ok) {
      console.error('[composition] draft email failed:', emailResult.error);
      // Still mark composed; leave trip as composing for manual retry of delivery
      return;
    }

    await pool.query(
      `UPDATE itinerary_versions
       SET status = 'sent', updated_at = NOW()
       WHERE id = $1`,
      [versionId]
    );
    await pool.query(
      `UPDATE trips
       SET status = 'draft_delivered', updated_at = NOW()
       WHERE id = $1 AND status = 'composing'`,
      [tripId]
    );

    console.info('[composition] complete', {
      tripId,
      versionId,
      versionNumber,
      pdfPath,
      emailSkipped: emailResult.skipped ?? false,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[composition] unexpected failure', { tripId, err });
  }
}

/**
 * Schedule composition off the request cycle (fire-and-forget).
 */
export function scheduleComposeItinerary(tripId: string): void {
  setImmediate(() => {
    void composeItinerary(tripId).catch((err) => {
      console.error('[composition] unhandled', { tripId, err });
    });
  });
}
