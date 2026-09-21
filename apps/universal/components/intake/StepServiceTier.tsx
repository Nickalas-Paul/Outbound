import type { IntakePayload } from '@outbound/core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { Field, inputBase } from '@/components/intake/Field';
import { colors, spacing, typography } from '@/theme/tokens';

const ITINERARY_INCLUDES = [
  'Personalized multi-day itinerary',
  'Verified accommodations and activities',
  'Booking links for each segment',
  'Email support for revisions',
];

const FULL_SERVICE_INCLUDES = [
  'Everything in Itinerary Planning',
  'Automated flight and hotel booking',
  'Tour and experience reservations',
  'Booking management and modifications',
  'Priority support',
];

export function StepServiceTier({
  firstFieldRef,
  onAdvance,
}: {
  firstFieldRef: RefObject<TextInput | null>;
  onAdvance?: () => void;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<IntakePayload>();
  const serviceTier = useWatch({ control, name: 'serviceTier' });
  const isFullService = serviceTier === 'full_service';

  return (
    <View style={styles.step}>
      <Text style={styles.intro}>
        Choose how much support you want for this trip. You can change this
        before submitting.
      </Text>

      <Controller
        control={control}
        name="serviceTier"
        render={({ field: { value, onChange } }) => (
          <View style={styles.cards}>
            <Pressable
              style={[
                styles.card,
                styles.cardSecondary,
                value === 'itinerary_only' && styles.cardSelected,
              ]}
              onPress={() => onChange('itinerary_only')}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === 'itinerary_only' }}
              accessibilityLabel="Itinerary Planning"
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Itinerary Planning</Text>
                {value === 'itinerary_only' ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={colors.accent}
                  />
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </View>
              {/* TODO: finalize pricing */}
              <Text style={styles.price}>$150–300</Text>
              <Text style={styles.cardBody}>
                Receive a researched, verified itinerary tailored to your trip.
                Includes booking links and recommendations. You handle the
                bookings yourself.
              </Text>
              <View style={styles.includeList}>
                {ITINERARY_INCLUDES.map((item) => (
                  <Text key={item} style={styles.includeItem}>
                    · {item}
                  </Text>
                ))}
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.card,
                styles.cardPremium,
                value === 'full_service' && styles.cardPremiumSelected,
              ]}
              onPress={() => onChange('full_service')}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === 'full_service' }}
              accessibilityLabel="Full-Service Concierge"
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Most Popular</Text>
              </View>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Full-Service Concierge</Text>
                {value === 'full_service' ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={22}
                    color={colors.accent}
                  />
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </View>
              {/* TODO: finalize pricing */}
              <Text style={styles.price}>$400–800+</Text>
              <Text style={styles.cardBody}>
                Everything in Itinerary Planning, plus we handle all bookings
                end-to-end. Flights, hotels, tours — confirmed and managed for
                you.
              </Text>
              <View style={styles.includeList}>
                {FULL_SERVICE_INCLUDES.map((item) => (
                  <Text key={item} style={styles.includeItem}>
                    · {item}
                  </Text>
                ))}
              </View>
            </Pressable>
          </View>
        )}
      />

      {isFullService ? (
        <View style={styles.travelerBlock}>
          <Text style={styles.travelerHeading}>Traveler Details</Text>
          <Text style={styles.travelerSub}>
            We need a few more details to handle bookings on your behalf.
          </Text>

          <Field
            fieldId="fullLegalName"
            label="Full legal name"
            required
            hint="As it appears on your passport or ID"
            error={errors.fullLegalName?.message}
          >
            <Controller
              control={control}
              name="fullLegalName"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  ref={firstFieldRef}
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Legal name"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Full legal name"
                  autoComplete="name"
                />
              )}
            />
          </Field>

          <Field
            fieldId="dateOfBirth"
            label="Date of birth"
            hint="Required by airlines for flight booking — you can provide this later (YYYY-MM-DD)"
            error={errors.dateOfBirth?.message}
          >
            <Controller
              control={control}
              name="dateOfBirth"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Date of birth"
                  autoComplete="off"
                />
              )}
            />
          </Field>

          <Field
            fieldId="passportCountry"
            label="Passport country"
            hint="Country that issued your travel document — optional for now"
            error={errors.passportCountry?.message}
          >
            <Controller
              control={control}
              name="passportCountry"
              render={({ field: { value, onChange, onBlur } }) => (
                <TextInput
                  style={inputBase}
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={() => onAdvance?.()}
                  placeholder="e.g. United States"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Passport country"
                  returnKeyType="done"
                />
              )}
            />
          </Field>

          <View style={styles.paymentNote}>
            <Text style={styles.paymentNoteText}>
              Payment details will be collected securely when your itinerary is
              confirmed and you&apos;re ready to book. No payment is needed now.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: spacing.lg },
  intro: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
  },
  cards: { gap: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  cardSecondary: {
    borderColor: colors.border,
  },
  cardSelected: {
    borderColor: colors.accent,
  },
  cardPremium: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: 'rgba(91, 141, 239, 0.08)',
  },
  cardPremiumSelected: {
    backgroundColor: 'rgba(91, 141, 239, 0.16)',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
  },
  badgeText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
  },
  price: {
    color: colors.accent,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
  includeList: { gap: spacing.xxs },
  includeItem: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
  travelerBlock: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  travelerHeading: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  travelerSub: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
    marginTop: -spacing.xs,
  },
  paymentNote: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
  },
  paymentNoteText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.sm,
    lineHeight: Math.round(typography.fontSize.sm * typography.lineHeight.normal),
  },
});
