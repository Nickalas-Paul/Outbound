import type { GeographyFilters } from '@/services/geographies';
import { DEFAULT_TRAVELER_PROFILE } from '@/lib/travelerProfiles';

export type TimeHorizon = 'current' | '2yr' | '5yr';

export type ExplorerFilterState = {
  profile: string;
  horizon: TimeHorizon;
  minPopulation: number;
  maxCorpTaxRate: number;
  minAccessibility: number;
  maxCrowding: number;
  minSafetyAndEntry: number;
};

export const DEFAULT_FILTERS: ExplorerFilterState = {
  profile: DEFAULT_TRAVELER_PROFILE,
  horizon: 'current',
  minPopulation: 0,
  maxCorpTaxRate: 50,
  minAccessibility: 0,
  maxCrowding: 100,
  minSafetyAndEntry: 0,
};

export const FILTER_LIMITS = {
  minPopulation: { min: 0, max: 100_000_000, step: 1_000_000 },
  maxCorpTaxRate: { min: 0, max: 50, step: 1 },
  minAccessibility: { min: 0, max: 100, step: 1 },
  maxCrowding: { min: 0, max: 100, step: 1 },
  minSafetyAndEntry: { min: 0, max: 100, step: 1 },
} as const;

export function formatPopulation(value: number): string {
  if (value <= 0) return '≥ 0';
  if (value >= 1_000_000_000) return `≥ ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `≥ ${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) return `≥ ${Math.round(value / 1_000)}K`;
  return `≥ ${value}`;
}

export function formatPercentCap(value: number): string {
  return `≤ ${value}%`;
}

export function formatMinScore(value: number): string {
  return `≥ ${value}`;
}

export function formatMaxScore(value: number): string {
  return `≤ ${value}%`;
}

/** Convert UI state to API filter body (omit inactive defaults). */
export function toApiFilters(state: ExplorerFilterState): GeographyFilters {
  const filters: GeographyFilters = {};
  if (state.minPopulation > 0) filters.minPopulation = state.minPopulation;
  if (state.maxCorpTaxRate < FILTER_LIMITS.maxCorpTaxRate.max) {
    filters.maxCorpTaxRate = state.maxCorpTaxRate;
  }
  if (state.minAccessibility > 0) filters.minAccessibility = state.minAccessibility;
  if (state.maxCrowding < 100) {
    filters.maxCrowding = state.maxCrowding;
  }
  if (state.minSafetyAndEntry > 0) filters.minSafetyAndEntry = state.minSafetyAndEntry;
  return filters;
}

export function filtersEqual(a: ExplorerFilterState, b: ExplorerFilterState): boolean {
  return (
    a.profile === b.profile &&
    a.horizon === b.horizon &&
    a.minPopulation === b.minPopulation &&
    a.maxCorpTaxRate === b.maxCorpTaxRate &&
    a.minAccessibility === b.minAccessibility &&
    a.maxCrowding === b.maxCrowding &&
    a.minSafetyAndEntry === b.minSafetyAndEntry
  );
}

function normalizeProfileKey(raw: string | undefined): string {
  if (!raw || raw === 'all_industries' || raw === 'all') {
    return DEFAULT_FILTERS.profile;
  }
  return raw;
}

export function parseFiltersFromParams(
  params: Record<string, string | string[] | undefined>
): ExplorerFilterState {
  const one = (key: string): string | undefined => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const num = (key: string, fallback: number): number => {
    const raw = one(key);
    if (raw == null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const horizonRaw = one('horizon');
  const horizon: TimeHorizon =
    horizonRaw === '2yr' || horizonRaw === '5yr' ? horizonRaw : 'current';

  return {
    profile: normalizeProfileKey(one('profile') ?? one('vertical')),
    horizon,
    minPopulation: num('minPopulation', DEFAULT_FILTERS.minPopulation),
    maxCorpTaxRate: num('maxCorpTaxRate', DEFAULT_FILTERS.maxCorpTaxRate),
    minAccessibility: num('minAccessibility', DEFAULT_FILTERS.minAccessibility),
    maxCrowding: num(
      'maxCrowding',
      DEFAULT_FILTERS.maxCrowding
    ),
    minSafetyAndEntry: num('minSafetyAndEntry', DEFAULT_FILTERS.minSafetyAndEntry),
  };
}

export function filtersToQueryRecord(
  state: ExplorerFilterState
): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.profile !== DEFAULT_FILTERS.profile) {
    out.profile = state.profile;
  }
  if (state.horizon !== DEFAULT_FILTERS.horizon) {
    out.horizon = state.horizon;
  }
  if (state.minPopulation !== DEFAULT_FILTERS.minPopulation) {
    out.minPopulation = String(state.minPopulation);
  }
  if (state.maxCorpTaxRate !== DEFAULT_FILTERS.maxCorpTaxRate) {
    out.maxCorpTaxRate = String(state.maxCorpTaxRate);
  }
  if (state.minAccessibility !== DEFAULT_FILTERS.minAccessibility) {
    out.minAccessibility = String(state.minAccessibility);
  }
  if (state.maxCrowding !== DEFAULT_FILTERS.maxCrowding) {
    out.maxCrowding = String(state.maxCrowding);
  }
  if (state.minSafetyAndEntry !== DEFAULT_FILTERS.minSafetyAndEntry) {
    out.minSafetyAndEntry = String(state.minSafetyAndEntry);
  }
  return out;
}

/** Portable JSONB shape stored in saved_searches.filters. */
export type SavedFilterPayload = {
  population?: number;
  maxCorpTaxRate?: number;
  safetyAndEntry?: number;
  accessibility?: number;
  crowding?: number;
  profile?: string;
  /** @deprecated use profile */
  vertical?: string;
  horizon?: TimeHorizon | string;
  minPopulation?: number;
  minAccessibility?: number;
  maxCrowding?: number;
  minSafetyAndEntry?: number;
  /** @deprecated use profile */
  industryVertical?: string;
};

export function stateToSavedFilters(
  state: ExplorerFilterState
): SavedFilterPayload {
  return {
    population: state.minPopulation,
    maxCorpTaxRate: state.maxCorpTaxRate,
    safetyAndEntry: state.minSafetyAndEntry,
    accessibility: state.minAccessibility,
    crowding: state.maxCrowding,
    profile: state.profile,
    horizon: state.horizon,
  };
}

function numField(
  raw: SavedFilterPayload,
  keys: Array<keyof SavedFilterPayload>,
  fallback: number
): number {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return fallback;
}

export function savedFiltersToState(
  raw: Record<string, unknown> | null | undefined
): ExplorerFilterState {
  const f = (raw ?? {}) as SavedFilterPayload;
  const horizonRaw = f.horizon;
  const horizon: TimeHorizon =
    horizonRaw === '2yr' || horizonRaw === '5yr' ? horizonRaw : 'current';

  const profile = normalizeProfileKey(
    (typeof f.profile === 'string' && f.profile) ||
      (typeof f.vertical === 'string' && f.vertical) ||
      (typeof f.industryVertical === 'string' && f.industryVertical) ||
      undefined
  );

  return {
    profile,
    horizon,
    minPopulation: numField(f, ['population', 'minPopulation'], DEFAULT_FILTERS.minPopulation),
    maxCorpTaxRate: numField(
      f,
      ['maxCorpTaxRate'],
      DEFAULT_FILTERS.maxCorpTaxRate
    ),
    minAccessibility: numField(
      f,
      ['accessibility', 'minAccessibility'],
      DEFAULT_FILTERS.minAccessibility
    ),
    maxCrowding: numField(
      f,
      ['crowding', 'maxCrowding'],
      DEFAULT_FILTERS.maxCrowding
    ),
    minSafetyAndEntry: numField(
      f,
      ['safetyAndEntry', 'minSafetyAndEntry'],
      DEFAULT_FILTERS.minSafetyAndEntry
    ),
  };
}
