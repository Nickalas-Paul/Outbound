import { getOrderedDimensionDisplay } from '@outbound/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  COMPARE_MAX,
  useCompareSelection,
} from '@/hooks/useCompareSelection';
import { useTierAccess } from '@/hooks/useTierAccess';
import { tviScoreColor } from '@/lib/tviColors';
import { getApiUrl } from '@/services/api';
import {
  getGeographyDetail,
  getGeographyTrends,
  type DimensionTrend,
  type GeographyDetail,
} from '@/services/geographies';
import { colors, spacing, typography } from '@/theme/tokens';

const ORDERED_DIMENSIONS = getOrderedDimensionDisplay();

function openExportUrl(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank');
    return;
  }
  void Linking.openURL(url);
}

type ColumnResult =
  | {
      iso: string;
      status: 'ok';
      data: GeographyDetail;
      trends: Record<string, DimensionTrend | null>;
    }
  | { iso: string; status: 'error'; error: string };

type FactTone = 'good' | 'neutral' | 'caution' | 'plain';

function trendArrow(direction: DimensionTrend['direction'] | undefined): string {
  if (direction === 'improving') return '↑';
  if (direction === 'declining') return '↓';
  if (direction === 'stable') return '→';
  return '';
}

function trendArrowColor(
  direction: DimensionTrend['direction'] | undefined
): string {
  if (direction === 'improving') return colors.success;
  if (direction === 'declining') return colors.error;
  return colors.textMuted;
}

function parseCompareParam(raw: string | string[] | undefined): string[] {
  if (raw == null) return [];
  const value = Array.isArray(raw) ? raw.join(',') : raw;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[,+]/)) {
    const iso = part.trim().toUpperCase();
    if (!iso || seen.has(iso)) continue;
    seen.add(iso);
    out.push(iso);
    if (out.length >= COMPARE_MAX) break;
  }
  return out;
}

function confidenceColor(c: string | null | undefined): string {
  if (c === 'high') return colors.success;
  if (c === 'medium') return colors.warning;
  if (c === 'low') return colors.error;
  return colors.textMuted;
}

function formatPopulation(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

function toneColor(tone: FactTone): string | undefined {
  if (tone === 'good') return colors.success;
  if (tone === 'neutral') return colors.warning;
  if (tone === 'caution') return colors.error;
  return undefined;
}

function safetyLevel(score: number | null | undefined): {
  label: string;
  tone: FactTone;
} {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 70) return { label: 'High', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Exercise Caution', tone: 'caution' };
}

function costLevel(score: number | null | undefined): {
  label: string;
  tone: FactTone;
} {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 65) return { label: 'Budget-Friendly', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Expensive', tone: 'caution' };
}

function crowdingLevel(score: number | null | undefined): {
  label: string;
  tone: FactTone;
} {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 65) return { label: 'Low Crowding', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'High Crowding', tone: 'caution' };
}

function visaAccess(score: number | null | undefined): {
  label: string;
  tone: FactTone;
} {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 70) return { label: 'Open', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Restricted', tone: 'caution' };
}

/** Standard dims: high score = good. Crowding uses inverted meter fill. */
function dimensionBarVisual(
  dimKey: string,
  score: number | null
): { color: string; pct: number } {
  if (score == null || Number.isNaN(score)) {
    return { color: colors.textMuted, pct: 0 };
  }
  if (dimKey === 'crowding') {
    const pct = Math.max(0, Math.min(100, 100 - score));
    const color =
      score >= 65
        ? colors.success
        : score >= 40
          ? colors.warning
          : colors.error;
    return { color, pct };
  }
  const color =
    score >= 65
      ? colors.success
      : score >= 40
        ? colors.warning
        : colors.error;
  return { color, pct: Math.max(0, Math.min(100, score)) };
}

function leaderIndexes(scores: Array<number | null>): Set<number> {
  const leaders = new Set<number>();
  let best: number | null = null;
  scores.forEach((s) => {
    if (s == null) return;
    if (best == null || s > best) best = s;
  });
  if (best == null) return leaders;
  scores.forEach((s, i) => {
    if (s != null && s === best) leaders.add(i);
  });
  return leaders;
}

function ColumnWidth(count: number, isWide: boolean): number | `${number}%` {
  if (!isWide) return 200;
  if (count <= 0) return '100%';
  return `${Math.floor(100 / count)}%`;
}

export default function CompareMarketsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    compare?: string | string[];
    profile?: string;
  }>();
  const { clearCompare } = useCompareSelection();
  const { canExport } = useTierAccess();
  const exportsAllowed = canExport();
  const [exportUpgradePrompt, setExportUpgradePrompt] = useState(false);
  const isWide = width >= 768;

  const isos = useMemo(() => parseCompareParam(params.compare), [params.compare]);
  const profile = useMemo(() => {
    const raw = String(params.profile ?? 'balanced').trim();
    return raw || 'balanced';
  }, [params.profile]);

  const [columns, setColumns] = useState<ColumnResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isos.length === 0) {
      setColumns([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all(
      isos.map(async (iso): Promise<ColumnResult> => {
        try {
          const [data, trendPayload] = await Promise.all([
            getGeographyDetail(iso, profile),
            getGeographyTrends(iso).catch(() => null),
          ]);
          return {
            iso,
            status: 'ok',
            data,
            trends: trendPayload?.trends ?? {},
          };
        } catch (err) {
          return {
            iso,
            status: 'error',
            error: err instanceof Error ? err.message : 'Failed to load',
          };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        setColumns(results);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isos, profile]);

  const colWidth = ColumnWidth(Math.max(columns.length, 1), isWide);

  const quickFactRows = [
    {
      key: 'population',
      label: 'Population',
      format: (d: GeographyDetail | null) => ({
        label: formatPopulation(d?.quickFacts?.population),
        tone: 'plain' as FactTone,
      }),
    },
    {
      key: 'safetyLevel',
      label: 'Safety Level',
      format: (d: GeographyDetail | null) =>
        safetyLevel(d?.tvi?.dimensions?.safetyAndEntry),
    },
    {
      key: 'costLevel',
      label: 'Cost Level',
      format: (d: GeographyDetail | null) =>
        costLevel(d?.tvi?.dimensions?.costIndex),
    },
    {
      key: 'crowding',
      label: 'Tourism Crowding',
      format: (d: GeographyDetail | null) =>
        crowdingLevel(d?.tvi?.dimensions?.crowding),
    },
    {
      key: 'visaAccess',
      label: 'Visa Access',
      format: (d: GeographyDetail | null) =>
        visaAccess(d?.tvi?.dimensions?.accessibility),
    },
    {
      key: 'language',
      label: 'Language',
      format: (d: GeographyDetail | null) => ({
        label: d?.quickFacts?.language ?? '—',
        tone: 'plain' as FactTone,
      }),
    },
    {
      key: 'currency',
      label: 'Currency',
      format: (d: GeographyDetail | null) => ({
        label: d?.quickFacts?.currency ?? '—',
        tone: 'plain' as FactTone,
      }),
    },
  ] as const;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        horizontal={false}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/');
          }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Back to Explorer</Text>
        </Pressable>

        <Text style={styles.title}>Compare Destinations</Text>
        <Text style={styles.subtitle}>
          {isos.length === 0
            ? 'No destinations selected'
            : `${isos.length} destination${isos.length === 1 ? '' : 's'}${
                profile !== 'balanced' ? ` · ${profile.replace(/_/g, ' ')}` : ''
              }`}
        </Text>

        {isos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Select 2–3 destinations to compare
            </Text>
            <Text style={styles.emptyBody}>
              Use the Compare button on any destination&apos;s detail page, then
              open the comparison view.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push('/')}
            >
              <Text style={styles.primaryBtnText}>Go to Explorer</Text>
            </Pressable>
          </View>
        ) : null}

        {isos.length === 1 && !loading ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintText}>
              Add one or two more destinations from their detail pages for a
              fuller side-by-side comparison.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textPrimary} size="large" />
            <Text style={styles.loadingText}>Loading comparison…</Text>
          </View>
        ) : null}

        {!loading && columns.length > 0 ? (
          <ScrollView
            horizontal={!isWide}
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.tableScroll}
          >
            <View
              style={[
                styles.table,
                !isWide && { minWidth: columns.length * 200 },
              ]}
            >
              <View style={styles.headerRow}>
                {columns.map((col) => (
                  <View
                    key={col.iso}
                    style={[
                      styles.headerCol,
                      { width: isWide ? colWidth : 200 },
                    ]}
                  >
                    {col.status === 'error' ? (
                      <>
                        <Text style={styles.countryName}>{col.iso}</Text>
                        <Text style={styles.errorText}>{col.error}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.countryName}>{col.data.name}</Text>
                        <Text style={styles.region}>
                          {(col.data.region ?? '—').toUpperCase()}
                        </Text>
                        <Text
                          style={[
                            styles.tviScore,
                            {
                              color: tviScoreColor(
                                col.data.tvi?.overall ?? null
                              ),
                            },
                          ]}
                        >
                          TVI:{' '}
                          {col.data.tvi?.overall != null
                            ? Math.round(col.data.tvi.overall)
                            : '—'}
                        </Text>
                        <View style={styles.confRow}>
                          <View
                            style={[
                              styles.confDot,
                              {
                                backgroundColor: confidenceColor(
                                  col.data.tvi?.confidence
                                ),
                              },
                            ]}
                          />
                          <Text style={styles.confText}>
                            {(col.data.tvi?.confidence ?? 'n/a').replace(
                              /^\w/,
                              (c) => c.toUpperCase()
                            )}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </View>

              {ORDERED_DIMENSIONS.map((dim) => {
                const scores = columns.map((col) =>
                  col.status === 'ok'
                    ? (col.data.tvi?.dimensions?.[dim.key] ?? null)
                    : null
                );
                const leaders = leaderIndexes(scores);
                return (
                  <View key={dim.key} style={styles.dimBlock}>
                    {dim.isComposite ? (
                      <Text style={styles.momentumHeader}>MOMENTUM</Text>
                    ) : null}
                    <Text style={styles.dimLabel}>{dim.label}</Text>
                    <View style={styles.dimRow}>
                      {columns.map((col, idx) => {
                        const score = scores[idx];
                        const { color, pct } = dimensionBarVisual(
                          dim.key,
                          score
                        );
                        const isLeader = leaders.has(idx);
                        const direction =
                          !dim.isComposite && col.status === 'ok'
                            ? col.trends[dim.key]?.direction
                            : undefined;
                        const arrow = trendArrow(direction);
                        return (
                          <View
                            key={`${dim.key}-${col.iso}`}
                            style={[
                              styles.col,
                              styles.scoreCell,
                              { width: isWide ? colWidth : 200 },
                              isLeader && styles.leaderCell,
                            ]}
                          >
                            <View style={styles.scoreLine}>
                              <Text
                                style={[
                                  styles.scoreValue,
                                  { color },
                                  isLeader && styles.leaderScore,
                                ]}
                              >
                                {score != null ? Math.round(score) : '—'}
                              </Text>
                              {arrow ? (
                                <Text
                                  style={[
                                    styles.trendArrow,
                                    { color: trendArrowColor(direction) },
                                  ]}
                                >
                                  {arrow}
                                </Text>
                              ) : null}
                              {isLeader ? (
                                <Text style={styles.leaderMark}>★</Text>
                              ) : null}
                            </View>
                            <View style={styles.barTrack}>
                              {score != null ? (
                                <View
                                  style={[
                                    styles.barFill,
                                    {
                                      width: `${pct}%`,
                                      backgroundColor: color,
                                    },
                                  ]}
                                />
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              <Text style={styles.qfSectionTitle}>QUICK FACTS</Text>
              {quickFactRows.map((row) => (
                <View key={row.key} style={styles.dimBlock}>
                  <Text style={styles.dimLabel}>{row.label}</Text>
                  <View style={styles.dimRow}>
                    {columns.map((col) => {
                      const fact =
                        col.status === 'ok'
                          ? row.format(col.data)
                          : { label: '—', tone: 'plain' as FactTone };
                      const tint = toneColor(fact.tone);
                      return (
                        <View
                          key={`${row.key}-${col.iso}`}
                          style={[
                            styles.col,
                            styles.scoreCell,
                            { width: isWide ? colWidth : 200 },
                          ]}
                        >
                          <View style={styles.qfValueRow}>
                            {tint ? (
                              <View
                                style={[
                                  styles.qfToneDot,
                                  { backgroundColor: tint },
                                ]}
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.qfValue,
                                tint ? { color: tint } : null,
                                fact.label === '—' && styles.qfMuted,
                              ]}
                            >
                              {fact.label}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}

        {isos.length > 0 ? (
          <View style={styles.actions}>
            <View style={styles.exportGateWrap}>
              <Pressable
                style={[
                  styles.ghostBtn,
                  !exportsAllowed && styles.ghostBtnLocked,
                ]}
                onPress={() => {
                  if (isos.length === 0) return;
                  if (!exportsAllowed) {
                    setExportUpgradePrompt(true);
                    return;
                  }
                  const base = getApiUrl().replace(/\/$/, '');
                  const qs = new URLSearchParams({
                    compare: isos.join(','),
                  });
                  if (profile && profile !== 'balanced') {
                    qs.set('profile', profile);
                  }
                  openExportUrl(`${base}/api/exports/compare/csv?${qs}`);
                }}
              >
                <Text style={styles.ghostBtnText}>
                  {exportsAllowed ? 'Export CSV' : 'Export CSV 🔒'}
                </Text>
              </Pressable>
              {exportUpgradePrompt ? (
                <Text style={styles.exportUpgradePrompt}>
                  Upgrade to Pro to export
                </Text>
              ) : null}
            </View>
            <Pressable
              style={styles.dangerBtn}
              onPress={() => {
                clearCompare();
                router.push('/');
              }}
            >
              <Text style={styles.dangerBtnText}>Clear selection</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md + 4,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.accent,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.fontSize.md,
    marginTop: -spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
  },
  hintCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
  },
  tableScroll: {
    flexGrow: 1,
  },
  table: {
    width: '100%',
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerCol: {
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  col: {
    flexShrink: 0,
  },
  countryName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  region: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  tviScore: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
  },
  confDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginTop: spacing.sm,
  },
  dimBlock: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  dimLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  momentumHeader: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
  },
  dimRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scoreCell: {
    gap: spacing.sm,
  },
  leaderCell: {
    backgroundColor: 'rgba(91, 141, 239, 0.08)',
    borderRadius: 8,
    padding: spacing.xs + 2,
    margin: -(spacing.xs + 2),
  },
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  scoreValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  leaderScore: {
    fontWeight: typography.fontWeight.bold,
  },
  leaderMark: {
    color: colors.warning,
    fontSize: typography.fontSize.sm,
  },
  trendArrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    marginLeft: 2,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  qfSectionTitle: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.4,
    marginTop: spacing.sm,
  },
  qfValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  qfToneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  qfValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  qfMuted: {
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  exportGateWrap: {
    gap: spacing.xs,
  },
  ghostBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  ghostBtnLocked: {
    opacity: 0.7,
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  exportUpgradePrompt: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
  },
  dangerBtn: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerBtnText: {
    color: colors.error,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
