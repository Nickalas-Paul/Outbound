import type { IntakePayload } from '@outbound/core';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';

import { Field, inputBase } from '@/components/intake/Field';
import {
  INTEREST_PRESETS,
  TRIP_TYPE_OPTIONS,
} from '@/components/intake/constants';
import { listCountries } from '@/services/geographies';
import { colors, spacing, typography } from '@/theme/tokens';

type CountryOpt = { name: string; isoCode: string };

export function StepWhereWhen({
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'destinations',
  });
  const tripType = useWatch({ control, name: 'tripType' });
  const [query, setQuery] = useState('');
  const [countries, setCountries] = useState<CountryOpt[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listCountries()
      .then((list) => {
        if (cancelled) return;
        setCountries(
          list
            .filter((c) => c.isoCode)
            .map((c) => ({ name: c.name, isoCode: c.isoCode! }))
        );
      })
      .catch(() => {
        /* autocomplete optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return countries
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.isoCode.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [countries, query]);

  const addDestination = (iso: string, name: string) => {
    const exists = fields.some(
      (f) =>
        (iso && f.iso === iso) ||
        f.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      setQuery('');
      setShowSuggest(false);
      return;
    }
    append({ iso, name });
    setQuery('');
    setShowSuggest(false);
  };

  const addFreeText = () => {
    const name = query.trim();
    if (!name) return;
    addDestination('', name);
  };

  return (
    <View style={styles.step}>
      <Field
        fieldId="destinations"
        label="Destinations"
        required
        error={
          errors.destinations?.message ||
          (errors.destinations as { root?: { message?: string } })?.root
            ?.message
        }
        hint="Add one or more countries. Start typing to search."
      >
        <View style={styles.destRow}>
          <TextInput
            ref={firstFieldRef}
            style={[inputBase, styles.destInput]}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setShowSuggest(true);
            }}
            onSubmitEditing={addFreeText}
            placeholder="e.g. Japan, France…"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Destination search"
            returnKeyType="done"
          />
          <Pressable
            style={styles.addBtn}
            onPress={addFreeText}
            accessibilityRole="button"
            accessibilityLabel="Add destination"
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
        {showSuggest && suggestions.length > 0 ? (
          <View style={styles.suggestBox}>
            {suggestions.map((s) => (
              <Pressable
                key={s.isoCode}
                style={styles.suggestRow}
                onPress={() => addDestination(s.isoCode, s.name)}
              >
                <Text style={styles.suggestText}>
                  {s.name}{' '}
                  <Text style={styles.suggestIso}>({s.isoCode})</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.tagRow}>
          {fields.map((f, i) => (
            <View
              key={f.id}
              style={[
                styles.tag,
                f.iso ? styles.tagPrefill : null,
              ]}
            >
              <Text style={styles.tagText}>
                {f.name}
                {f.iso ? ` (${f.iso})` : ''}
              </Text>
              <Pressable
                onPress={() => remove(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${f.name}`}
              >
                <Text style={styles.tagRemove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Field>

      <Field
        fieldId="tripType"
        label="Trip type"
        required
        error={errors.tripType?.message}
      >
        <Controller
          control={control}
          name="tripType"
          render={({ field: { value, onChange } }) => (
            <View style={styles.segmentCol}>
              {TRIP_TYPE_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.segment, active && styles.segmentActive]}
                    onPress={() => {
                      onChange(opt.value);
                      setValue('groupSize', opt.defaultSize, {
                        shouldDirty: true,
                      });
                    }}
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

      <View style={styles.dateRow}>
        <View style={styles.dateCol}>
          <Field
            fieldId="travelDates.start"
            label="Start date"
            required
            error={errors.travelDates?.start?.message}
            hint="YYYY-MM-DD"
          >
            <Controller
              control={control}
              name="travelDates.start"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-10-01"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Travel start date"
                  autoComplete="off"
                />
              )}
            />
          </Field>
        </View>
        <View style={styles.dateCol}>
          <Field
            fieldId="travelDates.end"
            label="End date"
            required
            error={errors.travelDates?.end?.message}
            hint="YYYY-MM-DD"
          >
            <Controller
              control={control}
              name="travelDates.end"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="2026-10-14"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Travel end date"
                  autoComplete="off"
                />
              )}
            />
          </Field>
        </View>
      </View>
      {errors.travelDates?.message ||
      (errors.travelDates as { root?: { message?: string } })?.root?.message ? (
        <Text style={styles.inlineError}>
          {errors.travelDates?.message ||
            (errors.travelDates as { root?: { message?: string } })?.root
              ?.message}
        </Text>
      ) : null}

      <Controller
        control={control}
        name="travelDates.flexible"
        render={({ field: { value, onChange } }) => (
          <Pressable
            style={styles.checkRow}
            onPress={() => onChange(!value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: Boolean(value) }}
          >
            <View style={[styles.checkbox, value && styles.checkboxOn]}>
              {value ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>My dates are flexible</Text>
          </Pressable>
        )}
      />

      <Field
        fieldId="groupSize"
        label="Group size"
        required
        error={errors.groupSize?.message}
        hint={
          tripType
            ? `Suggested for ${tripType}: ${
                TRIP_TYPE_OPTIONS.find((o) => o.value === tripType)?.defaultSize
              }`
            : undefined
        }
      >
        <Controller
          control={control}
          name="groupSize"
          render={({ field: { value, onChange } }) => (
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => onChange(Math.max(1, (value ?? 1) - 1))}
                accessibilityRole="button"
                accessibilityLabel="Decrease group size"
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <TextInput
                style={[inputBase, styles.stepperInput]}
                value={String(value ?? 1)}
                onChangeText={(t) => {
                  const n = parseInt(t.replace(/\D/g, ''), 10);
                  if (Number.isNaN(n)) {
                    onChange(1);
                    return;
                  }
                  onChange(Math.min(50, Math.max(1, n)));
                }}
                onSubmitEditing={() => onAdvance?.()}
                keyboardType="number-pad"
                accessibilityLabel="Group size"
                returnKeyType="next"
              />
              <Pressable
                style={styles.stepperBtn}
                onPress={() => onChange(Math.min(50, (value ?? 1) + 1))}
                accessibilityRole="button"
                accessibilityLabel="Increase group size"
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
          )}
        />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.lg },
  destRow: { flexDirection: 'row', gap: spacing.sm },
  destInput: { flex: 1 },
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
  suggestBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestText: { color: colors.textPrimary, fontSize: typography.fontSize.md },
  suggestIso: { color: colors.textMuted },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  tagPrefill: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(91, 141, 239, 0.12)',
  },
  tagText: { color: colors.textPrimary, fontSize: typography.fontSize.sm },
  tagRemove: {
    color: colors.textMuted,
    fontSize: typography.fontSize.lg,
    lineHeight: 20,
  },
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
    fontWeight: typography.fontWeight.medium,
  },
  segmentTextActive: { color: colors.textPrimary },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dateCol: {
    flexGrow: 1,
    flexBasis: 140,
    minWidth: 140,
  },
  inlineError: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
    marginTop: -spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkMark: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  checkLabel: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  stepperBtnText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
  },
  stepperInput: {
    width: 72,
    textAlign: 'center',
  },
});
