export const TRIP_TYPE_OPTIONS = [
  { value: 'solo' as const, label: 'Solo', defaultSize: 1 },
  { value: 'couple' as const, label: 'Couple / Partner', defaultSize: 2 },
  { value: 'family' as const, label: 'Family', defaultSize: 4 },
  { value: 'group' as const, label: 'Group', defaultSize: 6 },
];

export const ACCOMMODATION_OPTIONS = [
  { value: 'budget', label: 'Budget / Hostel' },
  { value: 'mid-range', label: 'Mid-Range' },
  { value: 'boutique', label: 'Boutique / Unique' },
  { value: 'luxury', label: 'Luxury' },
];

export const INTEREST_PRESETS = [
  'Culture & History',
  'Food & Dining',
  'Nature & Outdoors',
  'Adventure & Sports',
  'Nightlife & Entertainment',
  'Relaxation & Wellness',
  'Shopping',
  'Photography',
] as const;

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

export const STEP_META = [
  { key: 'where', label: 'Where & When', short: '1' },
  { key: 'prefs', label: 'Preferences', short: '2' },
  { key: 'contact', label: 'Details', short: '3' },
  { key: 'service', label: 'Service', short: '4' },
] as const;

/** Fields validated when leaving each step (RHF trigger paths). */
export const STEP_TRIGGER_FIELDS: string[][] = [
  ['destinations', 'tripType', 'travelDates.start', 'travelDates.end', 'travelDates', 'groupSize'],
  ['accommodationStyle', 'interests', 'alreadyBooked'],
  [
    'name',
    'email',
    'phone',
    'notes',
    'specialRequirements',
    'turnstileToken',
  ],
  ['serviceTier', 'fullLegalName', 'dateOfBirth', 'passportCountry'],
];
