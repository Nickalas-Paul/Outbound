import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  DEFAULT_FILTERS,
  filtersEqual,
  filtersToQueryRecord,
  parseFiltersFromParams,
  type ExplorerFilterState,
} from '@/lib/explorerFilters';
import {
  filterGeographies,
  type GeographyListItem,
} from '@/services/geographies';

const DEBOUNCE_MS = 250;

export function useExplorerFilters() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [filters, setFilters] = useState<ExplorerFilterState>(DEFAULT_FILTERS);
  const [matched, setMatched] = useState<GeographyListItem[]>([]);
  const [matchedIsoCodes, setMatchedIsoCodes] = useState<Set<string> | null>(
    null
  );
  const [filtering, setFiltering] = useState(false);
  const hydrated = useRef(false);
  const skipNextUrlSync = useRef(true);

  const applyFilters = useCallback(async (next: ExplorerFilterState) => {
    setFiltering(true);
    try {
      const result = await filterGeographies(
        {},
        {
          limit: 200,
          preferences: next,
        }
      );
      setMatched(result.data);
      // Preference-derived hard filters may exclude countries — dim non-matches
      // when the result set is smaller than a full catalog fetch.
      setMatchedIsoCodes(
        result.data.length > 0 && result.data.length < 170
          ? new Set(
              result.data
                .map((g) => g.isoCode)
                .filter((iso): iso is string => Boolean(iso))
            )
          : null
      );
    } catch {
      // keep previous matches on error
    } finally {
      setFiltering(false);
    }
  }, []);

  // Hydrate from URL once (read-only; does not write params)
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const fromUrl = parseFiltersFromParams(
      params as Record<string, string | string[] | undefined>
    );
    skipNextUrlSync.current = true;
    setFilters(fromUrl);
  }, [params]);

  // Sync preference state → URL query params (never during render)
  useEffect(() => {
    if (!hydrated.current) return;
    if (Platform.OS !== 'web') return;
    if (skipNextUrlSync.current) {
      skipNextUrlSync.current = false;
      return;
    }
    const query = filtersToQueryRecord(filters);
    router.setParams({
      tripType: query.tripType ?? undefined,
      budgetTier: query.budgetTier ?? undefined,
      safetyTolerance: query.safetyTolerance ?? undefined,
      crowdingPreference: query.crowdingPreference ?? undefined,
      easeOfTravel: query.easeOfTravel ?? undefined,
      // Clear legacy filter params
      profile: undefined,
      vertical: undefined,
      horizon: undefined,
      minPopulation: undefined,
      minCostIndex: undefined,
      minAccessibility: undefined,
      maxCrowding: undefined,
      minSafetyAndEntry: undefined,
    });
  }, [filters, router]);

  // Debounced API filter apply when preferences change
  useEffect(() => {
    if (!hydrated.current) return;
    const handle = setTimeout(() => {
      void applyFilters(filters);
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [filters, applyFilters]);

  const updateFilters = useCallback((patch: Partial<ExplorerFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    preferences: filters,
    updateFilters,
    resetFilters,
    matched,
    matchedIsoCodes,
    filtering,
    isDefault: filtersEqual(filters, DEFAULT_FILTERS),
  };
}
