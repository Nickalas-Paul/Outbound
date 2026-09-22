import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/tokens';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: Array<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Slightly denser labels for 4-option rows */
  compact?: boolean;
};

export default function PreferenceSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.btn,
              compact && styles.btnCompact,
              active && styles.btnActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.text,
                compact && styles.textCompact,
                active && styles.textActive,
              ]}
              numberOfLines={2}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  btn: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 64,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCompact: {
    flexBasis: '20%',
    minWidth: 56,
    paddingVertical: 7,
  },
  btnActive: {
    backgroundColor: '#1e2a44',
    borderColor: colors.accentHover,
  },
  text: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
  },
  textCompact: {
    fontSize: 11,
  },
  textActive: {
    color: colors.textPrimary,
  },
});
