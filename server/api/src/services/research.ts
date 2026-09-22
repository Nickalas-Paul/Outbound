/**
 * Destination research aggregation for itinerary composition.
 */

import { pool } from '../config/database';
import { STORED_TVI_PROFILE } from '../config/tvi';

export type DestinationSignal = {
  id: string;
  signalType: string;
  title: string;
  description: string | null;
  severity: number | null;
  direction: string;
  source: string;
  expiresAt: string | null;
};

export type DestinationResearch = {
  isoCode: string;
  geographyId: string;
  name: string;
  region: string | null;
  population: number | null;
  tvi: {
    overall: number | null;
    confidence: string | null;
    dimensions: Record<string, number | null> | null;
  };
  signals: DestinationSignal[];
};

/**
 * Aggregate TVI scores, active market signals, and geography metadata for a country.
 * Accepts ISO alpha-2 or alpha-3.
 */
export async function researchDestination(
  isoCode: string
): Promise<DestinationResearch | null> {
  const iso = isoCode.trim().toUpperCase();
  if (!iso) return null;

  const geo = await pool.query<{
    id: string;
    name: string;
    iso_code: string | null;
    region_label: string | null;
    population: string | null;
    overall_score: string | null;
    dimensions: Record<string, number | null> | null;
    confidence: string | null;
  }>(
    `
    SELECT
      g.id,
      g.name,
      g.iso_code,
      g.region_label,
      g.population::text,
      m.overall_score::text,
      m.dimensions,
      m.confidence
    FROM geographies g
    LEFT JOIN destination_scores m
      ON m.geography_id = g.id
     AND m.profile = $2
    WHERE g.region_type = 'country'
      AND (
        upper(g.iso_code) = $1
        OR upper(left(g.iso_code, 2)) = left($1, 2)
      )
    ORDER BY CASE WHEN upper(g.iso_code) = $1 THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [iso, STORED_TVI_PROFILE]
  );

  if (geo.rows.length === 0) return null;
  const row = geo.rows[0];

  const signals = await pool.query<{
    id: string;
    signal_type: string;
    title: string;
    description: string | null;
    severity: number | null;
    direction: string;
    source: string;
    expires_at: Date | null;
  }>(
    `
    SELECT id, signal_type, title, description, severity, direction, source, expires_at
    FROM market_signals
    WHERE geography_id = $1
      AND resolved = false
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY severity DESC NULLS LAST, fetched_at DESC
    LIMIT 25
    `,
    [row.id]
  );

  return {
    isoCode: row.iso_code ?? iso,
    geographyId: row.id,
    name: row.name,
    region: row.region_label,
    population: row.population != null ? Number(row.population) : null,
    tvi: {
      overall: row.overall_score != null ? Number(row.overall_score) : null,
      confidence: row.confidence,
      dimensions: row.dimensions,
    },
    signals: signals.rows.map((s) => ({
      id: s.id,
      signalType: s.signal_type,
      title: s.title,
      description: s.description,
      severity: s.severity,
      direction: s.direction,
      source: s.source,
      expiresAt: s.expires_at ? new Date(s.expires_at).toISOString() : null,
    })),
  };
}

export async function researchDestinations(
  destinations: Array<{ iso?: string; isoCode?: string; name?: string }>
): Promise<DestinationResearch[]> {
  const results: DestinationResearch[] = [];
  for (const d of destinations) {
    const code = (d.iso || d.isoCode || '').trim();
    if (!code) continue;
    const research = await researchDestination(code);
    if (research) results.push(research);
  }
  return results;
}
