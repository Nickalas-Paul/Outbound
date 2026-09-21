/**
 * Golden-fixture tests for query-time TVI profile reweighting.
 *
 * Dimension keys are the Phase 1 Step 3 travel vocabulary
 * (`tourismInfrastructure`, `accessibility`, …).
 */

import { describe, expect, it } from 'vitest';
import {
  computeWeightedOverall,
  computeWeightedOverallWithWeights,
  getVerticalWeights,
  withTrajectory,
  type DimensionKey,
  type DimensionWeights,
} from '../config/tvi';

/** Shared synthetic dimension scores for reweight fixtures. */
const SCORES: Record<DimensionKey, number> = {
  tourismInfrastructure: 80,
  accessibility: 60,
  costIndex: 70,
  safetyAndEntry: 90,
  travelInfrastructure: 50,
  crowding: 40,
  trajectory: 65,
};

const EQUAL_WEIGHTS: DimensionWeights = withTrajectory(
  {
    tourismInfrastructure: 0.167,
    accessibility: 0.167,
    costIndex: 0.167,
    safetyAndEntry: 0.167,
    travelInfrastructure: 0.167,
    crowding: 0.167,
  },
  1.0
);

describe('computeWeightedOverall — golden fixtures', () => {
  it('reweights with equal weights (all / 0.167 each)', () => {
    // 0.167 * (80+60+70+90+50+40+65) / (0.167*7) = 455/7 = 65
    const overall = computeWeightedOverall(SCORES, 'all');
    expect(overall).toBe(65);

    // Same math via explicit equal weights
    expect(computeWeightedOverallWithWeights(SCORES, EQUAL_WEIGHTS)).toBe(65);
  });

  it('reweights with skewed weights toward highest-scoring dimension', () => {
    // safetyAndEntry = 90 heavily weighted at 0.40; others 0.10
    const skewed: DimensionWeights = {
      tourismInfrastructure: 0.1,
      accessibility: 0.1,
      costIndex: 0.1,
      safetyAndEntry: 0.4,
      travelInfrastructure: 0.1,
      crowding: 0.1,
      trajectory: 0.1,
    };

    // 8+6+7+36+5+4+6.5 = 72.5
    const overall = computeWeightedOverallWithWeights(SCORES, skewed);
    expect(overall).toBe(72.5);

    // Skew pulls overall toward safetyAndEntry (90) vs equal-weight 65
    expect(overall).toBeGreaterThan(65);
  });

  it('renormalizes when some dimensions are null', () => {
    const partial: Partial<Record<DimensionKey, number | null>> = {
      tourismInfrastructure: 80,
      accessibility: 60,
      costIndex: 70,
      safetyAndEntry: 90,
      travelInfrastructure: 50,
      crowding: null,
      trajectory: null,
    };

    // Equal weights over 5 non-null dims → (80+60+70+90+50)/5 = 70
    const overall = computeWeightedOverallWithWeights(partial, EQUAL_WEIGHTS);
    expect(overall).toBe(70);
  });

  it('applies trajectory multiplier 1.3 (tech_saas profile)', () => {
    const base = {
      tourismInfrastructure: 0.15,
      accessibility: 0.25,
      costIndex: 0.15,
      safetyAndEntry: 0.1,
      travelInfrastructure: 0.2,
      crowding: 0.15,
    };
    const weights = withTrajectory(base, 1.3);

    // avg(base) = 1/6 ≈ 0.166667; trajectory = round(0.166667*1.3*1000)/1000 = 0.217
    expect(weights.trajectory).toBe(0.217);

    // Match published tech_saas profile
    expect(getVerticalWeights('tech_saas')).toEqual(weights);

    const scores: Record<DimensionKey, number> = {
      ...SCORES,
      trajectory: 80,
    };

    // num = 80*0.15 + 60*0.25 + 70*0.15 + 90*0.1 + 50*0.2 + 40*0.15 + 80*0.217
    //     = 12 + 15 + 10.5 + 9 + 10 + 6 + 17.36 = 79.86
    // den = 1.217 → 79.86/1.217 ≈ 65.62038 → rounded 65.62
    const overall = computeWeightedOverallWithWeights(scores, weights);
    expect(overall).toBe(65.62);

    // Trajectory weight > average base weight → higher traj score lifts overall
    // vs a 1.0 multiplier profile with the same base weights
    const weightsMult1 = withTrajectory(base, 1.0);
    const overallMult1 = computeWeightedOverallWithWeights(scores, weightsMult1);
    expect(weights.trajectory).toBeGreaterThan(weightsMult1.trajectory);
    expect(overall).toBeGreaterThan(overallMult1!);
  });
});
