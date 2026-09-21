import {
  canAccessFeature,
  canUseFilter as coreCanUseFilter,
  canUseHorizon as coreCanUseHorizon,
  getAvailableFilters as coreGetAvailableFilters,
  isGatingEnabled,
  type FilterKey,
  type SubscriptionTier,
} from '@outbound/core';

import { useAuth } from '@/services/auth';

function normalizeTier(raw: string | null | undefined): SubscriptionTier {
  if (raw === 'free' || raw === 'pro' || raw === 'marketplace') {
    return raw;
  }
  return 'free';
}

export type TierAccess = {
  gatingEnabled: boolean;
  currentTier: SubscriptionTier;
  canUseFilter: (filterKey: string) => boolean;
  canUseHorizon: (horizon: string) => boolean;
  canExport: () => boolean;
  canSaveSearches: () => boolean;
  canAccessAgentIntros: () => boolean;
  canUseTravelerProfile: () => boolean;
  getAvailableFilters: () => FilterKey[];
};

/**
 * Client-side tier + feature access.
 * When gating is off (beta default), tier checks return true — but
 * user-specific features still require authentication.
 */
export function useTierAccess(): TierAccess {
  const { user, isAuthenticated } = useAuth();
  const gatingEnabled = isGatingEnabled();
  const currentTier = normalizeTier(user?.subscriptionTier);

  return {
    gatingEnabled,
    currentTier,
    canUseFilter: (filterKey: string) => coreCanUseFilter(currentTier, filterKey),
    canUseHorizon: (horizon: string) => coreCanUseHorizon(currentTier, horizon),
    canExport: () =>
      Boolean(isAuthenticated) && canAccessFeature(currentTier, 'exports'),
    canSaveSearches: () =>
      Boolean(isAuthenticated) &&
      canAccessFeature(currentTier, 'savedSearches'),
    canAccessAgentIntros: () =>
      Boolean(isAuthenticated) &&
      canAccessFeature(currentTier, 'agentIntroductions'),
    canUseTravelerProfile: () =>
      canAccessFeature(currentTier, 'travelerProfile'),
    getAvailableFilters: () => coreGetAvailableFilters(currentTier),
  };
}
