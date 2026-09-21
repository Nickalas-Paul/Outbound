import {
  intakeSchema,
  type IntakePayload,
} from '@outbound/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  FormProvider,
  useForm,
  type DefaultValues,
  type FieldPath,
} from 'react-hook-form';

import { StepContact } from '@/components/intake/StepContact';
import { StepPreferences } from '@/components/intake/StepPreferences';
import { StepServiceTier } from '@/components/intake/StepServiceTier';
import { StepWhereWhen } from '@/components/intake/StepWhereWhen';
import {
  STEP_META,
  STEP_TRIGGER_FIELDS,
} from '@/components/intake/constants';
import { ApiError } from '@/services/api';
import { useAuth } from '@/services/auth';
import { submitIntake } from '@/services/intake';
import { colors, spacing, typography } from '@/theme/tokens';

function sanitizePayload(
  values: IntakePayload,
  honeypotValue: string | undefined
): IntakePayload {
  const br = values.budgetRange;
  const hasBudget =
    br != null &&
    typeof br.min === 'number' &&
    typeof br.max === 'number' &&
    !Number.isNaN(br.min) &&
    !Number.isNaN(br.max);

  const sr = values.specialRequirements;
  const cleanedSrEntries = sr
    ? Object.entries(sr).filter(
        ([, v]) => typeof v === 'string' && v.trim().length > 0
      )
    : [];
  const specialRequirements =
    cleanedSrEntries.length > 0
      ? (Object.fromEntries(cleanedSrEntries) as IntakePayload['specialRequirements'])
      : undefined;

  let pointOfContact = values.pointOfContact;
  if (values.tripType !== 'group') {
    pointOfContact = undefined;
  } else if (
    pointOfContact &&
    (!pointOfContact.name?.trim() || !pointOfContact.email?.trim())
  ) {
    pointOfContact = undefined;
  }

  return {
    ...values,
    name: values.name.trim(),
    email: values.email.trim(),
    phone: values.phone?.trim() || undefined,
    budgetRange: hasBudget
      ? {
          min: br!.min,
          max: br!.max,
          currency: (br!.currency || 'USD').toUpperCase(),
        }
      : undefined,
    accommodationStyle: values.accommodationStyle?.trim() || undefined,
    interests:
      values.interests && values.interests.length > 0
        ? values.interests
        : undefined,
    alreadyBooked: values.alreadyBooked?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    specialRequirements,
    pointOfContact,
    fullLegalName: values.fullLegalName?.trim() || undefined,
    dateOfBirth: values.dateOfBirth?.trim() || undefined,
    passportCountry: values.passportCountry?.trim() || undefined,
    turnstileToken: values.turnstileToken ?? '',
    honeypotField: honeypotValue?.trim() || undefined,
  };
}

const DEFAULTS: DefaultValues<IntakePayload> = {
  name: '',
  email: '',
  phone: '',
  destinations: [],
  tripType: 'couple',
  groupSize: 2,
  travelDates: { start: '', end: '', flexible: false },
  budgetRange: { min: undefined as unknown as number, max: undefined as unknown as number, currency: 'USD' },
  accommodationStyle: undefined,
  interests: [],
  alreadyBooked: '',
  notes: '',
  specialRequirements: {
    accessibility: '',
    dietary: '',
    mobility: '',
    religious: '',
    other: '',
  },
  pointOfContact: { name: '', email: '', phone: '' },
  serviceTier: 'itinerary_only',
  fullLegalName: '',
  dateOfBirth: '',
  passportCountry: '',
  turnstileToken: '',
  honeypotField: undefined,
};

export default function IntakeForm() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const compactProgress = width < 420;
  const params = useLocalSearchParams<{
    destination?: string;
    name?: string;
  }>();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    tripId: string;
    message: string;
  } | null>(null);
  const [honeypotWebsite, setHoneypotWebsite] = useState('');
  const [honeypotCompany, setHoneypotCompany] = useState('');
  const firstFieldRef = useRef<TextInput | null>(null);
  const prefillDone = useRef(false);
  const authPrefillDone = useRef(false);

  const form = useForm<IntakePayload>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(intakeSchema as any),
    shouldUnregister: false,
    mode: 'onTouched',
    defaultValues: DEFAULTS,
  });

  const {
    trigger,
    setValue,
    setError,
    getValues,
    clearErrors,
  } = form;

  // URL destination pre-fill
  useEffect(() => {
    if (prefillDone.current) return;
    const iso = String(params.destination ?? '').trim().toUpperCase();
    const name = String(params.name ?? '').trim();
    if (!iso && !name) return;
    prefillDone.current = true;
    setValue(
      'destinations',
      [
        {
          iso: iso.length >= 2 && iso.length <= 3 ? iso : '',
          name: name || iso,
        },
      ],
      { shouldDirty: false }
    );
  }, [params.destination, params.name, setValue]);

  // Auth pre-fill
  useEffect(() => {
    if (authPrefillDone.current || !user) return;
    authPrefillDone.current = true;
    if (user.displayName && !getValues('name')) {
      setValue('name', user.displayName);
    }
    if (user.email && !getValues('email')) {
      setValue('email', user.email);
    }
  }, [user, getValues, setValue]);

  // Focus first field when step changes
  useEffect(() => {
    const t = setTimeout(() => {
      firstFieldRef.current?.focus?.();
    }, 80);
    return () => clearTimeout(t);
  }, [step]);

  const goNext = async () => {
    setFormError(null);
    clearErrors();

    // Soft-clear empty budget so optional field does not fail step validation
    const br = getValues('budgetRange');
    if (
      br &&
      (br.min == null || Number.isNaN(br.min)) &&
      (br.max == null || Number.isNaN(br.max))
    ) {
      setValue('budgetRange', undefined as unknown as IntakePayload['budgetRange']);
    }

    const fields = STEP_TRIGGER_FIELDS[step] as FieldPath<IntakePayload>[];
    const ok = await trigger(fields);
    if (!ok) return;

    if (step === 2) {
      const tripType = getValues('tripType');
      if (tripType === 'group') {
        const poc = getValues('pointOfContact');
        if (!poc?.name?.trim()) {
          setError('pointOfContact.name', {
            type: 'manual',
            message: 'Organizer name is required for group trips',
          });
          return;
        }
        if (!poc?.email?.trim()) {
          setError('pointOfContact.email', {
            type: 'manual',
            message: 'Organizer email is required for group trips',
          });
          return;
        }
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      await onSubmit();
      return;
    }

    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => {
    setFormError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setFormError(null);
    const honeypot =
      [honeypotWebsite, honeypotCompany].find((v) => v.trim()) ?? undefined;
    const payload = sanitizePayload(getValues(), honeypot);

    const parsed = intakeSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || '(root)';
        setError(path as FieldPath<IntakePayload>, {
          type: 'manual',
          message: issue.message,
        });
      }
      const first = parsed.error.issues[0]?.path?.[0];
      if (
        first === 'destinations' ||
        first === 'tripType' ||
        first === 'travelDates' ||
        first === 'groupSize'
      ) {
        setStep(0);
      } else if (
        first === 'budgetRange' ||
        first === 'accommodationStyle' ||
        first === 'interests' ||
        first === 'alreadyBooked'
      ) {
        setStep(1);
      } else if (
        first === 'serviceTier' ||
        first === 'fullLegalName' ||
        first === 'dateOfBirth' ||
        first === 'passportCountry'
      ) {
        setStep(3);
      } else {
        setStep(2);
      }
      setFormError('Please fix the highlighted fields.');
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitIntake(parsed.data);
      setSuccess({ tripId: result.tripId, message: result.message });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          const details = (
            err as ApiError & {
              details?: Array<{ path: string; message: string }>;
            }
          ).details;
          if (details?.length) {
            for (const d of details) {
              setError(d.path as FieldPath<IntakePayload>, {
                type: 'server',
                message: d.message,
              });
            }
            const path = details[0]?.path ?? '';
            if (
              path.startsWith('destinations') ||
              path.startsWith('tripType') ||
              path.startsWith('travelDates') ||
              path.startsWith('groupSize')
            ) {
              setStep(0);
            } else if (
              path.startsWith('budget') ||
              path.startsWith('accommodation') ||
              path.startsWith('interests') ||
              path.startsWith('alreadyBooked')
            ) {
              setStep(1);
            } else if (
              path.startsWith('serviceTier') ||
              path.startsWith('fullLegalName') ||
              path.startsWith('dateOfBirth') ||
              path.startsWith('passportCountry')
            ) {
              setStep(3);
            } else {
              setStep(2);
            }
          }
          setFormError(err.message || 'Please fix the highlighted fields.');
        } else if (err.status === 403) {
          setFormError(
            'Verification failed. Please complete the challenge and try again.'
          );
          setValue('turnstileToken', '');
        } else if (err.status === 429) {
          setFormError(
            'Too many requests. Please wait a few minutes and try again.'
          );
        } else {
          setFormError(err.message || 'Something went wrong. Please try again.');
        }
      } else {
        setFormError('Network error. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <View style={styles.successCard}>
        <Text style={styles.successTitle}>Request received</Text>
        <Text style={styles.successBody}>{success.message}</Text>
        <Text style={styles.successMeta}>Reference: {success.tripId}</Text>
        <Link href="/" asChild>
          <Pressable
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.primaryBtn,
                pressed && styles.primaryBtnPressed,
              ])
            }
            accessibilityRole="button"
            accessibilityLabel="Back to Explorer"
          >
            <Text style={styles.primaryBtnText}>Back to Explorer</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <FormProvider {...form}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Plan Your Trip</Text>
          <Text style={styles.subtitle}>
            Tell us where you want to go — we&apos;ll shape the itinerary around
            how you travel.
          </Text>

          <View style={styles.progress} accessibilityRole="progressbar">
            {STEP_META.map((meta, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <View key={meta.key} style={styles.progressItem}>
                  <View
                    style={[
                      styles.progressDot,
                      (active || done) && styles.progressDotOn,
                    ]}
                  >
                    <Text style={styles.progressNum}>{meta.short}</Text>
                  </View>
                  {!compactProgress ? (
                    <Text
                      style={[
                        styles.progressLabel,
                        active && styles.progressLabelOn,
                      ]}
                      numberOfLines={1}
                    >
                      {meta.label}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Honeypot — off-screen, not display:none */}
          <View
            style={styles.honeypot}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <TextInput
              value={honeypotWebsite}
              onChangeText={setHoneypotWebsite}
              {...(Platform.OS === 'web'
                ? ({ tabIndex: -1, autoComplete: 'off' } as object)
                : {})}
            />
            <TextInput
              value={honeypotCompany}
              onChangeText={setHoneypotCompany}
              {...(Platform.OS === 'web'
                ? ({ tabIndex: -1, autoComplete: 'off' } as object)
                : {})}
            />
          </View>

          <View
            // Prevent Enter in last field from submitting whole form via native
            onStartShouldSetResponder={() => false}
          >
            {step === 0 ? (
              <StepWhereWhen
                firstFieldRef={firstFieldRef}
                onAdvance={() => void goNext()}
              />
            ) : null}
            {step === 1 ? (
              <StepPreferences
                firstFieldRef={firstFieldRef}
                onAdvance={() => void goNext()}
              />
            ) : null}
            {step === 2 ? (
              <StepContact
                firstFieldRef={firstFieldRef}
                onAdvance={() => void goNext()}
              />
            ) : null}
            {step === 3 ? (
              <StepServiceTier
                firstFieldRef={firstFieldRef}
                onAdvance={() => void goNext()}
              />
            ) : null}
          </View>

          {formError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{formError}</Text>
              {formError.includes('Network') || formError.includes('went wrong') ? (
                <Pressable onPress={() => void goNext()} hitSlop={8}>
                  <Text style={styles.retryLink}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.navRow}>
            {step > 0 ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={goBack}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.navSpacer} />
            )}
            <Pressable
              style={[
                styles.primaryBtn,
                submitting && styles.primaryBtnDisabled,
              ]}
              onPress={() => void goNext()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={
                step === 3 ? 'Submit trip request' : 'Next'
              }
            >
              {submitting ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {step === 3 ? 'Submit Trip Request' : 'Next'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
    marginTop: -spacing.sm,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  progressDotOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  progressNum: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.bold,
    fontSize: typography.fontSize.sm,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  progressLabelOn: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  honeypot: {
    position: 'absolute',
    left: -9999,
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  navSpacer: { minWidth: 88 },
  primaryBtn: {
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnPressed: {
    backgroundColor: colors.accentHover,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  secondaryBtn: {
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
  },
  errorBanner: {
    backgroundColor: 'rgba(217, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.xs,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: typography.fontSize.sm,
  },
  retryLink: {
    color: colors.accent,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  successCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  successTitle: {
    color: colors.success,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
  },
  successBody: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.md,
    lineHeight: Math.round(typography.fontSize.md * typography.lineHeight.normal),
  },
  successMeta: {
    color: colors.textMuted,
    fontSize: typography.fontSize.sm,
  },
});
