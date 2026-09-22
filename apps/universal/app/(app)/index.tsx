import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import Map from '@/components/Map';
import WelcomeOverlay from '@/components/WelcomeOverlay';
import BottomSheet from '@/components/explorer/BottomSheet';
import DataFreshnessPill from '@/components/explorer/DataFreshnessPill';
import FilterSidebar from '@/components/explorer/FilterSidebar';
import GeographyDrillDown from '@/components/explorer/GeographyDrillDown';
import GeographySearch, {
  type SearchResult,
} from '@/components/explorer/GeographySearch';
import TviLegend from '@/components/explorer/TviLegend';
import TopMatchesList from '@/components/explorer/TopMatchesList';
import type { MapFlyToTarget } from '@/components/Map.types';
import {
  COMPARE_MAX,
  useCompareSelection,
} from '@/hooks/useCompareSelection';
import { useExplorerFilters } from '@/hooks/useExplorerFilters';
import { hasSeenWelcome } from '@/lib/welcomeStorage';
import {
  fetchGeographiesGeojson,
  geometryCentroid,
  type GeographyFeatureCollection,
  type GeographyFeatureProperties,
  type GeographyListItem,
} from '@/services/geographies';
import { useAuth } from '@/services/auth';
import { getSignalsSummary } from '@/services/signals';
import { colors, spacing, typography } from '@/theme/tokens';
import type { SignalSummaryMap } from '@outbound/core';

const DESKTOP_BREAKPOINT = 768;

export default function ExplorerScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const {
    filters,
    updateFilters,
    resetFilters,
    matched,
    matchedIsoCodes,
    filtering,
  } = useExplorerFilters();
  const { selected, buildCompareHref, clearCompare } = useCompareSelection();

  const [geojson, setGeojson] = useState<GeographyFeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<MapFlyToTarget | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'filters' | 'matches'>('filters');
  const [signalCounts, setSignalCounts] = useState<SignalSummaryMap>({});
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      setShowWelcome(false);
      return;
    }
    setShowWelcome(!hasSeenWelcome());
  }, [authLoading, isAuthenticated]);

  const dataLabel = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const freshnessLabel = { prefix: 'Updated', label: dataLabel };

  useEffect(() => {
    let cancelled = false;
    void getSignalsSummary().then((summary) => {
      if (!cancelled) setSignalCounts(summary);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(() => {
      void fetchGeographiesGeojson({ preferences: filters })
        .then((fc) => {
          if (!cancelled) {
            setGeojson(fc);
            setLoadError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setLoadError(
              err instanceof Error ? err.message : 'Failed to load geographies'
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [filters]);

  const selectGeography = useCallback(
    (opts: {
      idOrIso: string;
      isoCode?: string | null;
      centroid?: [number, number] | null;
      zoom?: number;
    }) => {
      setSelectedKey(opts.idOrIso);
      setSelectedIso(opts.isoCode ?? opts.idOrIso);
      setFiltersOpen(false);
      if (opts.centroid) {
        setFlyToTarget({
          longitude: opts.centroid[0],
          latitude: opts.centroid[1],
          zoom: opts.zoom ?? 4,
        });
      }
    },
    []
  );

  const onGeographyClick = useCallback(
    (properties: GeographyFeatureProperties, centroid: [number, number]) => {
      const key = properties.isoCode ?? properties.id;
      selectGeography({
        idOrIso: key,
        isoCode: properties.isoCode,
        centroid,
      });
    },
    [selectGeography]
  );

  const onMatchSelect = useCallback(
    (item: GeographyListItem) => {
      const centroid =
        item.centroid != null
          ? ([item.centroid.lng, item.centroid.lat] as [number, number])
          : null;
      selectGeography({
        idOrIso: item.isoCode ?? item.id,
        isoCode: item.isoCode,
        centroid,
      });
    },
    [selectGeography]
  );

  const onSearchSelect = useCallback(
    (result: SearchResult) => {
      const feature = geojson?.features.find(
        (f) => f.properties?.id === result.id || f.properties?.isoCode === result.isoCode
      );
      const centroid = feature ? geometryCentroid(feature.geometry) : null;
      selectGeography({
        idOrIso: result.isoCode ?? result.id,
        isoCode: result.isoCode,
        centroid,
      });
    },
    [geojson, selectGeography]
  );

  const closeSelection = useCallback(() => {
    setSelectedKey(null);
    setSelectedIso(null);
  }, []);

  const isWeb = Platform.OS === 'web';
  const showDesktopChrome = isWeb && isDesktop;
  const showMobileChrome = !isDesktop;

  return (
    <View style={styles.container}>
      {showDesktopChrome ? (
        <View style={styles.leftRail}>
          <FilterSidebar
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            style={styles.filtersInRail}
          />
          <TopMatchesList
            items={matched}
            selectedIsoCode={selectedIso}
            onSelect={onMatchSelect}
            signalCounts={signalCounts}
          />
        </View>
      ) : null}

      <View style={styles.mapPane}>
        <Map
          geojson={geojson}
          matchedIsoCodes={matchedIsoCodes}
          selectedIsoCode={selectedIso}
          flyToTarget={flyToTarget}
          onGeographyClick={onGeographyClick}
        />

        <>
            <View
              style={StyleSheet.flatten([
                styles.searchWrap,
                showMobileChrome && styles.searchWrapMobile,
              ])}
              pointerEvents="box-none"
            >
              <GeographySearch geojson={geojson} onSelect={onSearchSelect} />
              {showMobileChrome ? (
                <View style={styles.mobileFreshness} pointerEvents="none">
                  <DataFreshnessPill
                    labelPrefix={freshnessLabel.prefix}
                    dateLabel={freshnessLabel.label}
                  />
                </View>
              ) : null}
            </View>

            {!showMobileChrome ? (
              <View style={styles.topRight} pointerEvents="box-none">
                <DataFreshnessPill
                  labelPrefix={freshnessLabel.prefix}
                  dateLabel={freshnessLabel.label}
                />
                {filtering ? (
                  <Text style={styles.filteringHint}>Updating filters…</Text>
                ) : null}
              </View>
            ) : filtering ? (
              <View style={styles.topRight} pointerEvents="none">
                <Text style={styles.filteringHint}>Updating filters…</Text>
              </View>
            ) : null}

            {showMobileChrome ? (
              <Pressable
                style={StyleSheet.flatten([
                  styles.mobileFilterBtn,
                  selected.length > 0 && styles.mobileFilterBtnWithCompare,
                ])}
                onPress={() => setFiltersOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Open filters"
              >
                <Text style={styles.mobileFilterBtnText}>Filters</Text>
              </Pressable>
            ) : null}

            <View
              style={StyleSheet.flatten([
                styles.legendWrap,
                selected.length > 0 && styles.legendWrapWithCompare,
              ])}
              pointerEvents="none"
            >
              <TviLegend />
            </View>

            {loading ? (
              <View style={styles.status} pointerEvents="none">
                <ActivityIndicator color={colors.textPrimary} />
                <Text style={styles.statusText}>Loading geographies…</Text>
              </View>
            ) : null}
            {loadError ? (
              <View style={styles.status} pointerEvents="none">
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : null}
        </>
      </View>

      {showDesktopChrome && selectedKey ? (
        <GeographyDrillDown
          geographyIdOrIso={selectedKey}
          onClose={closeSelection}
        />
      ) : null}

      {/* Mobile / native filter / matches sheet */}
      {showMobileChrome ? (
        <BottomSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="EXPLORE"
          height="78%"
        >
          <View style={styles.mobileTabs}>
            <Pressable
              style={StyleSheet.flatten([
                styles.mobileTab,
                mobileTab === 'filters' && styles.mobileTabActive,
              ])}
              onPress={() => setMobileTab('filters')}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.mobileTabText,
                  mobileTab === 'filters' && styles.mobileTabTextActive,
                ])}
              >
                Filters
              </Text>
            </Pressable>
            <Pressable
              style={StyleSheet.flatten([
                styles.mobileTab,
                mobileTab === 'matches' && styles.mobileTabActive,
              ])}
              onPress={() => setMobileTab('matches')}
            >
              <Text
                style={StyleSheet.flatten([
                  styles.mobileTabText,
                  mobileTab === 'matches' && styles.mobileTabTextActive,
                ])}
              >
                Top Matches
              </Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.mobileSheetScroll}
            contentContainerStyle={styles.mobileSheetScrollContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {mobileTab === 'filters' ? (
              <FilterSidebar
                filters={filters}
                onChange={updateFilters}
                onReset={resetFilters}
                style={styles.mobileFilters}
              />
            ) : (
              <TopMatchesList
                items={matched}
                selectedIsoCode={selectedIso}
                onSelect={onMatchSelect}
                signalCounts={signalCounts}
                style={styles.mobileMatches}
              />
            )}
          </ScrollView>
        </BottomSheet>
      ) : null}

      {/* Mobile / native drill-down sheet */}
      {showMobileChrome && selectedKey ? (
        <BottomSheet visible onClose={closeSelection} height="70%">
          <GeographyDrillDown
            geographyIdOrIso={selectedKey}
            onClose={closeSelection}
            variant="sheet"
            style={styles.mobileDrill}
          />
        </BottomSheet>
      ) : null}

      {selected.length > 0 ? (
        <View style={styles.compareBar} pointerEvents="box-none">
          <View style={styles.compareBarInner}>
            <Text style={styles.compareBarText} numberOfLines={1}>
              Comparing: {selected.join(', ')} ({selected.length}/{COMPARE_MAX})
            </Text>
            <View style={styles.compareBarActions}>
              {selected.length >= 2 ? (
                <Pressable
                  style={styles.compareBarBtn}
                  onPress={() =>
                    router.push(buildCompareHref() as `/explorer/compare`)
                  }
                >
                  <Text style={styles.compareBarBtnText}>View compare →</Text>
                </Pressable>
              ) : (
                <Text style={styles.compareBarHint}>Add one more</Text>
              )}
              <Pressable onPress={clearCompare} hitSlop={8}>
                <Text style={styles.compareBarClear}>Clear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showWelcome ? (
        <WelcomeOverlay onDismissed={() => setShowWelcome(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  leftRail: {
    width: 280,
    backgroundColor: colors.backgroundElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexDirection: 'column',
  },
  filtersInRail: {
    width: '100%',
    borderRightWidth: 0,
  },
  mapPane: {
    flex: 1,
    position: 'relative',
  },
  searchWrap: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 5,
  },
  searchWrapMobile: {
    top: spacing.sm + 4,
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  mobileFreshness: {
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  topRight: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 2,
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  filteringHint: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  mobileFilterBtn: {
    position: 'absolute',
    bottom: 96,
    right: spacing.md,
    zIndex: 6,
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  mobileFilterBtnWithCompare: {
    bottom: 176,
  },
  mobileFilterBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  legendWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    zIndex: 2,
  },
  legendWrapWithCompare: {
    bottom: 100,
  },
  status: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceOverlay,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
    zIndex: 3,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
  },
  mobileTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  mobileTab: {
    flex: 1,
    minHeight: 44,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabActive: {
    backgroundColor: colors.accent,
  },
  mobileTabText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  mobileTabTextActive: {
    color: colors.textPrimary,
  },
  mobileSheetScroll: {
    flex: 1,
  },
  mobileSheetScrollContent: {
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  mobileFilters: {
    width: '100%',
    borderRightWidth: 0,
  },
  mobileMatches: {
    borderTopWidth: 0,
    minHeight: 280,
  },
  mobileDrill: {
    width: '100%',
    borderLeftWidth: 0,
    flex: 1,
  },
  compareBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    zIndex: 40,
  },
  compareBarInner: {
    backgroundColor: colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  compareBarText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    flexShrink: 1,
  },
  compareBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compareBarBtn: {
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  compareBarBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  compareBarHint: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  compareBarClear: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
});
