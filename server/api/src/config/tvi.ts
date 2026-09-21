/**
 * TVI display metadata for the API.
 *
 * COUPLING NOTE: Indicator weights / keys must stay aligned with
 * server/workers/scoring_config.py (source of truth for compute_tvi.py).
 * This file is the source of truth for client-facing labels and descriptions.
 * Sync manually when either side changes.
 */

import {
  INDUSTRY_VERTICAL_KEYS,
  INDUSTRY_VERTICAL_LABELS,
  type IndustryVerticalKey,
} from '@outbound/core';

export const TVI_SCORING_VERSION = '0.1.0';

export type DimensionKey =
  | 'tourismInfrastructure'
  | 'accessibility'
  | 'costIndex'
  | 'safetyAndEntry'
  | 'travelInfrastructure'
  | 'crowding'
  | 'trajectory';

export interface IndicatorMeta {
  source: string;
  code: string;
  name: string;
  weight: number;
  isProxy?: boolean;
}

export interface DimensionMeta {
  key: DimensionKey;
  label: string;
  description: string;
  indicators: IndicatorMeta[];
  /** True when the dimension is derived from trend_scores, not raw indicators. */
  isComposite?: boolean;
}

export const TVI_DIMENSIONS: DimensionMeta[] = [
  {
    key: 'tourismInfrastructure',
    label: 'Tourism Infrastructure & Capacity',
    description:
      'Visitor volume, air connectivity, and tourism spend that indicate destination capacity and maturity',
    indicators: [
      {
        source: 'world_bank',
        code: 'ST.INT.ARVL',
        name: 'International tourism, number of arrivals',
        weight: 0.35,
      },
      {
        source: 'world_bank',
        code: 'IS.AIR.DPRT',
        name: 'Air transport, registered carrier departures worldwide',
        weight: 0.25,
      },
      {
        source: 'world_bank',
        code: 'ST.INT.TVLX.CD',
        name: 'International tourism, expenditures (current US$)',
        weight: 0.25,
      },
      {
        source: 'world_bank_derived',
        code: 'tourism_receipts_per_arrival',
        name: 'Tourism receipts per arrival',
        weight: 0.15,
      },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility & Ease of Travel',
    description:
      'Visa openness, digital connectivity, and environmental quality that affect how easily travelers can visit and navigate a destination',
    indicators: [
      {
        source: 'ef_epi',
        code: 'ef_epi_score',
        name: 'Environmental Performance Index score',
        weight: 0.3,
      },
      {
        source: 'visa_index',
        code: 'visa_free_score',
        name: 'Visa-free access score',
        weight: 0.3,
      },
      {
        source: 'world_bank',
        code: 'IT.NET.USER.ZS',
        name: 'Internet users (% of population)',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'IT.CEL.SETS.P2',
        name: 'Mobile cellular subscriptions (per 100 people)',
        weight: 0.2,
      },
    ],
  },
  {
    key: 'costIndex',
    label: 'Cost Index',
    description:
      'Relative cost of visiting and operating in a destination — purchasing power, inflation, tourism spend intensity, and FX volatility',
    indicators: [
      {
        source: 'world_bank_derived',
        code: 'gdp_ppp_per_capita',
        name: 'GDP PPP per capita',
        weight: 0.3,
      },
      {
        source: 'world_bank',
        code: 'FP.CPI.TOTL',
        name: 'Consumer price index (2010 = 100)',
        weight: 0.3,
      },
      {
        source: 'world_bank_derived',
        code: 'tourism_receipts_per_arrival',
        name: 'Tourism receipts per arrival',
        weight: 0.2,
      },
      {
        source: 'ecb_fx_derived',
        code: 'fx_volatility',
        name: 'FX volatility (USD cross)',
        weight: 0.2,
      },
    ],
  },
  {
    key: 'safetyAndEntry',
    label: 'Entry Requirements & Safety',
    description:
      'Travel advisories, political stability, rule of law, corruption control, and visa openness for entry risk',
    indicators: [
      {
        source: 'state_dept_advisory',
        code: 'travel_advisory_level',
        name: 'US State Department travel advisory level',
        weight: 0.3,
      },
      {
        source: 'world_bank',
        code: 'RL.PER.RNK',
        name: 'Rule of Law (WGI Percentile)',
        weight: 0.2,
      },
      {
        source: 'transparency',
        code: 'CC.PER.RNK',
        name: 'Control of Corruption (WGI score)',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'PV.PER.RNK',
        name: 'Political Stability / Absence of Violence (WGI Percentile)',
        weight: 0.2,
      },
      {
        source: 'visa_index',
        code: 'visa_free_score',
        name: 'Visa-free access score',
        weight: 0.1,
      },
    ],
  },
  {
    key: 'travelInfrastructure',
    label: 'Travel Infrastructure',
    description:
      'Power, connectivity, logistics, and healthcare capacity that support traveler movement and operations',
    indicators: [
      {
        source: 'world_bank',
        code: 'EG.ELC.ACCS.ZS',
        name: 'Access to electricity (% of population)',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'IT.NET.USER.ZS',
        name: 'Internet users (% of population)',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'IT.NET.BBND.P2',
        name: 'Fixed broadband subscriptions (per 100 people)',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'LP.LPI.OVRL.XQ',
        name: 'Logistics Performance Index',
        weight: 0.2,
      },
      {
        source: 'world_bank',
        code: 'SH.MED.PHYS.ZS',
        name: 'Physicians (per 1,000 people)',
        weight: 0.2,
      },
    ],
  },
  {
    key: 'crowding',
    label: 'Tourism Crowding',
    description:
      'Tourist intensity relative to population — higher crowding scores mean denser visitor pressure',
    indicators: [
      {
        source: 'world_bank_derived',
        code: 'tourist_arrivals_per_capita',
        name: 'Tourist arrivals per capita',
        weight: 0.55,
      },
      {
        source: 'world_bank_derived',
        code: 'tourism_receipts_per_capita',
        name: 'Tourism receipts per capita',
        weight: 0.45,
      },
    ],
  },
  {
    key: 'trajectory',
    label: 'Trajectory',
    description:
      'Composite momentum score derived from trend direction and rate across all other dimensions',
    indicators: [],
    isComposite: true,
  },
];

export const SOURCE_CATALOG: Record<
  string,
  { name: string; url: string; refreshCadence: string }
> = {
  world_bank: {
    name: 'World Bank Open Data',
    url: 'https://data.worldbank.org',
    refreshCadence: 'Annual',
  },
  world_bank_derived: {
    name: 'World Bank derived ratios',
    url: 'https://data.worldbank.org',
    refreshCadence: 'Annual',
  },
  ef_epi: {
    name: 'Yale Environmental Performance Index',
    url: 'https://epi.yale.edu/',
    refreshCadence: 'Biennial',
  },
  visa_index: {
    name: 'Visa / passport openness indexes',
    url: 'https://www.passportindex.org/',
    refreshCadence: 'Annual',
  },
  state_dept_advisory: {
    name: 'US State Department travel advisories',
    url: 'https://travel.state.gov/',
    refreshCadence: 'Continuous',
  },
  transparency: {
    name: 'WGI Control of Corruption',
    url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
    refreshCadence: 'Annual',
  },
  ecb_fx_derived: {
    name: 'ECB / Frankfurter FX (derived)',
    url: 'https://www.frankfurter.app/',
    refreshCadence: 'Daily → monthly aggregate',
  },
};

/** DB key used by compute_tvi.py / destination_scores.industry_vertical (equal-weight batch). */
export const STORED_TVI_VERTICAL = 'all_industries';

export type DimensionWeights = Record<DimensionKey, number>;

export interface IndustryVertical {
  key: IndustryVerticalKey;
  label: string;
  weights: DimensionWeights;
}

/**
 * Industry vertical weight profiles for on-the-fly overall TVI recomputation.
 * COUPLING: TypeScript vertical keys/labels now live in @outbound/core (verticals.ts).
 * Weights remain here. Keep in sync with server/workers/scoring_config.py INDUSTRY_VERTICALS.
 * Dimension scores are stored once (equal-weight); overall is reweighted at query time.
 *
 * Trajectory multipliers (relative to avg of the original six):
 *   tech_saas / telecom → 1.3; manufacturing / energy → 0.7; else → 1.0
 */
/** Add trajectory weight = avg(base) * multiplier (rounded to 3 decimals). */
export function withTrajectory(
  weights: Omit<DimensionWeights, 'trajectory'>,
  trajectoryMult: number
): DimensionWeights {
  const values = Object.values(weights);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    ...weights,
    trajectory: Math.round(avg * trajectoryMult * 1000) / 1000,
  };
}

export const INDUSTRY_VERTICALS: IndustryVertical[] = [
  {
    key: 'all',
    label: INDUSTRY_VERTICAL_LABELS['all'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.167,
        accessibility: 0.167,
        costIndex: 0.167,
        safetyAndEntry: 0.167,
        travelInfrastructure: 0.167,
        crowding: 0.167,
      },
      1.0
    ),
  },
  {
    key: 'tech_saas',
    label: INDUSTRY_VERTICAL_LABELS['tech_saas'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.15,
        accessibility: 0.25,
        costIndex: 0.15,
        safetyAndEntry: 0.1,
        travelInfrastructure: 0.2,
        crowding: 0.15,
      },
      1.3
    ),
  },
  {
    key: 'financial',
    label: INDUSTRY_VERTICAL_LABELS['financial'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.2,
        accessibility: 0.15,
        costIndex: 0.2,
        safetyAndEntry: 0.25,
        travelInfrastructure: 0.1,
        crowding: 0.1,
      },
      1.0
    ),
  },
  {
    key: 'manufacturing',
    label: INDUSTRY_VERTICAL_LABELS['manufacturing'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.15,
        accessibility: 0.1,
        costIndex: 0.15,
        safetyAndEntry: 0.2,
        travelInfrastructure: 0.25,
        crowding: 0.15,
      },
      0.7
    ),
  },
  {
    key: 'healthcare',
    label: INDUSTRY_VERTICAL_LABELS['healthcare'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.2,
        accessibility: 0.2,
        costIndex: 0.1,
        safetyAndEntry: 0.25,
        travelInfrastructure: 0.15,
        crowding: 0.1,
      },
      1.0
    ),
  },
  {
    key: 'ecommerce',
    label: INDUSTRY_VERTICAL_LABELS['ecommerce'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.25,
        accessibility: 0.1,
        costIndex: 0.15,
        safetyAndEntry: 0.1,
        travelInfrastructure: 0.25,
        crowding: 0.15,
      },
      1.0
    ),
  },
  {
    key: 'energy',
    label: INDUSTRY_VERTICAL_LABELS['energy'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.15,
        accessibility: 0.1,
        costIndex: 0.15,
        safetyAndEntry: 0.25,
        travelInfrastructure: 0.25,
        crowding: 0.1,
      },
      0.7
    ),
  },
  {
    key: 'professional',
    label: INDUSTRY_VERTICAL_LABELS['professional'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.15,
        accessibility: 0.3,
        costIndex: 0.15,
        safetyAndEntry: 0.15,
        travelInfrastructure: 0.1,
        crowding: 0.15,
      },
      1.0
    ),
  },
  {
    key: 'logistics',
    label: INDUSTRY_VERTICAL_LABELS['logistics'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.2,
        accessibility: 0.05,
        costIndex: 0.15,
        safetyAndEntry: 0.15,
        travelInfrastructure: 0.35,
        crowding: 0.1,
      },
      1.0
    ),
  },
  {
    key: 'telecom',
    label: INDUSTRY_VERTICAL_LABELS['telecom'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.2,
        accessibility: 0.15,
        costIndex: 0.1,
        safetyAndEntry: 0.2,
        travelInfrastructure: 0.25,
        crowding: 0.1,
      },
      1.3
    ),
  },
  {
    key: 'consumer_goods',
    label: INDUSTRY_VERTICAL_LABELS['consumer_goods'],
    weights: withTrajectory(
      {
        tourismInfrastructure: 0.25,
        accessibility: 0.1,
        costIndex: 0.1,
        safetyAndEntry: 0.15,
        travelInfrastructure: 0.2,
        crowding: 0.2,
      },
      1.0
    ),
  },
];

if (INDUSTRY_VERTICALS.length !== INDUSTRY_VERTICAL_KEYS.length) {
  throw new Error(
    'INDUSTRY_VERTICALS length must match INDUSTRY_VERTICAL_KEYS from @outbound/core'
  );
}

export const DEFAULT_VERTICAL = 'all';

const VERTICAL_BY_KEY = new Map<string, IndustryVertical>(
  INDUSTRY_VERTICALS.map((v) => [v.key, v])
);

export function resolveVerticalKey(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_VERTICAL;
  const key = raw.trim();
  // Legacy DB / URL alias
  if (key === 'all_industries') return DEFAULT_VERTICAL;
  if (VERTICAL_BY_KEY.has(key)) return key;
  return DEFAULT_VERTICAL;
}

export function getVerticalWeights(verticalKey: string): DimensionWeights {
  const resolved = resolveVerticalKey(verticalKey);
  return (
    VERTICAL_BY_KEY.get(resolved)?.weights ??
    VERTICAL_BY_KEY.get(DEFAULT_VERTICAL)!.weights
  );
}

/**
 * Weighted overall from stored dimension scores using an explicit weight map.
 * Renormalizes over non-null dimensions (same math as query-time reweighting).
 */
export function computeWeightedOverallWithWeights(
  dimensions: Partial<Record<DimensionKey, number | null>> | null | undefined,
  weights: DimensionWeights
): number | null {
  if (!dimensions) return null;
  let numerator = 0;
  let denominator = 0;
  (Object.keys(weights) as DimensionKey[]).forEach((key) => {
    const raw = dimensions[key];
    if (raw == null) return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    const w = weights[key];
    numerator += value * w;
    denominator += w;
  });
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

/** Weighted overall from stored dimension scores; renormalizes over non-null dims. */
export function computeWeightedOverall(
  dimensions: Partial<Record<DimensionKey, number | null>> | null | undefined,
  verticalKey: string = DEFAULT_VERTICAL
): number | null {
  if (!dimensions) return null;
  return computeWeightedOverallWithWeights(
    dimensions,
    getVerticalWeights(verticalKey)
  );
}
