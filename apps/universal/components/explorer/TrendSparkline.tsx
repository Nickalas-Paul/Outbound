import { Text, View, StyleSheet } from 'react-native';

import { colors, typography } from '@/theme/tokens';

type Point = { year: number; score: number };

type Props = {
  data: Point[];
  color: string;
  projectionData?: Point[];
  width?: number;
  height?: number;
};

/** Native fallback — plain text summary (recharts is web-only). */
export default function TrendSparkline({ data, projectionData = [] }: Props) {
  if (!data.length) {
    return <Text style={styles.fallback}>No historical series</Text>;
  }
  const first = data[0];
  const last = data[data.length - 1];
  const proj2 = projectionData.find((p) => p.year === last.year + 2);
  const proj5 =
    projectionData.find((p) => p.year === last.year + 5) ??
    projectionData[projectionData.length - 1];

  return (
    <View style={styles.wrap}>
      <Text style={styles.fallback}>
        {first.year}–{last.year}: {first.score.toFixed(0)} → {last.score.toFixed(0)}
      </Text>
      {proj2 || proj5 ? (
        <Text style={styles.proj}>
          Outlook
          {proj2 ? ` · 2yr ${Math.round(proj2.score)}` : ''}
          {proj5 ? ` · 5yr ${Math.round(proj5.score)}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 48,
    justifyContent: 'center',
    gap: 2,
  },
  fallback: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
  },
  proj: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.xs,
    opacity: 0.85,
  },
});
