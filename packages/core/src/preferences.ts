/**
 * Consumer-facing traveler preferences for the explorer preference panel.
 * Maps to TVI dimension weights + hard exclusion filters (Phase 3).
 */

import type { DimensionKey } from './tviDisplay';

export const TRIP_TYPES_PREF = ['solo', 'couple', 'family', 'group'] as const;
export const BUDGET_TIERS = ['budget', 'moderate', 'upscale', 'luxury'] as const;
export const SAFETY_TOLERANCES = ['adventurous', 'standard', 'strict'] as const;
export const CROWDING_PREFERENCES = ['popular', 'balanced', 'hidden_gems'] as const;
export const EASE_OF_TRAVEL = ['flexible', 'moderate', 'effortless'] as const;

export type TripTypePref = (typeof TRIP_TYPES_PREF)[number];
export type BudgetTier = (typeof BUDGET_TIERS)[number];
export type SafetyTolerance = (typeof SAFETY_TOLERANCES)[number];
export type CrowdingPreference = (typeof CROWDING_PREFERENCES)[number];
export type EaseOfTravel = (typeof EASE_OF_TRAVEL)[number];

export interface TravelerPreferences {
  tripType: TripTypePref;
  budgetTier: BudgetTier;
  safetyTolerance: SafetyTolerance;
  crowdingPreference: CrowdingPreference;
  easeOfTravel: EaseOfTravel;
}

/** Defaults: Solo / $$ / Standard / Balanced / Some Planning */
export const DEFAULT_TRAVELER_PREFERENCES: TravelerPreferences = {
  tripType: 'solo',
  budgetTier: 'moderate',
  safetyTolerance: 'standard',
  crowdingPreference: 'balanced',
  easeOfTravel: 'moderate',
};

export type DimensionWeights = Record<DimensionKey, number>;

export type PreferenceHardFilters = {
  minSafetyAndEntry?: number;
  /**
   * Affordability floor. costIndex is higher = more affordable, so budget
   * travelers require a minimum score (brief called this maxCostIndex).
   */
  minCostIndex?: number;
  minAccessibility?: number;
  maxCrowding?: number;
};

const DIMENSION_KEYS: DimensionKey[] = [
  'tourismInfrastructure',
  'accessibility',
  'costIndex',
  'safetyAndEntry',
  'travelInfrastructure',
  'crowding',
  'trajectory',
];

/** Floor so no dimension collapses to 0 after modifiers. */
const MIN_WEIGHT = 0.02;

/**
 * Base weight profiles by trip type (spirit of TRAVELER_PROFILES).
 * Trajectory is avg(baseSix) * mult, matching server/api withTrajectory.
 */
const BASE_BY_TRIP: Record<
  TripTypePref,
  { base: Omit<DimensionWeights, 'trajectory'>; trajectoryMult: number }
> = {
  solo: {
    // solo_backpacker spirit — cost/safety high, crowding low
    base: {
      tourismInfrastructure: 0.1,
      accessibility: 0.2,
      costIndex: 0.3,
      safetyAndEntry: 0.2,
      travelInfrastructure: 0.1,
      crowding: 0.1,
    },
    trajectoryMult: 1.3,
  },
  couple: {
    base: {
      tourismInfrastructure: 0.15,
      accessibility: 0.15,
      costIndex: 0.15,
      safetyAndEntry: 0.25,
      travelInfrastructure: 0.2,
      crowding: 0.1,
    },
    trajectoryMult: 1.0,
  },
  family: {
    base: {
      tourismInfrastructure: 0.1,
      accessibility: 0.15,
      costIndex: 0.15,
      safetyAndEntry: 0.3,
      travelInfrastructure: 0.2,
      crowding: 0.1,
    },
    trajectoryMult: 0.7,
  },
  group: {
    base: {
      tourismInfrastructure: 0.2,
      accessibility: 0.25,
      costIndex: 0.15,
      safetyAndEntry: 0.15,
      travelInfrastructure: 0.15,
      crowding: 0.1,
    },
    trajectoryMult: 1.0,
  },
};

function withTrajectory(
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

function clampMin(weights: DimensionWeights): DimensionWeights {
  const next = { ...weights };
  for (const key of DIMENSION_KEYS) {
    if (next[key] < MIN_WEIGHT) next[key] = MIN_WEIGHT;
  }
  return next;
}

/** Normalize so weights sum to exactly 1.0 (within float rounding). */
export function normalizeWeights(weights: DimensionWeights): DimensionWeights {
  const sum = DIMENSION_KEYS.reduce((acc, k) => acc + weights[k], 0);
  if (sum <= 0) {
    const equal = 1 / DIMENSION_KEYS.length;
    return Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, equal])
    ) as DimensionWeights;
  }
  const out = {} as DimensionWeights;
  let running = 0;
  for (let i = 0; i < DIMENSION_KEYS.length; i++) {
    const key = DIMENSION_KEYS[i];
    if (i === DIMENSION_KEYS.length - 1) {
      // Absorb float remainder on last key
      out[key] = Math.round((1 - running) * 1e6) / 1e6;
    } else {
      const w = Math.round((weights[key] / sum) * 1e6) / 1e6;
      out[key] = w;
      running += w;
    }
  }
  return out;
}

export function weightSum(weights: DimensionWeights): number {
  return DIMENSION_KEYS.reduce((acc, k) => acc + weights[k], 0);
}

/**
 * Map traveler preferences → dimension weight vector (sums to 1.0).
 */
export function preferencesToWeights(
  prefs: TravelerPreferences
): DimensionWeights {
  const { base, trajectoryMult } = BASE_BY_TRIP[prefs.tripType];
  let w = withTrajectory({ ...base }, trajectoryMult);

  // budgetTier → costIndex (+ tourismInfra for luxury)
  switch (prefs.budgetTier) {
    case 'budget':
      w.costIndex *= 1.55;
      break;
    case 'moderate':
      break;
    case 'upscale':
      w.costIndex *= 0.65;
      break;
    case 'luxury':
      w.costIndex *= 0.2;
      w.tourismInfrastructure *= 1.35;
      w.travelInfrastructure *= 1.2;
      break;
  }

  // safetyTolerance → safetyAndEntry
  switch (prefs.safetyTolerance) {
    case 'adventurous':
      w.safetyAndEntry *= 0.55;
      break;
    case 'standard':
      break;
    case 'strict':
      w.safetyAndEntry *= 1.45;
      break;
  }

  // crowdingPreference — score is higher = less crowded
  switch (prefs.crowdingPreference) {
    case 'popular':
      // Care less about uncrowded score (prefer / accept iconic destinations)
      w.crowding *= 0.45;
      break;
    case 'balanced':
      break;
    case 'hidden_gems':
      w.crowding *= 1.6;
      break;
  }

  // easeOfTravel → accessibility
  switch (prefs.easeOfTravel) {
    case 'flexible':
      w.accessibility *= 0.55;
      break;
    case 'moderate':
      break;
    case 'effortless':
      w.accessibility *= 1.45;
      break;
  }

  return normalizeWeights(clampMin(w));
}

/**
 * Hard exclusion thresholds calibrated against destination_scores (balanced):
 *   safety p10≈22, p25≈43, p50≈60
 *   costIndex p10≈73, p25≈82, p50≈92  (higher = more affordable)
 *   accessibility p25≈28, p50≈44
 *   crowding p10≈79, p50≈98          (higher = less crowded)
 */
export function preferencesToFilters(
  prefs: TravelerPreferences
): PreferenceHardFilters {
  const out: PreferenceHardFilters = {};

  switch (prefs.safetyTolerance) {
    case 'strict':
      // ~median — filters weaker safety (Level 3+ advisory territory)
      out.minSafetyAndEntry = 60;
      break;
    case 'standard':
      // ~p10–p25 — Level 4 / Do Not Travel only
      out.minSafetyAndEntry = 30;
      break;
    case 'adventurous':
      // No hard floor (UI may still flag Level 4)
      break;
  }

  if (prefs.budgetTier === 'budget') {
    // Affordability floor — exclude least-affordable quartile
    out.minCostIndex = 82;
  }

  if (prefs.easeOfTravel === 'effortless') {
    out.minAccessibility = 40;
  }

  // Crowding hard filter: higher score = less crowded.
  // hidden_gems leans on weights; optional soft cap unused.
  // popular: no hard filter (weights already de-emphasize uncrowded score).

  return out;
}

/** Runtime type guard for API / client payloads. */
export function isTravelerPreferences(raw: unknown): raw is TravelerPreferences {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    TRIP_TYPES_PREF.includes(o.tripType as TripTypePref) &&
    BUDGET_TIERS.includes(o.budgetTier as BudgetTier) &&
    SAFETY_TOLERANCES.includes(o.safetyTolerance as SafetyTolerance) &&
    CROWDING_PREFERENCES.includes(o.crowdingPreference as CrowdingPreference) &&
    EASE_OF_TRAVEL.includes(o.easeOfTravel as EaseOfTravel)
  );
}

/** Parse preferences from an unknown payload; returns null if invalid. */
export function parseTravelerPreferences(
  raw: unknown
): TravelerPreferences | null {
  if (isTravelerPreferences(raw)) return raw;
  return null;
}
