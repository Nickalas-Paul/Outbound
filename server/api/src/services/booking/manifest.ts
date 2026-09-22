/**
 * Extract bookable flight/hotel segments from a confirmed itinerary.
 */

import type { ItineraryContent } from '../itinerary-types';

export type TripRecord = {
  id: string;
  group_size: number;
  accommodation_style: string | null;
  budget_range: { min?: number; max?: number; currency?: string } | null;
  travel_dates: { start?: string; end?: string; flexible?: boolean } | null;
  destinations: Array<{ iso?: string; name?: string }> | null;
};

export type FlightSegment = {
  origin: string;
  destination: string;
  date: string;
  passengers: number;
  cabinClass: string;
  estimatedCost: number | null;
  originLabel: string;
  destinationLabel: string;
};

export type HotelSegment = {
  name: string;
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  estimatedCost: number | null;
  estimatedCostPerNight: number | null;
};

export type BookingManifestSegment =
  | {
      type: 'flight';
      dayNumber: number;
      details: FlightSegment;
    }
  | {
      type: 'hotel';
      dayNumber: number;
      details: HotelSegment;
    };

export type BookingManifest = {
  tripId: string;
  segments: BookingManifestSegment[];
};

/** Best-effort city / airport → IATA map for common destinations. */
const CITY_TO_IATA: Record<string, string> = {
  london: 'LHR',
  'new york': 'JFK',
  nyc: 'JFK',
  paris: 'CDG',
  tokyo: 'NRT',
  seoul: 'ICN',
  madrid: 'MAD',
  barcelona: 'BCN',
  'buenos aires': 'EZE',
  'mexico city': 'MEX',
  cdmx: 'MEX',
  rome: 'FCO',
  milan: 'MXP',
  berlin: 'BER',
  amsterdam: 'AMS',
  lisbon: 'LIS',
  bangkok: 'BKK',
  singapore: 'SIN',
  sydney: 'SYD',
  melbourne: 'MEL',
  toronto: 'YYZ',
  vancouver: 'YVR',
  chicago: 'ORD',
  'los angeles': 'LAX',
  'san francisco': 'SFO',
  miami: 'MIA',
  dubai: 'DXB',
  istanbul: 'IST',
  athens: 'ATH',
  vienna: 'VIE',
  prague: 'PRG',
  dublin: 'DUB',
  edinburgh: 'EDI',
  'hong kong': 'HKG',
  taipei: 'TPE',
  osaka: 'KIX',
  kyoto: 'KIX',
  busan: 'PUS',
  jeju: 'CJU',
};

const ISO_TO_HUB: Record<string, string> = {
  GB: 'LHR',
  US: 'JFK',
  FR: 'CDG',
  JP: 'NRT',
  KR: 'ICN',
  ES: 'MAD',
  AR: 'EZE',
  MX: 'MEX',
  IT: 'FCO',
  DE: 'BER',
  NL: 'AMS',
  PT: 'LIS',
  TH: 'BKK',
  SG: 'SIN',
  AU: 'SYD',
  CA: 'YYZ',
  AE: 'DXB',
  TR: 'IST',
  GR: 'ATH',
  AT: 'VIE',
  CZ: 'PRG',
  IE: 'DUB',
  HK: 'HKG',
  TW: 'TPE',
};

function normalizeLocation(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveAirportCode(
  location: string,
  fallbackIso?: string | null
): string | null {
  const trimmed = location.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  const key = normalizeLocation(trimmed);
  if (CITY_TO_IATA[key]) return CITY_TO_IATA[key];
  // Try first city token before comma
  const first = key.split(',')[0]?.trim();
  if (first && CITY_TO_IATA[first]) return CITY_TO_IATA[first];
  if (fallbackIso) {
    const iso = fallbackIso.trim().toUpperCase();
    if (ISO_TO_HUB[iso]) return ISO_TO_HUB[iso];
  }
  return null;
}

export function cabinClassFromTrip(trip: TripRecord): string {
  const style = (trip.accommodation_style ?? '').toLowerCase();
  if (
    style.includes('luxury') ||
    style.includes('premium') ||
    style.includes('five')
  ) {
    return 'business';
  }
  const max = trip.budget_range?.max;
  if (typeof max === 'number' && max >= 8000) {
    return 'business';
  }
  return 'economy';
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDate(
  day: ItineraryContent['days'][number],
  trip: TripRecord,
  dayIndex: number
): string {
  if (day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
    return day.date;
  }
  const start = trip.travel_dates?.start;
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return addDays(start, dayIndex);
  }
  // Fallback: 30 days from now + index
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 30 + dayIndex);
  return base.toISOString().slice(0, 10);
}

function destinationsIso(trip: TripRecord): string[] {
  return (trip.destinations ?? [])
    .map((d) => d.iso?.trim().toUpperCase())
    .filter((x): x is string => Boolean(x));
}

/**
 * Best-effort extraction of bookable segments from itinerary content.
 */
export function generateBookingManifest(
  itinerary: ItineraryContent,
  trip: TripRecord
): BookingManifest {
  const segments: BookingManifestSegment[] = [];
  const guests = Math.max(1, trip.group_size || 1);
  const cabinClass = cabinClassFromTrip(trip);
  const isos = destinationsIso(trip);
  const days = itinerary.days ?? [];

  // Flights: location changes between consecutive days
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const curr = days[i];
    const fromLabel = (prev.location ?? '').trim();
    const toLabel = (curr.location ?? '').trim();
    if (!fromLabel || !toLabel) continue;
    if (normalizeLocation(fromLabel) === normalizeLocation(toLabel)) continue;

    const origin = resolveAirportCode(fromLabel, isos[0] ?? null);
    const destination = resolveAirportCode(
      toLabel,
      isos[Math.min(i, isos.length - 1)] ?? isos[0] ?? null
    );

    if (!origin || !destination) {
      console.warn(
        '[manifest] skipping flight — could not resolve IATA',
        { fromLabel, toLabel, origin, destination }
      );
      continue;
    }
    if (origin === destination) continue;

    segments.push({
      type: 'flight',
      dayNumber: curr.dayNumber ?? i + 1,
      details: {
        origin,
        destination,
        date: dayDate(curr, trip, i),
        passengers: guests,
        cabinClass,
        estimatedCost: null,
        originLabel: fromLabel,
        destinationLabel: toLabel,
      },
    });
  }

  // Hotels: consolidate consecutive nights at the same property
  let runStart = 0;
  while (runStart < days.length) {
    const startDay = days[runStart];
    const property = (startDay.accommodation?.name ?? '').trim();
    if (!property) {
      runStart += 1;
      continue;
    }

    let runEnd = runStart;
    while (
      runEnd + 1 < days.length &&
      (days[runEnd + 1].accommodation?.name ?? '').trim() === property
    ) {
      runEnd += 1;
    }

    const checkIn = dayDate(startDay, trip, runStart);
    const lastNight = dayDate(days[runEnd], trip, runEnd);
    const checkOut = addDays(lastNight, 1);
    const nights = runEnd - runStart + 1;
    const perNight = startDay.accommodation?.estimatedCostPerNight ?? null;
    const estimatedCost =
      typeof perNight === 'number' && Number.isFinite(perNight)
        ? perNight * nights
        : null;

    segments.push({
      type: 'hotel',
      dayNumber: startDay.dayNumber ?? runStart + 1,
      details: {
        name: property,
        location: (startDay.location ?? property).trim(),
        checkIn,
        checkOut,
        guests,
        rooms: Math.max(1, Math.ceil(guests / 2)),
        estimatedCost,
        estimatedCostPerNight:
          typeof perNight === 'number' ? perNight : null,
      },
    });

    runStart = runEnd + 1;
  }

  segments.sort((a, b) => {
    const da =
      a.type === 'flight' ? a.details.date : a.details.checkIn;
    const db =
      b.type === 'flight' ? b.details.date : b.details.checkIn;
    return da.localeCompare(db) || a.dayNumber - b.dayNumber;
  });

  console.info('[manifest] generated', {
    tripId: trip.id,
    flights: segments.filter((s) => s.type === 'flight').length,
    hotels: segments.filter((s) => s.type === 'hotel').length,
  });

  return { tripId: trip.id, segments };
}
