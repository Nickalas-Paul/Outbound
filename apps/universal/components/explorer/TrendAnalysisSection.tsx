import {
  getOrderedDimensionDisplay,
  type DimensionKey,
} from '@outbound/core';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { DimensionTrend, TrendData } from '@/services/geographies';
import { colors, spacing, typography } from '@/theme/tokens';

import TrendSparkline from './TrendSparkline';

const BASE_DIMS = getOrderedDimensionDisplay().filter((d) => !d.isComposite);

function directionMeta(direction: DimensionTrend['direction']): {
  arrow: string;
  label: string;
  color: string;
} {
  if (direction === 'improving') {
    return { arrow: '↑', label: 'Improving', color: colors.success };
  }
  if (direction === 'declining') {
    return { arrow: '↓', label: 'Declining', color: colors.error };
  }
  return { arrow: '→', label: 'Stable', color: colors.textMuted };
}

function confidenceDot(level: string): string {
  if (level === 'high') return colors.success;
  if (level === 'medium') return colors.warning;
  return colors.error;
}

function fmtScore(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

function fmtRate(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0.0';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}

function fmtInterval(lo: number | null, hi: number | null): string {
  if (lo == null || hi == null) return '—';
  return `${Math.round(lo)}-${Math.round(hi)}`;
}

function scoreTone(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return colors.accent;
  if (score >= 65) return colors.success;
  if (score >= 40) return colors.warning;
  return colors.error;
}

function buildProjectionPoints(
  trend: DimensionTrend
): Array<{ year: number; score: number }> {
  const series = trend.historicalScores ?? [];
  const lastYear =
    series.length > 0
      ? series[series.length - 1].year
      : trend.yearRange?.[1] ?? new Date().getUTCFullYear();
  const points: Array<{ year: number; score: number }> = [];
  if (trend.projected2yr != null) {
    points.push({ year: lastYear + 2, score: trend.projected2yr });
  }
  if (trend.projected5yr != null) {
    points.push({ year: lastYear + 5, score: trend.projected5yr });
  }
  return points;
}

function DimensionTrendCard({
  label,
  trend,
}: {
  label: string;
  dimKey: DimensionKey;
  trend: DimensionTrend | null;
}) {
  const color = scoreTone(trend?.currentScore ?? null);

  if (!trend) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.insufficient}>Insufficient historical data</Text>
      </View>
    );
  }

  const dir = directionMeta(trend.direction);
  const series = trend.historicalScores ?? [];
  const projections = buildProjectionPoints(trend);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={[styles.dirText, { color: dir.color }]}>
          {dir.arrow} {dir.label} ({fmtRate(trend.annualizedRate)}/yr)
        </Text>
      </View>

      <View style={styles.cardBody}>
        <TrendSparkline
          data={series}
          color={color}
          projectionData={projections}
        />
        <View style={styles.projCol}>
          <Text style={styles.projLine}>
            Current:{' '}
            <Text style={styles.projVal}>{fmtScore(trend.currentScore)}</Text>
          </Text>
          <Text style={styles.projLine}>
            2yr:{' '}
            <Text style={styles.projVal}>
              {fmtScore(trend.projected2yr)} (
              {fmtInterval(trend.confidence.lower2yr, trend.confidence.upper2yr)})
            </Text>
          </Text>
          <Text style={[styles.projLine, styles.projMuted]}>
            5yr:{' '}
            <Text style={styles.projVal}>
              {fmtScore(trend.projected5yr)} (
              {fmtInterval(trend.confidence.lower5yr, trend.confidence.upper5yr)})
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: confidenceDot(trend.trendConfidence) },
          ]}
        />
        <Text style={styles.metaText}>
          {trend.trendConfidence.charAt(0).toUpperCase() +
            trend.trendConfidence.slice(1)}{' '}
          confidence · {trend.dataPoints} data points
          {trend.yearRange
            ? ` · ${trend.yearRange[0]}–${trend.yearRange[1]}`
            : ''}
        </Text>
      </View>
    </View>
  );
}

function TrajectorySummary({
  score,
  trends,
}: {
  score: number | null;
  trends: TrendData['trends'];
}) {
  const lines = useMemo(() => {
    return BASE_DIMS.map((dim) => {
      const t = trends[dim.key];
      if (!t) {
        return {
          key: dim.key,
          label: dim.label,
          text: '— no trend',
          color: colors.textMuted,
        };
      }
      const dir = directionMeta(t.direction);
      return {
        key: dim.key,
        label: dim.label,
        text: `${dir.arrow} ${fmtRate(t.annualizedRate)}/yr`,
        color: dir.color,
      };
    });
  }, [trends]);

  return (
    <View style={[styles.card, styles.trajCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Trajectory (composite)</Text>
        <Text style={styles.trajScore}>Score: {fmtScore(score)}</Text>
      </View>
      <Text style={styles.trajIntro}>
        Derived from trend momentum across all dimensions:
      </Text>
      <View style={styles.trajGrid}>
        {lines.map((line) => (
          <Text key={line.key} style={styles.trajLine}>
            <Text style={{ color: line.color }}>{line.text}</Text>
            <Text style={styles.trajDim}> {line.label}</Text>
          </Text>
        ))}
      </View>
    </View>
  );
}

type Props = {
  trendData: TrendData | null;
  trajectoryScore: number | null;
  loading?: boolean;
};

export default function TrendAnalysisSection({
  trendData,
  trajectoryScore,
  loading,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={styles.section}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={styles.sectionHeaderRow}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.sectionHeader}>Trends & Outlook</Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textMuted}
        />
      </Pressable>

      {!expanded ? (
        <Text style={styles.collapsedHint}>
          Tap to view historical scores and 2yr / 5yr projections
        </Text>
      ) : loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.insufficient}>Loading trends…</Text>
        </View>
      ) : !trendData ? (
        <Text style={styles.insufficient}>
          No trend data available for this destination.
        </Text>
      ) : (
        <>
          <Text style={styles.legendNote}>
            Solid = historical · Dashed = OLS projection (2yr / 5yr)
          </Text>
          {BASE_DIMS.map((dim) => (
            <DimensionTrendCard
              key={dim.key}
              label={dim.label}
              dimKey={dim.key}
              trend={trendData.trends[dim.key] ?? null}
            />
          ))}
          <TrajectorySummary
            score={trajectoryScore}
            trends={trendData.trends}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  collapsedHint: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  legendNote: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  trajCard: {
    borderColor: colors.accent,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  dirText: {
    fontSize: typography.fontSize.sm,
  },
  cardBody: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  projCol: {
    gap: spacing.xxs + 1,
    minWidth: 140,
  },
  projLine: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  projMuted: {
    opacity: 0.85,
  },
  projVal: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    flex: 1,
  },
  insufficient: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
  },
  trajScore: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  trajIntro: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  trajGrid: {
    gap: spacing.xs,
  },
  trajLine: {
    fontSize: typography.fontSize.sm,
  },
  trajDim: {
    color: colors.textMuted,
  },
});
