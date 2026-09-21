/**
 * Traveler profile keys and labels (Phase 1 Step 4).
 *
 * Shared vocabulary for server and client. Scoring weights remain in
 * server/api/src/config/tvi.ts (and server/workers/scoring_config.py).
 *
 * Formerly industry verticals (verticals.ts / all_industries, tech_saas, …).
 */

export const TRAVELER_PROFILE_KEYS = [
  'balanced',
  'solo_backpacker',
  'couple',
  'family',
  'group',
  'luxury',
  'budget',
] as const;

export type TravelerProfileKey = (typeof TRAVELER_PROFILE_KEYS)[number];

export const TRAVELER_PROFILE_LABELS: Record<TravelerProfileKey, string> = {
  balanced: 'Balanced',
  solo_backpacker: 'Solo Backpacker',
  couple: 'Couple / Honeymoon',
  family: 'Family',
  group: 'Group / Tour',
  luxury: 'Luxury',
  budget: 'Budget',
};

export const DEFAULT_TRAVELER_PROFILE: TravelerProfileKey = 'balanced';

/**
 * Profile keys available for agent profile selection.
 * Excludes 'balanced' — agents specialize in specific traveler types.
 */
export const AGENT_SELECTABLE_PROFILES = TRAVELER_PROFILE_KEYS.filter(
  (k): k is Exclude<TravelerProfileKey, 'balanced'> => k !== 'balanced'
);
