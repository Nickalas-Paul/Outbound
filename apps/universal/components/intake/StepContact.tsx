import type { IntakePayload } from '@outbound/core';
import { type RefObject } from 'react';
import { Platform } from 'react-native';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { Field, inputBase } from '@/components/intake/Field';
import TurnstileWidget from '@/components/intake/TurnstileWidget';
import { colors, spacing, typography } from '@/theme/tokens';

const SITE_KEY = (process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();

export function StepContact({
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
  const tripType = useWatch({ control, name: 'tripType' });
  const showPoc = tripType === 'group';

  return (
    <View style={styles.step}>
      <Field
        fieldId="specialRequirements.accessibility"
        label="Accessibility needs"
        error={errors.specialRequirements?.accessibility?.message}
      >
        <Controller
          control={control}
          name="specialRequirements.accessibility"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              ref={firstFieldRef}
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Accessibility needs"
            />
          )}
        />
      </Field>

      <Field
        fieldId="specialRequirements.dietary"
        label="Dietary requirements"
        error={errors.specialRequirements?.dietary?.message}
      >
        <Controller
          control={control}
          name="specialRequirements.dietary"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Dietary requirements"
            />
          )}
        />
      </Field>

      <Field
        fieldId="specialRequirements.mobility"
        label="Mobility considerations"
        error={errors.specialRequirements?.mobility?.message}
      >
        <Controller
          control={control}
          name="specialRequirements.mobility"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Mobility considerations"
            />
          )}
        />
      </Field>

      <Field
        fieldId="specialRequirements.religious"
        label="Religious observances"
        error={errors.specialRequirements?.religious?.message}
      >
        <Controller
          control={control}
          name="specialRequirements.religious"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Religious observances"
            />
          )}
        />
      </Field>

      <Field
        fieldId="notes"
        label="Anything else we should know?"
        error={errors.notes?.message}
      >
        <Controller
          control={control}
          name="notes"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={[inputBase, styles.textArea]}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Additional notes"
            />
          )}
        />
      </Field>

      {showPoc ? (
        <View style={styles.pocBlock}>
          <Text style={styles.pocHeading}>Group point of contact</Text>
          <Field
            fieldId="pointOfContact.name"
            label="Organizer name"
            required
            error={errors.pointOfContact?.name?.message}
          >
            <Controller
              control={control}
              name="pointOfContact.name"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Name"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Organizer name"
                />
              )}
            />
          </Field>
          <Field
            fieldId="pointOfContact.email"
            label="Organizer email"
            required
            error={errors.pointOfContact?.email?.message}
          >
            <Controller
              control={control}
              name="pointOfContact.email"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Organizer email"
                />
              )}
            />
          </Field>
          <Field
            fieldId="pointOfContact.phone"
            label="Organizer phone"
            error={errors.pointOfContact?.phone?.message}
          >
            <Controller
              control={control}
              name="pointOfContact.phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  accessibilityLabel="Organizer phone"
                />
              )}
            />
          </Field>
        </View>
      ) : null}

      <Field
        fieldId="name"
        label="Your name"
        required
        error={errors.name?.message}
      >
        <Controller
          control={control}
          name="name"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Your name"
              autoComplete="name"
            />
          )}
        />
      </Field>

      <Field
        fieldId="email"
        label="Your email"
        required
        error={errors.email?.message}
      >
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Your email"
              autoComplete="email"
            />
          )}
        />
      </Field>

      <Field
        fieldId="phone"
        label="Your phone"
        error={errors.phone?.message}
      >
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              style={inputBase}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              onSubmitEditing={() => onAdvance?.()}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              accessibilityLabel="Your phone"
              autoComplete="tel"
              returnKeyType="done"
            />
          )}
        />
      </Field>

      {Platform.OS === 'web' && SITE_KEY ? (
        <Field
          fieldId="turnstileToken"
          label="Verification"
          required
          error={errors.turnstileToken?.message}
        >
          <TurnstileWidget
            siteKey={SITE_KEY}
            onToken={(token) =>
              setValue('turnstileToken', token, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            onExpire={() =>
              setValue('turnstileToken', '', { shouldValidate: true })
            }
          />
        </Field>
      ) : null}
      {/* TODO: native Turnstile via WebView if mobile app goes public */}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.lg },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.sm + 2,
  },
  pocBlock: {
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  pocHeading: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
});
