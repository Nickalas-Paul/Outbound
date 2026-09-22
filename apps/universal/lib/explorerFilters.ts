import {
  DEFAULT_TRAVELER_PREFERENCES,
  type TravelerPreferences,
} from '@outbound/core';

import type { GeographyFilters } from '@/services/geographies';

/** Explorer state is the consumer preference model (Phase 3). */
export type ExplorerFilterState = TravelerPreferences;

export const DEFAULT_FILTERS: ExplorerFilterState = {
  ...DEFAULT_TRAVELER_PREFERENCES,
};

export function preferencesEqual(
  a: ExplorerFilterState,
  b: ExplorerFilterState
): boolean {
  return (
    a.tripType === b.tripType &&
    a.budgetTier === b.budgetTier &&
    a.safetyTolerance === b.safetyTolerance &&
    a.crowdingPreference === b.crowdingPreference &&
    a.easeOfTravel === b.easeOfTravel
  );
}

/** @deprecated alias — prefer preferencesEqual */
export const filtersEqual = preferencesEqual;

/** Hard filters are derived server-side from preferences; client sends empty. */
export function toApiFilters(_state: ExplorerFilterState): GeographyFilters {
  return {};
}

function one(
  params: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

const TRIP = new Set(['solo', 'couple', 'family', 'group']);
const BUDGET = new Set(['budget', 'moderate', 'upscale', 'luxury']);
const SAFETY = new Set(['adventurous', 'standard', 'strict']);
const CROWDING = new Set(['popular', 'balanced', 'hidden_gems']);
const EASE = new Set(['flexible', 'moderate', 'effortless']);

export function parseFiltersFromParams(
  params: Record<string, string | string[] | undefined>
): ExplorerFilterState {
  const tripType = one(params, 'tripType');
  const budgetTier = one(params, 'budgetTier');
  const safetyTolerance = one(params, 'safetyTolerance');
  const crowdingPreference = one(params, 'crowdingPreference');
  const easeOfTravel = one(params, 'easeOfTravel');

  return {
    tripType: TRIP.has(tripType ?? '')
      ? (tripType as ExplorerFilterState['tripType'])
      : DEFAULT_FILTERS.tripType,
    budgetTier: BUDGET.has(budgetTier ?? '')
      ? (budgetTier as ExplorerFilterState['budgetTier'])
      : DEFAULT_FILTERS.budgetTier,
    safetyTolerance: SAFETY.has(safetyTolerance ?? '')
      ? (safetyTolerance as ExplorerFilterState['safetyTolerance'])
      : DEFAULT_FILTERS.safetyTolerance,
    crowdingPreference: CROWDING.has(crowdingPreference ?? '')
      ? (crowdingPreference as ExplorerFilterState['crowdingPreference'])
      : DEFAULT_FILTERS.crowdingPreference,
    easeOfTravel: EASE.has(easeOfTravel ?? '')
      ? (easeOfTravel as ExplorerFilterState['easeOfTravel'])
      : DEFAULT_FILTERS.easeOfTravel,
  };
}

export function filtersToQueryRecord(
  state: ExplorerFilterState
): Record<string, string> {
  const out: Record<string, string> = {};
  if (state.tripType !== DEFAULT_FILTERS.tripType) out.tripType = state.tripType;
  if (state.budgetTier !== DEFAULT_FILTERS.budgetTier) {
    out.budgetTier = state.budgetTier;
  }
  if (state.safetyTolerance !== DEFAULT_FILTERS.safetyTolerance) {
    out.safetyTolerance = state.safetyTolerance;
  }
  if (state.crowdingPreference !== DEFAULT_FILTERS.crowdingPreference) {
    out.crowdingPreference = state.crowdingPreference;
  }
  if (state.easeOfTravel !== DEFAULT_FILTERS.easeOfTravel) {
    out.easeOfTravel = state.easeOfTravel;
  }
  return out;
}

/** Portable JSONB shape stored in saved_searches.filters. */
export type SavedFilterPayload = {
  preferences?: TravelerPreferences;
  // Legacy fields (pre–preference panel) — ignored on apply
  profile?: string;
  horizon?: string;
  minPopulation?: number;
  minCostIndex?: number;
  minAccessibility?: number;
  maxCrowding?: number;
  minSafetyAndEntry?: number;
};

export function stateToSavedFilters(
  state: ExplorerFilterState
): SavedFilterPayload {
  return { preferences: { ...state } };
}

export function savedFiltersToState(
  raw: Record<string, unknown> | null | undefined
): ExplorerFilterState {
  const f = (raw ?? {}) as SavedFilterPayload;
  if (f.preferences && typeof f.preferences === 'object') {
    return parseFiltersFromParams(
      f.preferences as unknown as Record<string, string | string[] | undefined>
    );
  }
  return { ...DEFAULT_FILTERS };
}
