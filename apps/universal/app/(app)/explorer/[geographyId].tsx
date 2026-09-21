import {
  getOrderedDimensionDisplay,
  sourceDisplayName,
  type DimensionKey,
  type IndicatorDisplay,
  type MarketSignal,
} from '@outbound/core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

import TrendAnalysisSection from '@/components/explorer/TrendAnalysisSection';
import {
  directionLabel,
  formatProbabilityPct,
  formatRelativeFetchedAt,
  shortDimensionList,
  signalAccent,
  signalTypeIcon,
  signalTypeLabel,
  sourceDisplayLabel,
} from '@/lib/signalsUi';
import {
  COMPARE_MAX,
  useCompareSelection,
} from '@/hooks/useCompareSelection';
import { useTierAccess } from '@/hooks/useTierAccess';
import { getApiUrl } from '@/services/api';
import {
  getGeographyDetail,
  getGeographyTrends,
  type GeographyDetail,
  type TviSourceRef,
  type QuickFacts,
  type TrendData,
} from '@/services/geographies';
import { getGeographySignals } from '@/services/signals';
import { colors, spacing, typography } from '@/theme/tokens';

function openExportUrl(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank');
    return;
  }
  void Linking.openURL(url);
}

function geographyExportUrl(
  idOrIso: string,
  format: 'pdf' | 'csv',
  profile: string
): string {
  const base = getApiUrl().replace(/\/$/, '');
  const qs =
    profile && profile !== 'balanced'
      ? `?profile=${encodeURIComponent(profile)}`
      : '';
  return `${base}/api/exports/geography/${encodeURIComponent(idOrIso)}/${format}${qs}`;
}

function confidenceColor(c: string | null | undefined): string {
  if (c === 'high') return colors.success;
  if (c === 'medium') return colors.warning;
  if (c === 'low') return colors.error;
  return colors.textMuted;
}

function formatRefreshDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format large counts: 83200000 → "83.2M", 1400000000 → "1.4B". */
function formatPopulation(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

type FactTone = 'good' | 'neutral' | 'caution' | 'plain';

function toneColor(tone: FactTone): string | undefined {
  if (tone === 'good') return colors.success;
  if (tone === 'neutral') return colors.warning;
  if (tone === 'caution') return colors.error;
  return undefined;
}

function safetyLevel(score: number | null | undefined): { label: string; tone: FactTone } {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 70) return { label: 'High', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Exercise Caution', tone: 'caution' };
}

function costLevel(score: number | null | undefined): { label: string; tone: FactTone } {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 65) return { label: 'Budget-Friendly', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Expensive', tone: 'caution' };
}

function crowdingLevel(score: number | null | undefined): { label: string; tone: FactTone } {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 65) return { label: 'Low Crowding', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'High Crowding', tone: 'caution' };
}

function visaAccess(score: number | null | undefined): { label: string; tone: FactTone } {
  if (score == null || Number.isNaN(score)) return { label: '—', tone: 'plain' };
  if (score >= 70) return { label: 'Open', tone: 'good' };
  if (score >= 40) return { label: 'Moderate', tone: 'neutral' };
  return { label: 'Restricted', tone: 'caution' };
}

function travelViabilityLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return 'Travel Viability: —';
  if (score >= 70) return 'Travel Viability: High';
  if (score >= 40) return 'Travel Viability: Moderate';
  return 'Travel Viability: Low';
}

type DimensionScores = NonNullable<NonNullable<GeographyDetail['tvi']>['dimensions']>;

function QuickFactsPanel({
  facts,
  dimensions,
  compact,
}: {
  facts: QuickFacts | null;
  dimensions: DimensionScores | null | undefined;
  compact?: boolean;
}) {
  const safety = safetyLevel(dimensions?.safetyAndEntry);
  const cost = costLevel(dimensions?.costIndex);
  const crowding = crowdingLevel(dimensions?.crowding);
  const visa = visaAccess(dimensions?.accessibility);

  const rows: Array<{ label: string; value: string; tone: FactTone }> = [
    { label: 'Population', value: formatPopulation(facts?.population), tone: 'plain' },
    { label: 'Safety Level', value: safety.label, tone: safety.tone },
    { label: 'Cost Level', value: cost.label, tone: cost.tone },
    { label: 'Tourism Crowding', value: crowding.label, tone: crowding.tone },
    { label: 'Visa Access', value: visa.label, tone: visa.tone },
    { label: 'Language', value: facts?.language ?? '—', tone: 'plain' },
    { label: 'Currency', value: facts?.currency ?? '—', tone: 'plain' },
  ];

  return (
    <View style={[styles.qfPanel, compact ? styles.qfPanelCompact : null]}>
      <Text style={styles.qfHeader}>QUICK FACTS</Text>
      <View style={[styles.qfRows, compact ? styles.qfRowsCompact : null]}>
        {rows.map((row) => {
          const tint = toneColor(row.tone);
          return (
            <View
              key={row.label}
              style={[styles.qfRow, compact ? styles.qfRowCompact : null]}
            >
              <Text style={styles.qfLabel}>{row.label}</Text>
              <View style={styles.qfValueRow}>
                {tint ? (
                  <View style={[styles.qfToneDot, { backgroundColor: tint }]} />
                ) : null}
                <Text
                  style={[
                    styles.qfValue,
                    tint ? { color: tint } : null,
                    row.value === '—' ? styles.qfValueMuted : null,
                  ]}
                >
                  {row.value}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PlanThisTripCard({
  countryName,
  isoCode,
}: {
  countryName: string;
  isoCode: string;
}) {
  const router = useRouter();
  const href = `/plan?destination=${encodeURIComponent(isoCode)}&name=${encodeURIComponent(countryName)}`;

  return (
    <View style={styles.planCard}>
      <Text style={styles.planHeading}>Plan a trip to {countryName}</Text>
      <Text style={styles.planSub}>
        Get a personalized itinerary based on your travel style
      </Text>
      <Pressable
        style={({ pressed }) =>
          StyleSheet.flatten([styles.planBtn, pressed && styles.planBtnPressed])
        }
        onPress={() => router.push(href as `/plan`)}
        accessibilityRole="button"
        accessibilityLabel={`Plan this trip to ${countryName}`}
      >
        <Text style={styles.planBtnText}>Plan This Trip</Text>
      </Pressable>
    </View>
  );
}

const ORDERED_DIMENSIONS = getOrderedDimensionDisplay();

function sourcesForDimension(
  key: DimensionKey,
  allSources: TviSourceRef[]
): TviSourceRef[] {
  const meta = ORDERED_DIMENSIONS.find((d) => d.key === key);
  if (!meta) return [];
  const codes = new Set(meta.indicatorCodes);
  return allSources.filter((s) => codes.has(s.indicator));
}

function uniqueSourceLabels(sources: TviSourceRef[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const s of sources) {
    if (seen.has(s.source)) continue;
    seen.add(s.source);
    labels.push(sourceDisplayName(s.source));
  }
  return labels;
}

/** Standard dimension cards: high score = good. */
function dimensionScoreColor(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return colors.textMuted;
  if (score >= 65) return colors.success;
  if (score >= 40) return colors.warning;
  return colors.error;
}

/**
 * Crowding uses lower_is_better inversion in scoring (high score = less crowded).
 * Display as a crowding meter: fill ≈ 100 − score so full/red = crowded.
 */
function crowdingDisplay(score: number | null | undefined): {
  label: string;
  color: string;
  meterPct: number;
} | null {
  if (score == null || Number.isNaN(score)) return null;
  const meterPct = Math.max(0, Math.min(100, 100 - score));
  if (score >= 65) {
    return { label: 'Low Crowding', color: colors.success, meterPct };
  }
  if (score >= 40) {
    return { label: 'Moderate Crowding', color: colors.warning, meterPct };
  }
  return { label: 'High Crowding', color: colors.error, meterPct };
}

function indicatorLabel(
  code: string,
  indicators: IndicatorDisplay[]
): string {
  return indicators.find((i) => i.code === code)?.name ?? code;
}

function DimensionCard({
  dimKey,
  label,
  description,
  score,
  confidence,
  sources,
  indicators,
  onSourcePress,
}: {
  dimKey: string;
  label: string;
  description: string;
  score: number | null;
  confidence: string | null;
  sources: TviSourceRef[];
  indicators: IndicatorDisplay[];
  onSourcePress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCrowding = dimKey === 'crowding';
  const crowding = isCrowding ? crowdingDisplay(score) : null;
  const scoreColor = isCrowding
    ? crowding?.color ?? colors.textMuted
    : dimensionScoreColor(score);
  const barPct = isCrowding
    ? crowding?.meterPct ?? 0
    : score != null
      ? Math.max(0, Math.min(100, score))
      : 0;
  const sourceLabels = uniqueSourceLabels(sources);

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={styles.dimCard}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <View style={styles.dimTop}>
        <View style={styles.dimTextCol}>
          <View style={styles.dimNameRow}>
            <Text style={styles.dimName}>{label}</Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textMuted}
            />
          </View>
          {isCrowding && crowding ? (
            <Text style={[styles.crowdingQual, { color: crowding.color }]}>
              {crowding.label}
            </Text>
          ) : (
            <Text style={styles.dimDesc}>{description}</Text>
          )}
        </View>
        <View style={styles.dimScoreCol}>
          <Text style={[styles.dimScore, { color: scoreColor }]}>
            {score != null ? Math.round(score) : '—'}
          </Text>
          <View style={styles.confRow}>
            <View
              style={[styles.confDot, { backgroundColor: confidenceColor(confidence) }]}
            />
            <Text style={styles.confText}>
              {(confidence ?? 'n/a').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.barTrack}>
        {score != null ? (
          <View
            style={[
              styles.barFill,
              { width: `${barPct}%`, backgroundColor: scoreColor },
            ]}
          />
        ) : null}
      </View>
      {isCrowding ? (
        <Text style={styles.barCaption}>Crowding meter · score {score != null ? Math.round(score) : '—'}</Text>
      ) : null}

      {sourceLabels.length > 0 ? (
        <View style={styles.tagRow}>
          {sourceLabels.map((tag) => (
            <Pressable
              key={`${dimKey}-${tag}`}
              style={styles.tag}
              onPress={(e) => {
                e?.stopPropagation?.();
                onSourcePress();
              }}
              accessibilityRole="link"
              accessibilityLabel={`${tag} — TVI methodology`}
            >
              <Text style={styles.tagText}>{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.noData}>No source data</Text>
      )}

      {expanded ? (
        <View style={styles.expandBlock}>
          {sources.length === 0 ? (
            <Text style={styles.expandEmpty}>No underlying indicators available.</Text>
          ) : (
            sources.map((s) => (
              <View
                key={`${s.source}-${s.indicator}-${s.year}`}
                style={styles.expandRow}
              >
                <View style={styles.expandRowMain}>
                  <Text style={styles.expandLabel} numberOfLines={2}>
                    {indicatorLabel(s.indicator, indicators)}
                  </Text>
                  <Text style={styles.expandValue}>{s.year}</Text>
                </View>
                <Text style={styles.expandSource}>
                  {sourceDisplayName(s.source)}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function GeographyDetailScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    geographyId: string;
    profile?: string;
    vertical?: string;
  }>();
  const geographyId = String(params.geographyId ?? '').trim();
  const profile =
    String(params.profile ?? params.vertical ?? 'balanced').trim() ||
    'balanced';

  const {
    selected,
    addToCompare,
    removeFromCompare,
    isSelected,
    isAtMax,
    buildCompareHref,
  } = useCompareSelection();

  const [data, setData] = useState<GeographyDetail | null>(null);
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportUpgradePrompt, setExportUpgradePrompt] = useState(false);
  const { canExport } = useTierAccess();
  const exportsAllowed = canExport();

  useEffect(() => {
    if (!geographyId) {
      setError('Geography not found');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTrendsLoading(true);
    setSignalsLoading(true);
    setSignals([]);
    setError(null);
    void getGeographyDetail(geographyId, profile)
      .then((geo) => {
        if (!cancelled) setData(geo);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Failed to load geography');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void getGeographyTrends(geographyId)
      .then((trends) => {
        if (!cancelled) setTrendData(trends);
      })
      .catch(() => {
        if (!cancelled) setTrendData(null);
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });
    void getGeographySignals(geographyId)
      .then((res) => {
        if (!cancelled) setSignals(res.signals);
      })
      .finally(() => {
        if (!cancelled) setSignalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geographyId, profile]);

  const overall = data?.tvi?.overall ?? null;
  const overallColor = dimensionScoreColor(overall);
  const allSources = data?.tvi?.sources ?? [];
  const sourceCount = useMemo(() => {
    const set = new Set(allSources.map((s) => s.source));
    return set.size;
  }, [allSources]);

  const isWide = width >= 768;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isWide ? styles.scrollContentWide : null,
        ]}
      >
        <Pressable
          onPress={() => router.push('/')}
          style={styles.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to Explorer"
        >
          <Text style={styles.backText}>← Back to Explorer</Text>
        </Pressable>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.textPrimary} size="large" />
            <Text style={styles.loadingText}>Loading destination…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Destination not found</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.errorBack} onPress={() => router.push('/')}>
              <Text style={styles.backText}>← Back to Explorer</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && data ? (
          <View style={[styles.mainRow, isWide ? styles.mainRowWide : null]}>
            <View style={[styles.mainCol, isWide ? styles.mainColWide : null]}>
              <View style={styles.hero}>
                {data.region ? (
                  <Text style={styles.region}>{data.region.toUpperCase()}</Text>
                ) : null}
                <Text style={styles.country}>{data.name}</Text>

                <View style={styles.overallBlock}>
                  <Text style={[styles.overallScore, { color: overallColor }]}>
                    {overall != null ? Math.round(overall) : '—'}
                  </Text>
                  <Text style={styles.overallLabel}>
                    {travelViabilityLabel(overall)}
                  </Text>
                </View>

                <View style={styles.pillsRow}>
                  <View style={styles.pill}>
                    <View
                      style={[
                        styles.confDot,
                        { backgroundColor: confidenceColor(data.tvi?.confidence) },
                      ]}
                    />
                    <Text style={styles.pillText}>
                      {(data.tvi?.confidence ?? 'n/a').replace(/^\w/, (c) =>
                        c.toUpperCase()
                      )}{' '}
                      confidence
                    </Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      Last refresh:{' '}
                      {formatRefreshDate(
                        data.tvi?.dataFreshness ?? data.tvi?.calculatedAt
                      )}
                    </Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      Sources: {sourceCount} active
                    </Text>
                  </View>
                  {signals.length > 0 ? (
                    <View style={[styles.pill, styles.signalPill]}>
                      <Text style={styles.signalPillText}>
                        {signals.length} active signal
                        {signals.length === 1 ? '' : 's'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {!isWide ? (
                <>
                  <QuickFactsPanel
                    facts={data.quickFacts}
                    dimensions={data.tvi?.dimensions}
                    compact
                  />
                  <PlanThisTripCard
                    countryName={data.name}
                    isoCode={data.isoCode ?? data.id}
                  />
                </>
              ) : null}

              <View style={styles.dimStack}>
                {ORDERED_DIMENSIONS.map((dim) => {
                  const score = data.tvi?.dimensions?.[dim.key] ?? null;
                  const dimSources = sourcesForDimension(dim.key, allSources);
                  return (
                    <DimensionCard
                      key={dim.key}
                      dimKey={dim.key}
                      label={dim.label}
                      description={dim.description}
                      score={score}
                      confidence={data.tvi?.confidence ?? null}
                      sources={dimSources}
                      indicators={dim.indicators}
                      onSourcePress={() => router.push('/docs/methodology')}
                    />
                  );
                })}
              </View>

              <View style={styles.signalsSection}>
                <Text style={styles.signalsSectionTitle}>Active Signals</Text>
                {signalsLoading ? (
                  <View style={styles.sectionState}>
                    <ActivityIndicator color={colors.accent} size="small" />
                    <Text style={styles.sectionStateText}>Loading alerts…</Text>
                  </View>
                ) : signals.length === 0 ? (
                  <View style={styles.signalsEmpty}>
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={20}
                      color={colors.success}
                    />
                    <Text style={styles.signalsEmptyText}>No active alerts</Text>
                    <Text style={styles.signalsEmptySub}>
                      This destination looks quiet right now.
                    </Text>
                  </View>
                ) : (
                  <>
                    {signals.map((sig) => {
                      const accent = signalAccent(sig.direction);
                      const prob = formatProbabilityPct(sig.probability);
                      const dimLabels = shortDimensionList(sig.affectedDimensions);
                      return (
                        <View
                          key={sig.id}
                          style={[
                            styles.signalCard,
                            {
                              backgroundColor: accent.cardBg,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.signalIconWrap,
                              { backgroundColor: accent.pillBg },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name={
                                signalTypeIcon(sig.signalType) as 'information-outline'
                              }
                              size={16}
                              color={accent.dot}
                            />
                          </View>
                          <View style={styles.signalCardBody}>
                            <Text style={styles.signalCategory}>
                              {signalTypeLabel(sig.signalType)}
                            </Text>
                            <Text style={styles.signalCardTitle}>{sig.title}</Text>
                            {sig.description ? (
                              <Text style={styles.signalCardDesc}>
                                {sig.description}
                              </Text>
                            ) : null}
                            <View style={styles.signalTagRow}>
                              <View
                                style={[
                                  styles.signalTag,
                                  { backgroundColor: accent.pillBg },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.signalTagText,
                                    { color: accent.pillText },
                                  ]}
                                >
                                  {directionLabel(sig.direction)}
                                </Text>
                              </View>
                              {prob ? (
                                <View
                                  style={[
                                    styles.signalTag,
                                    { backgroundColor: accent.pillBg },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.signalTagText,
                                      { color: accent.pillText },
                                    ]}
                                  >
                                    {prob}
                                  </Text>
                                </View>
                              ) : null}
                              {dimLabels.map((label) => (
                                <View key={label} style={styles.signalDimPill}>
                                  <Text style={styles.signalDimPillText}>{label}</Text>
                                </View>
                              ))}
                            </View>
                            <Text style={styles.signalMeta}>
                              {sourceDisplayLabel(sig.source)} ·{' '}
                              {formatRelativeFetchedAt(sig.fetchedAt)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                    <Text style={styles.signalsFooter}>
                      Signals inform 2yr/5yr projections. They don't replace dimension
                      scores.
                    </Text>
                  </>
                )}
              </View>

              <TrendAnalysisSection
                trendData={trendData}
                trajectoryScore={data.tvi?.dimensions?.trajectory ?? null}
                loading={trendsLoading}
              />

              <View style={styles.actionsRow}>
                {(() => {
                  const iso = data.isoCode ?? data.id;
                  const inCompare = isSelected(iso);
                  const compareLabel = inCompare
                    ? `Remove from compare (${selected.length}/${COMPARE_MAX})`
                    : isAtMax
                      ? `Compare full (${COMPARE_MAX}/${COMPARE_MAX})`
                      : selected.length > 0
                        ? `⇄ Compare (${selected.length}/${COMPARE_MAX})`
                        : '⇄ Compare';
                  return (
                    <Pressable
                      style={[
                        styles.actionBtn,
                        inCompare && styles.actionBtnActive,
                        isAtMax && !inCompare && styles.actionBtnDisabled,
                      ]}
                      disabled={isAtMax && !inCompare}
                      onPress={() => {
                        if (inCompare) {
                          removeFromCompare(iso);
                        } else {
                          addToCompare(iso);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          isAtMax && !inCompare && styles.actionTextDisabled,
                        ]}
                      >
                        {compareLabel}
                      </Text>
                    </Pressable>
                  );
                })()}
                {selected.length >= 2 ? (
                  <Pressable
                    style={[styles.actionBtn, styles.actionBtnGhost]}
                    onPress={() =>
                      router.push(
                        buildCompareHref(profile) as `/explorer/compare`
                      )
                    }
                  >
                    <Text style={styles.actionTextGhost}>
                      View comparison → ({selected.length})
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.exportWrap}>
                  <Pressable
                    onPress={() => {
                      setExportMenuOpen((o) => !o);
                      setExportUpgradePrompt(false);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.exportLink}>
                      {exportsAllowed
                        ? `Export data${exportMenuOpen ? ' ▴' : ' ▾'}`
                        : `Export data 🔒${exportMenuOpen ? ' ▴' : ' ▾'}`}
                    </Text>
                  </Pressable>
                  {exportMenuOpen ? (
                    <View style={styles.exportMenu}>
                      <Pressable
                        style={[
                          styles.exportMenuItem,
                          !exportsAllowed && styles.exportMenuItemLocked,
                        ]}
                        onPress={() => {
                          if (!exportsAllowed) {
                            setExportUpgradePrompt(true);
                            return;
                          }
                          const id = data.isoCode ?? data.id;
                          openExportUrl(geographyExportUrl(id, 'pdf', profile));
                          setExportMenuOpen(false);
                        }}
                      >
                        <Text style={styles.exportMenuText}>
                          {exportsAllowed ? 'Download PDF' : '🔒 Download PDF'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.exportMenuItem,
                          !exportsAllowed && styles.exportMenuItemLocked,
                        ]}
                        onPress={() => {
                          if (!exportsAllowed) {
                            setExportUpgradePrompt(true);
                            return;
                          }
                          const id = data.isoCode ?? data.id;
                          openExportUrl(geographyExportUrl(id, 'csv', profile));
                          setExportMenuOpen(false);
                        }}
                      >
                        <Text style={styles.exportMenuText}>
                          {exportsAllowed ? 'Download CSV' : '🔒 Download CSV'}
                        </Text>
                      </Pressable>
                      {exportUpgradePrompt ? (
                        <Text style={styles.exportUpgradePrompt}>
                          Upgrade to Pro to export
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {isWide ? (
              <View style={styles.sideCol}>
                <QuickFactsPanel
                  facts={data.quickFacts}
                  dimensions={data.tvi?.dimensions}
                />
                <PlanThisTripCard
                  countryName={data.name}
                  isoCode={data.isoCode ?? data.id}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const mono = {
  fontFamily: 'monospace' as const,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  scrollContentWide: {
    paddingHorizontal: spacing.xl,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.accent,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  center: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.md,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  errorBody: {
    color: colors.textMuted,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
  },
  errorBack: {
    marginTop: spacing.sm,
  },
  mainRow: {
    flexDirection: 'column',
    gap: spacing.lg,
  },
  mainRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
  },
  mainCol: {
    flex: 1,
    gap: spacing.md,
  },
  mainColWide: {
    flex: 7,
    minWidth: 0,
  },
  sideCol: {
    flex: 3,
    flexShrink: 0,
    minWidth: 260,
    maxWidth: 340,
    gap: spacing.md,
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky',
          top: spacing.md,
          alignSelf: 'flex-start',
        } as object)
      : null),
  },
  hero: {
    gap: spacing.sm,
  },
  qfPanel: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  qfPanelCompact: {
    marginTop: spacing.xs,
  },
  qfHeader: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.4,
  },
  qfRows: {
    gap: spacing.sm,
  },
  qfRowsCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  qfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qfRowCompact: {
    width: '48%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  qfLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
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
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'right',
  },
  qfValueMuted: {
    color: colors.textMuted,
  },
  planCard: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  planHeading: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    lineHeight: Math.round(typography.fontSize.lg * typography.lineHeight.tight),
  },
  planSub: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  planBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
  },
  planBtnPressed: {
    backgroundColor: colors.accentHover,
  },
  planBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  region: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.4,
  },
  country: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.display,
    fontWeight: typography.fontWeight.bold,
    lineHeight: Math.round(typography.fontSize.display * typography.lineHeight.tight),
  },
  overallBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  overallScore: {
    fontSize: 56,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 60,
  },
  overallLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
  },
  exportLink: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    textDecorationLine: 'underline',
  },
  signalPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  signalPillText: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  confDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  confText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.6,
  },
  dimStack: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  signalsSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signalsSectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  sectionState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  sectionStateText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  signalsEmpty: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  signalsEmptyText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  signalsEmptySub: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  signalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  signalIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalCardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  signalCategory: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  signalCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
  },
  signalCardDesc: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  signalTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.xxs,
  },
  signalTag: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xxs + 1,
  },
  signalTagText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  signalDimPill: {
    borderRadius: 4,
    paddingHorizontal: spacing.sm - 1,
    paddingVertical: spacing.xxs + 1,
    backgroundColor: colors.backgroundElevated,
  },
  signalDimPillText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  signalMeta: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xxs,
  },
  signalsFooter: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    lineHeight: Math.round(typography.fontSize.xs * typography.lineHeight.normal),
    marginTop: spacing.xxs,
  },
  dimCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  dimTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dimTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  dimNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dimName: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  dimDesc: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  crowdingQual: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  dimScoreCol: {
    alignItems: 'flex-end',
  },
  dimScore: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    lineHeight: Math.round(typography.fontSize.xl * typography.lineHeight.tight),
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  barCaption: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    marginTop: -spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  tag: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  noData: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  expandBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 2,
    gap: spacing.sm,
  },
  expandRow: {
    gap: spacing.xxs,
  },
  expandRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  expandLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    flex: 1,
  },
  expandValue: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  expandSource: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  expandEmpty: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  actionBtn: {
    backgroundColor: colors.scoreLow,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: colors.scoreMidLow,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    color: colors.accent,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  actionTextDisabled: {
    color: colors.textMuted,
  },
  actionTextGhost: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  exportWrap: {
    position: 'relative',
    zIndex: 5,
  },
  exportMenu: {
    marginTop: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
    minWidth: 160,
  },
  exportMenuItem: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exportMenuItemLocked: {
    opacity: 0.45,
  },
  exportUpgradePrompt: {
    color: colors.warning,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.sm + 2,
    paddingTop: spacing.xs,
  },
  exportMenuText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});
