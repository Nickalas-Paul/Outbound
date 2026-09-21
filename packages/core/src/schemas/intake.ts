/**
 * Shared trip-intake validation schema (API + frontend).
 * Zod v4 — importable from `@outbound/core`.
 */

import * as z from 'zod';

export const SERVICE_TIERS = ['full_service', 'itinerary_only'] as const;
export const TRIP_TYPES = ['solo', 'couple', 'family', 'group'] as const;

const destinationSchema = z.object({
  /** Empty when free-text; 2–3 chars when matched to a geography. */
  iso: z
    .string()
    .max(3, 'Destination ISO must be at most 3 characters')
    .refine((v) => v.length === 0 || (v.length >= 2 && v.length <= 3), {
      message: 'Destination ISO must be empty or 2–3 characters',
    }),
  name: z.string().min(1, 'Destination name is required').max(200),
});

const travelDatesSchema = z
  .object({
    start: z.iso.date(),
    end: z.iso.date(),
    flexible: z.boolean(),
  })
  .superRefine((dates, ctx) => {
    if (dates.end <= dates.start) {
      ctx.addIssue({
        code: 'custom',
        message: 'Travel end date must be after start date',
        path: ['end'],
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dates.start < today) {
      ctx.addIssue({
        code: 'custom',
        message: 'Travel start date must be today or later',
        path: ['start'],
      });
    }
  });

const budgetRangeSchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
    currency: z
      .string()
      .length(3, 'Currency must be a 3-letter code')
      .transform((c) => c.toUpperCase()),
  })
  .superRefine((budget, ctx) => {
    if (budget.max < budget.min) {
      ctx.addIssue({
        code: 'custom',
        message: 'Budget max must be greater than or equal to min',
        path: ['max'],
      });
    }
  });

const specialRequirementsSchema = z.object({
  accessibility: z.string().optional(),
  dietary: z.string().optional(),
  mobility: z.string().optional(),
  religious: z.string().optional(),
  other: z.string().optional(),
});

const pointOfContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  phone: z.string().optional(),
});

/**
 * Full intake form payload (includes anti-abuse fields not stored in DB).
 */
export const intakeSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    email: z.email(),
    phone: z.string().optional(),

    destinations: z
      .array(destinationSchema)
      .min(1, 'At least one destination is required'),
    tripType: z.enum(TRIP_TYPES),
    travelDates: travelDatesSchema,
    groupSize: z.number().int().min(1).max(50),

    budgetRange: budgetRangeSchema.optional(),
    accommodationStyle: z.string().max(100).optional(),
    interests: z.array(z.string().min(1).max(100)).optional(),
    specialRequirements: specialRequirementsSchema.optional(),
    alreadyBooked: z.string().max(5000).optional(),
    notes: z.string().max(10000).optional(),

    pointOfContact: pointOfContactSchema.optional(),

    serviceTier: z.enum(SERVICE_TIERS),

    /** Full-service traveler details (optional except fullLegalName when full_service). */
    fullLegalName: z
      .string()
      .max(300)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),
    dateOfBirth: z
      .union([z.iso.date(), z.literal('')])
      .optional()
      .transform((v) => (v === '' || v == null ? undefined : v)),
    passportCountry: z
      .string()
      .max(100)
      .optional()
      .transform((v) => (v?.trim() ? v.trim() : undefined)),

    /** Cloudflare Turnstile token — verified server-side when secret is configured. */
    turnstileToken: z.string(),
    /**
     * Honeypot — must be empty/undefined for real humans.
     * Non-empty values are accepted by the schema so the API can return a fake 200.
     */
    honeypotField: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.serviceTier === 'full_service' &&
      !data.fullLegalName?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Full legal name is required for Full-Service Concierge',
        path: ['fullLegalName'],
      });
    }
  });

export type IntakePayload = z.infer<typeof intakeSchema>;

/** True when tripType is group but groupSize is still 1 (soft warning). */
export function isGroupSizeSoftWarning(payload: IntakePayload): boolean {
  return payload.tripType === 'group' && payload.groupSize <= 1;
}
