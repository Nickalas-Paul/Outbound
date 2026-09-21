import type { IntakePayload } from '@outbound/core';
import { useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { Field, inputBase } from '@/components/intake/Field';
import {
  ACCOMMODATION_OPTIONS,
  CURRENCY_OPTIONS,
  INTEREST_PRESETS,
} from '@/components/intake/constants';
import { colors, spacing, typography } from '@/theme/tokens';

export function StepPreferences({
  firstFieldRef,
  onAdvance,
}: {
  firstFieldRef: RefObject<TextInput | null>;
  onAdvance?: () => void;
}) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<IntakePayload>();
  const interests = useWatch({ control, name: 'interests' }) ?? [];
  const [customInterest, setCustomInterest] = useState('');

  const toggleInterest = (label: string) => {
    const next = interests.includes(label)
      ? interests.filter((i) => i !== label)
      : [...interests, label];
    setValue('interests', next, { shouldDirty: true, shouldValidate: true });
  };

  const addCustomInterest = () => {
    const t = customInterest.trim();
    if (!t) return;
    if (!interests.includes(t)) {
      setValue('interests', [...interests, t], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    setCustomInterest('');
  };

  return (
    <View style={styles.step}>
      <Field
        fieldId="budgetRange"
        label="Budget per person"
        hint="Optional. Leave blank if unsure."
        error={
          errors.budgetRange?.message ||
          errors.budgetRange?.min?.message ||
          errors.budgetRange?.max?.message
        }
      >
        <View style={styles.budgetRow}>
          <Controller
            control={control}
            name="budgetRange.min"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                ref={firstFieldRef}
                style={[inputBase, styles.budgetInput]}
                value={value != null && !Number.isNaN(value) ? String(value) : ''}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^\d.]/g, '');
                  if (!cleaned) {
                    onChange(undefined);
                    return;
                  }
                  onChange(Number(cleaned));
                }}
                onBlur={onBlur}
                placeholder="Min"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                accessibilityLabel="Budget minimum"
              />
            )}
          />
          <Text style={styles.budgetSep}>–</Text>
          <Controller
            control={control}
            name="budgetRange.max"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                style={[inputBase, styles.budgetInput]}
                value={value != null && !Number.isNaN(value) ? String(value) : ''}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^\d.]/g, '');
                  if (!cleaned) {
                    onChange(undefined);
                    return;
                  }
                  onChange(Number(cleaned));
                }}
                onBlur={onBlur}
                placeholder="Max"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                accessibilityLabel="Budget maximum"
              />
            )}
          />
        </View>
        <Controller
          control={control}
          name="budgetRange.currency"
          render={({ field: { value, onChange } }) => (
            <View style={styles.currencyRow}>
              {CURRENCY_OPTIONS.map((c) => {
                const active = (value || 'USD') === c;
                return (
                  <Pressable
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onChange(c)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </Field>

      <Field
        fieldId="accommodationStyle"
        label="Accommodation style"
        error={errors.accommodationStyle?.message}
      >
        <Controller
          control={control}
          name="accommodationStyle"
          render={({ field: { value, onChange } }) => (
            <View style={styles.segmentCol}>
              {ACCOMMODATION_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() =>
                      onChange(active ? undefined : opt.value)
                    }
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        active && styles.segmentTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      </Field>

      <Field
        fieldId="interests"
        label="Interests"
        error={errors.interests?.message}
      >
        <View style={styles.tagWrap}>
          {INTEREST_PRESETS.map((label) => {
            const active = interests.includes(label);
            return (
              <Pressable
                key={label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleInterest(label)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.customRow}>
          <TextInput
            style={[inputBase, styles.customInput]}
            value={customInterest}
            onChangeText={setCustomInterest}
            onSubmitEditing={addCustomInterest}
            placeholder="Add a custom interest"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Custom interest"
            returnKeyType="done"
          />
          <Pressable
            style={styles.addBtn}
            onPress={addCustomInterest}
            accessibilityRole="button"
            accessibilityLabel="Add custom interest"
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      </Field>

      <Field
        fieldId="alreadyBooked"
        label="Already booked"
        hint="Flights, hotels, tours — anything already locked in."
        error={errors.alreadyBooked?.message}
      >
        <Controller
          control={control}
          name="alreadyBooked"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[inputBase, styles.textArea]}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              onSubmitEditing={() => onAdvance?.()}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              blurOnSubmit
              accessibilityLabel="Already booked"
              returnKeyType="next"
            />
          )}
        />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.lg },
  budgetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  budgetInput: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 110,
  },
  budgetSep: { color: colors.textMuted, fontSize: typography.fontSize.lg },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  segmentCol: { gap: spacing.sm },
  segment: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  segmentActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(91, 141, 239, 0.15)',
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
  },
  segmentTextActive: { color: colors.textPrimary },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundElevated,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(91, 141, 239, 0.15)',
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
  },
  chipTextActive: { color: colors.textPrimary },
  customRow: { flexDirection: 'row', gap: spacing.sm },
  customInput: { flex: 1 },
  addBtn: {
    minHeight: 48,
    minWidth: 72,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
  },
});
