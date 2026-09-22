import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import PreferenceSegmentedControl from './PreferenceSegmentedControl';
import SavedSearchesPanel from './SavedSearchesPanel';
import type { ExplorerFilterState } from '@/lib/explorerFilters';
import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  filters: ExplorerFilterState;
  onChange: (patch: Partial<ExplorerFilterState>) => void;
  onReset: () => void;
  style?: object;
};

const TRIP_OPTIONS = [
  { value: 'solo' as const, label: 'Solo' },
  { value: 'couple' as const, label: 'Couple' },
  { value: 'family' as const, label: 'Family' },
  { value: 'group' as const, label: 'Group' },
];

const BUDGET_OPTIONS = [
  { value: 'budget' as const, label: '$' },
  { value: 'moderate' as const, label: '$$' },
  { value: 'upscale' as const, label: '$$$' },
  { value: 'luxury' as const, label: '$$$$' },
];

const SAFETY_OPTIONS = [
  { value: 'adventurous' as const, label: 'Go Anywhere' },
  { value: 'standard' as const, label: 'Standard' },
  { value: 'strict' as const, label: 'Play it Safe' },
];

const CROWDING_OPTIONS = [
  { value: 'popular' as const, label: 'Iconic' },
  { value: 'balanced' as const, label: 'Balanced' },
  { value: 'hidden_gems' as const, label: 'Hidden Gems' },
];

const EASE_OPTIONS = [
  { value: 'flexible' as const, label: "I'll Figure It Out" },
  { value: 'moderate' as const, label: 'Some Planning' },
  { value: 'effortless' as const, label: 'Make It Easy' },
];

function PrefRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function FilterSidebar({
  filters,
  onChange,
  onReset,
  style,
}: Props) {
  return (
    <View style={StyleSheet.flatten([styles.sidebar, style])}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PREFERENCES</Text>
        <Pressable onPress={onReset} hitSlop={8}>
          <Text style={styles.reset}>Reset</Text>
        </Pressable>
      </View>

      <PrefRow label="Trip Type">
        <PreferenceSegmentedControl
          options={TRIP_OPTIONS}
          value={filters.tripType}
          onChange={(tripType) => onChange({ tripType })}
          compact
        />
      </PrefRow>

      <PrefRow label="Budget">
        <PreferenceSegmentedControl
          options={BUDGET_OPTIONS}
          value={filters.budgetTier}
          onChange={(budgetTier) => onChange({ budgetTier })}
          compact
        />
      </PrefRow>

      <PrefRow label="Safety Comfort">
        <PreferenceSegmentedControl
          options={SAFETY_OPTIONS}
          value={filters.safetyTolerance}
          onChange={(safetyTolerance) => onChange({ safetyTolerance })}
        />
      </PrefRow>

      <PrefRow label="Off the Beaten Path">
        <PreferenceSegmentedControl
          options={CROWDING_OPTIONS}
          value={filters.crowdingPreference}
          onChange={(crowdingPreference) => onChange({ crowdingPreference })}
        />
      </PrefRow>

      <PrefRow label="Ease of Travel">
        <PreferenceSegmentedControl
          options={EASE_OPTIONS}
          value={filters.easeOfTravel}
          onChange={(easeOfTravel) => onChange({ easeOfTravel })}
        />
      </PrefRow>

      <SavedSearchesPanel filters={filters} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 280,
    backgroundColor: colors.backgroundElevated,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md + 2,
    flexShrink: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1.4,
  },
  reset: {
    color: colors.accentHover,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  row: {
    gap: spacing.xs,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
});
