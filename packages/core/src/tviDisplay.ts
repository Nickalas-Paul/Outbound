/**
 * Client-facing TVI display metadata.
 * Keep labels/descriptions/indicators aligned with:
 *   - server/api/src/config/tvi.ts
 *   - server/workers/scoring_config.py
 *
 * Phase 1 Step 3: travel-intelligence dimensions (Outbound).
 */

export type DimensionKey =
  | 'tourismInfrastructure'
  | 'accessibility'
  | 'costIndex'
  | 'safetyAndEntry'
  | 'travelInfrastructure'
  | 'crowding'
  | 'trajectory';

export type IndicatorDirection = 'higher_is_better' | 'lower_is_better';
export type IndicatorNormalization = 'linear' | 'log_scale';

export type IndicatorDisplay = {
  code: string;
  name: string;
  source: string;
  weight: number;
  direction: IndicatorDirection;
  normalization: IndicatorNormalization;
  isProxy?: boolean;
  notes?: string;
};

export type DimensionDisplay = {
  key: DimensionKey;
  label: string;
  description: string;
  /** Indicator codes that belong to this dimension (for source filtering). */
  indicatorCodes: string[];
  indicators: IndicatorDisplay[];
  /** True when derived from trend_scores rather than raw indicators. */
  isComposite?: boolean;
};

export const TVI_DIMENSION_DISPLAY: DimensionDisplay[] = [
  {
    key: 'tourismInfrastructure',
    label: 'Tourism Infrastructure & Capacity',
    description:
      'Visitor volume, air connectivity, and tourism spend that indicate destination capacity and maturity',
    indicatorCodes: [
      'ST.INT.ARVL',
      'IS.AIR.DPRT',
      'ST.INT.TVLX.CD',
      'tourism_receipts_per_arrival',
      'unesco_site_count',
    ],
    indicators: [
      {
        code: 'ST.INT.ARVL',
        name: 'International tourism, number of arrivals',
        source: 'world_bank',
        weight: 0.3,
        direction: 'higher_is_better',
        normalization: 'log_scale',
      },
      {
        code: 'IS.AIR.DPRT',
        name: 'Air transport, registered carrier departures worldwide',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'log_scale',
      },
      {
        code: 'ST.INT.TVLX.CD',
        name: 'International tourism, expenditures (current US$)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'log_scale',
      },
      {
        code: 'tourism_receipts_per_arrival',
        name: 'Tourism receipts per arrival',
        source: 'world_bank_derived',
        weight: 0.1,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'unesco_site_count',
        name: 'UNESCO World Heritage site count',
        source: 'unesco',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'log_scale',
      },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility & Ease of Travel',
    description:
      'Visa openness, digital connectivity, and English proficiency that affect how easily travelers can visit and navigate a destination',
    indicatorCodes: [
      'ef_epi_score',
      'visa_free_score',
      'IT.NET.USER.ZS',
      'IT.CEL.SETS.P2',
    ],
    indicators: [
      {
        code: 'ef_epi_score',
        name: 'EF English Proficiency Index score',
        source: 'ef_epi',
        weight: 0.3,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'visa_free_score',
        name: 'Visa-free access score',
        source: 'visa_index',
        weight: 0.3,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'IT.NET.USER.ZS',
        name: 'Internet users (% of population)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'IT.CEL.SETS.P2',
        name: 'Mobile cellular subscriptions (per 100 people)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
    ],
  },
  {
    key: 'costIndex',
    label: 'Cost Index',
    description:
      'Relative cost of visiting and operating in a destination — purchasing power, inflation, tourism spend intensity, and FX volatility',
    indicatorCodes: [
      'gdp_ppp_per_capita',
      'FP.CPI.TOTL',
      'tourism_receipts_per_arrival',
      'fx_volatility',
    ],
    indicators: [
      {
        code: 'gdp_ppp_per_capita',
        name: 'GDP PPP per capita',
        source: 'world_bank_derived',
        weight: 0.3,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'FP.CPI.TOTL',
        name: 'Consumer price index (2010 = 100)',
        source: 'world_bank',
        weight: 0.3,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'tourism_receipts_per_arrival',
        name: 'Tourism receipts per arrival',
        source: 'world_bank_derived',
        weight: 0.2,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'fx_volatility',
        name: 'FX volatility (USD cross)',
        source: 'ecb_fx_derived',
        weight: 0.2,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
    ],
  },
  {
    key: 'safetyAndEntry',
    label: 'Entry Requirements & Safety',
    description:
      'Travel advisories, political stability, rule of law, corruption control, and visa openness for entry risk',
    indicatorCodes: [
      'travel_advisory_level',
      'fcdo_advisory_level',
      'RL.PER.RNK',
      'CC.PER.RNK',
      'PV.PER.RNK',
      'visa_free_score',
    ],
    indicators: [
      {
        code: 'travel_advisory_level',
        name: 'US State Department travel advisory level',
        source: 'state_dept_advisory',
        weight: 0.22,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'fcdo_advisory_level',
        name: 'UK FCDO travel advisory level',
        source: 'fcdo',
        weight: 0.18,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'RL.PER.RNK',
        name: 'Rule of Law (WGI Percentile)',
        source: 'world_bank',
        weight: 0.18,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'CC.PER.RNK',
        name: 'Control of Corruption (WGI score)',
        source: 'transparency',
        weight: 0.15,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'PV.PER.RNK',
        name: 'Political Stability / Absence of Violence (WGI Percentile)',
        source: 'world_bank',
        weight: 0.17,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'visa_free_score',
        name: 'Visa-free access score',
        source: 'visa_index',
        weight: 0.1,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
    ],
  },
  {
    key: 'travelInfrastructure',
    label: 'Travel Infrastructure',
    description:
      'Power, connectivity, logistics, and healthcare capacity that support traveler movement and operations',
    indicatorCodes: [
      'EG.ELC.ACCS.ZS',
      'IT.NET.USER.ZS',
      'IT.NET.BBND.P2',
      'LP.LPI.OVRL.XQ',
      'SH.MED.PHYS.ZS',
    ],
    indicators: [
      {
        code: 'EG.ELC.ACCS.ZS',
        name: 'Access to electricity (% of population)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'IT.NET.USER.ZS',
        name: 'Internet users (% of population)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'IT.NET.BBND.P2',
        name: 'Fixed broadband subscriptions (per 100 people)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'LP.LPI.OVRL.XQ',
        name: 'Logistics Performance Index',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
      {
        code: 'SH.MED.PHYS.ZS',
        name: 'Physicians (per 1,000 people)',
        source: 'world_bank',
        weight: 0.2,
        direction: 'higher_is_better',
        normalization: 'linear',
      },
    ],
  },
  {
    key: 'crowding',
    label: 'Tourism Crowding',
    description:
      'Tourist intensity relative to population — higher scores mean less crowded destinations (lower pressure is better)',
    indicatorCodes: [
      'tourist_arrivals_per_capita',
      'tourism_receipts_per_capita',
    ],
    indicators: [
      {
        code: 'tourist_arrivals_per_capita',
        name: 'Tourist arrivals per capita',
        source: 'world_bank_derived',
        weight: 0.55,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
      {
        code: 'tourism_receipts_per_capita',
        name: 'Tourism receipts per capita',
        source: 'world_bank_derived',
        weight: 0.45,
        direction: 'lower_is_better',
        normalization: 'linear',
      },
    ],
  },
  {
    key: 'trajectory',
    label: 'Trajectory',
    description:
      'Composite momentum score derived from trend direction and rate across all other dimensions',
    indicatorCodes: [],
    indicators: [],
    isComposite: true,
  },
];

/** Short source labels for pills on the detail / methodology pages. */
export const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  world_bank: 'World Bank',
  world_bank_derived: 'World Bank (derived)',
  ef_epi: 'EF EPI',
  visa_index: 'Visa Index',
  transparency: 'WGI / Transparency',
  state_dept_advisory: 'US State Dept',
  fcdo: 'UK FCDO',
  unesco: 'UNESCO',
  ecb_fx_derived: 'ECB FX (derived)',
};

export type SourceCatalogEntry = {
  key: string;
  name: string;
  role: string;
  coverageApprox: string;
  refreshCadence: string;
};

/** Active source catalog for methodology / docs surfaces. */
export const TVI_SOURCE_CATALOG: SourceCatalogEntry[] = [
  {
    key: 'world_bank',
    name: 'World Bank Open Data',
    role: 'Tourism arrivals/expenditures, air departures, connectivity, LPI, CPI, WGI, healthcare',
    coverageApprox: '~150–200 countries',
    refreshCadence: 'Annual',
  },
  {
    key: 'world_bank_derived',
    name: 'World Bank derived ratios',
    role: 'Receipts per arrival, arrivals/receipts per capita, GDP PPP per capita',
    coverageApprox: 'Where underlying series exist',
    refreshCadence: 'Annual',
  },
  {
    key: 'ef_epi',
    name: 'EF English Proficiency Index',
    role: 'English proficiency for accessibility / ease of travel',
    coverageApprox: '~110 countries',
    refreshCadence: 'Annual',
  },
  {
    key: 'visa_index',
    name: 'Visa / passport openness indexes',
    role: 'Visa-free access scoring',
    coverageApprox: '~190 countries',
    refreshCadence: 'Annual',
  },
  {
    key: 'state_dept_advisory',
    name: 'US State Department travel advisories',
    role: 'Advisory level for entry/safety',
    coverageApprox: 'Global destinations',
    refreshCadence: 'Continuous',
  },
  {
    key: 'fcdo',
    name: 'UK FCDO travel advice',
    role: 'UK advisory level for entry/safety',
    coverageApprox: 'Global destinations',
    refreshCadence: 'Continuous',
  },
  {
    key: 'unesco',
    name: 'UNESCO World Heritage List',
    role: 'Heritage site count for tourism infrastructure',
    coverageApprox: '~170 countries with sites',
    refreshCadence: 'Annual',
  },
  {
    key: 'transparency',
    name: 'WGI Control of Corruption',
    role: 'Governance / safety dimension',
    coverageApprox: '~200 countries',
    refreshCadence: 'Annual',
  },
  {
    key: 'ecb_fx_derived',
    name: 'ECB / Frankfurter FX (derived)',
    role: 'Currency volatility for cost index',
    coverageApprox: 'Major USD crosses',
    refreshCadence: 'Daily → monthly aggregate',
  },
];

export const TVI_SCORING_VERSION_LABEL = '0.1.0';

export function sourceDisplayName(sourceKey: string): string {
  return SOURCE_DISPLAY_NAMES[sourceKey] ?? sourceKey;
}

export function getDimensionDisplay(key: string): DimensionDisplay | undefined {
  return TVI_DIMENSION_DISPLAY.find((d) => d.key === key);
}

/**
 * Travel-priority UI order for destination detail / trends.
 * Safety & cost first; crowding & trajectory last.
 */
export const TVI_UI_DIMENSION_ORDER: DimensionKey[] = [
  'safetyAndEntry',
  'costIndex',
  'tourismInfrastructure',
  'accessibility',
  'travelInfrastructure',
  'crowding',
  'trajectory',
];

export function getOrderedDimensionDisplay(): DimensionDisplay[] {
  const byKey = new Map(TVI_DIMENSION_DISPLAY.map((d) => [d.key, d]));
  return TVI_UI_DIMENSION_ORDER.map((k) => byKey.get(k)).filter(
    (d): d is DimensionDisplay => Boolean(d)
  );
}

export function formatNormalization(n: IndicatorNormalization): string {
  return n === 'log_scale' ? 'Log scale' : 'Linear';
}

export function formatDirection(d: IndicatorDirection): string {
  return d === 'lower_is_better' ? 'Lower is better' : 'Higher is better';
}
