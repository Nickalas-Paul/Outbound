import { describe, expect, it } from 'vitest';

import {
  BUDGET_TIERS,
  CROWDING_PREFERENCES,
  DEFAULT_TRAVELER_PREFERENCES,
  EASE_OF_TRAVEL,
  SAFETY_TOLERANCES,
  TRIP_TYPES_PREF,
  preferencesToFilters,
  preferencesToWeights,
  weightSum,
  type TravelerPreferences,
} from './preferences';

const DIMENSION_KEYS = [
  'tourismInfrastructure',
  'accessibility',
  'costIndex',
  'safetyAndEntry',
  'travelInfrastructure',
  'crowding',
  'trajectory',
] as const;

function allCombos(): TravelerPreferences[] {
  const out: TravelerPreferences[] = [];
  for (const tripType of TRIP_TYPES_PREF) {
    for (const budgetTier of BUDGET_TIERS) {
      for (const safetyTolerance of SAFETY_TOLERANCES) {
        for (const crowdingPreference of CROWDING_PREFERENCES) {
          for (const easeOfTravel of EASE_OF_TRAVEL) {
            out.push({
              tripType,
              budgetTier,
              safetyTolerance,
              crowdingPreference,
              easeOfTravel,
            });
          }
        }
      }
    }
  }
  return out;
}

describe('preferencesToWeights', () => {
  it('default preferences produce weights summing to 1.0', () => {
    const w = preferencesToWeights(DEFAULT_TRAVELER_PREFERENCES);
    expect(weightSum(w)).toBeCloseTo(1.0, 5);
  });

  it('every valid preference combination produces normalized weights', () => {
    for (const prefs of allCombos()) {
      const w = preferencesToWeights(prefs);
      expect(weightSum(w)).toBeCloseTo(1.0, 5);
      for (const key of DIMENSION_KEYS) {
        expect(w[key]).toBeGreaterThan(0);
        expect(w[key]).toBeLessThan(1);
      }
    }
  });

  it('extreme luxury + strict + effortless does not produce zeros or negatives', () => {
    const w = preferencesToWeights({
      tripType: 'couple',
      budgetTier: 'luxury',
      safetyTolerance: 'strict',
      crowdingPreference: 'hidden_gems',
      easeOfTravel: 'effortless',
    });
    expect(weightSum(w)).toBeCloseTo(1.0, 5);
    for (const key of DIMENSION_KEYS) {
      expect(w[key]).toBeGreaterThanOrEqual(0.02);
    }
    // Luxury should keep costIndex low but non-zero; tourism/travel elevated
    expect(w.costIndex).toBeLessThan(w.tourismInfrastructure);
    expect(w.safetyAndEntry).toBeGreaterThan(0.1);
    expect(w.accessibility).toBeGreaterThan(0.1);
  });

  it('budget raises costIndex weight vs luxury', () => {
    const budget = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      budgetTier: 'budget',
    });
    const luxury = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      budgetTier: 'luxury',
    });
    expect(budget.costIndex).toBeGreaterThan(luxury.costIndex);
  });

  it('strict raises safety weight vs adventurous', () => {
    const strict = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      safetyTolerance: 'strict',
    });
    const adventurous = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      safetyTolerance: 'adventurous',
    });
    expect(strict.safetyAndEntry).toBeGreaterThan(adventurous.safetyAndEntry);
  });

  it('hidden_gems raises crowding weight vs popular', () => {
    const gems = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      crowdingPreference: 'hidden_gems',
    });
    const popular = preferencesToWeights({
      ...DEFAULT_TRAVELER_PREFERENCES,
      crowdingPreference: 'popular',
    });
    expect(gems.crowding).toBeGreaterThan(popular.crowding);
  });
});

describe('preferencesToFilters', () => {
  it('strict sets safety floor around 60–70', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      safetyTolerance: 'strict',
    });
    expect(f.minSafetyAndEntry).toBeGreaterThanOrEqual(60);
    expect(f.minSafetyAndEntry).toBeLessThanOrEqual(70);
  });

  it('standard sets a lower safety floor (Level 4 only)', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      safetyTolerance: 'standard',
    });
    expect(f.minSafetyAndEntry).toBeDefined();
    expect(f.minSafetyAndEntry!).toBeLessThan(50);
    expect(f.minSafetyAndEntry!).toBeGreaterThanOrEqual(20);
  });

  it('adventurous has no safety floor', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      safetyTolerance: 'adventurous',
    });
    expect(f.minSafetyAndEntry).toBeUndefined();
  });

  it('budget sets affordability floor (minCostIndex)', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      budgetTier: 'budget',
    });
    expect(f.minCostIndex).toBeDefined();
    expect(f.minCostIndex!).toBeGreaterThanOrEqual(70);
    expect(f.minCostIndex!).toBeLessThanOrEqual(90);
  });

  it('moderate budget has no cost floor', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      budgetTier: 'moderate',
    });
    expect(f.minCostIndex).toBeUndefined();
  });

  it('effortless sets accessibility floor', () => {
    const f = preferencesToFilters({
      ...DEFAULT_TRAVELER_PREFERENCES,
      easeOfTravel: 'effortless',
    });
    expect(f.minAccessibility).toBeDefined();
    expect(f.minAccessibility!).toBeGreaterThanOrEqual(35);
  });
});
