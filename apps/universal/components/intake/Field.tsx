import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  fieldId: string;
  children: ReactNode;
};

export function Field({
  label,
  required,
  error,
  hint,
  fieldId,
  children,
}: Props) {
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} nativeID={`${fieldId}-label`}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {hint ? (
        <Text style={styles.hint} nativeID={hintId}>
          {hint}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text
          style={styles.error}
          nativeID={errorId}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export const inputBase = {
  minHeight: 48,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 8,
  backgroundColor: colors.backgroundElevated,
  color: colors.textPrimary,
  fontSize: typography.fontSize.md,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm + 2,
} as const;

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  required: {
    color: colors.error,
  },
  hint: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  error: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
  },
});
