/**
 * Duffel API adapter — flights + stays with graceful fallback when unconfigured.
 */

import { Duffel } from '@duffel/api';

export type FlightOfferSummary = {
  id: string;
  totalAmount: number;
  currency: string;
  cabinClass: string | null;
  slices: Array<{
    origin: string;
    destination: string;
    departingAt: string | null;
    arrivingAt: string | null;
    duration: string | null;
  }>;
  passengers: Array<{ id: string; type: string | null }>;
  raw?: unknown;
};

export type FlightSearchResult =
  | {
      ok: true;
      offerRequestId: string;
      offers: FlightOfferSummary[];
    }
  | { ok: false; error: string };

export type AccommodationOfferSummary = {
  searchResultId: string;
  rateId: string | null;
  name: string;
  totalAmount: number;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  checkIn: string;
  checkOut: string;
  raw?: unknown;
};

export type AccommodationSearchResult =
  | {
      ok: true;
      results: AccommodationOfferSummary[];
    }
  | { ok: false; error: string };

export type PassengerInfo = {
  givenName: string;
  familyName: string;
  bornOn?: string;
  email?: string;
  phoneNumber?: string;
  gender?: 'm' | 'f';
  title?: string;
};

export type GuestInfo = {
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber: string;
};

export type BookingResult =
  | {
      ok: true;
      orderId: string;
      bookingReference: string | null;
      totalAmount: number | null;
      currency: string | null;
      cancellationPolicy: Record<string, unknown> | null;
      confirmationDetails: Record<string, unknown>;
    }
  | { ok: false; error: string };

export type CancellationResult =
  | {
      ok: true;
      cancellationId: string;
      refundAmount: number | null;
      currency: string | null;
    }
  | { ok: false; error: string };

let client: Duffel | null | undefined;
let warnedMissing = false;

function getToken(): string | null {
  const token = process.env.DUFFEL_API_TOKEN?.trim();
  return token || null;
}

export function isDuffelConfigured(): boolean {
  return Boolean(getToken());
}

function getClient(): Duffel | null {
  if (client !== undefined) return client;
  const token = getToken();
  if (!token) {
    if (!warnedMissing) {
      console.warn(
        '[duffel] DUFFEL_API_TOKEN not configured — booking calls will return structured errors'
      );
      warnedMissing = true;
    }
    client = null;
    return null;
  }
  client = new Duffel({ token });
  return client;
}

function parseAmount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function errMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
    if (Array.isArray(e.errors) && e.errors[0]?.message) {
      return e.errors.map((x) => x.message).filter(Boolean).join('; ');
    }
    if (e.message) return e.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export async function searchFlights(params: {
  origin: string;
  destination: string;
  departureDate: string;
  passengers: number;
  cabinClass?: string;
}): Promise<FlightSearchResult> {
  const duffel = getClient();
  if (!duffel) {
    return { ok: false, error: 'Duffel not configured' };
  }

  try {
    const passengerCount = Math.max(1, Math.min(9, Math.floor(params.passengers)));
    const passengers = Array.from({ length: passengerCount }, () => ({
      type: 'adult' as const,
    }));

    const cabin =
      params.cabinClass === 'premium_economy' ||
      params.cabinClass === 'business' ||
      params.cabinClass === 'first' ||
      params.cabinClass === 'economy'
        ? params.cabinClass
        : 'economy';

    const response = await duffel.offerRequests.create({
      slices: [
        {
          origin: params.origin.toUpperCase(),
          destination: params.destination.toUpperCase(),
          departure_date: params.departureDate,
          arrival_time: null,
          departure_time: null,
        },
      ],
      passengers,
      cabin_class: cabin,
      return_offers: true,
    });

    const data = response.data;
    const offers = (data.offers ?? []).map((offer) => {
      const cabinFromOffer = (offer as { cabin_class?: string | null })
        .cabin_class;
      return {
        id: offer.id,
        totalAmount: parseAmount(offer.total_amount),
        currency: offer.total_currency,
        cabinClass: cabinFromOffer ?? cabin,
        slices: (offer.slices ?? []).map((slice) => ({
          origin: slice.origin?.iata_code ?? String(slice.origin?.name ?? ''),
          destination:
            slice.destination?.iata_code ??
            String(slice.destination?.name ?? ''),
          departingAt: slice.segments?.[0]?.departing_at ?? null,
          arrivingAt:
            slice.segments?.[slice.segments.length - 1]?.arriving_at ?? null,
          duration: slice.duration ?? null,
        })),
        passengers: (offer.passengers ?? []).map((p) => ({
          id: p.id,
          type: p.type ?? null,
        })),
      };
    });

    return {
      ok: true,
      offerRequestId: data.id,
      offers,
    };
  } catch (err) {
    const message = errMessage(err);
    console.error('[duffel] searchFlights failed:', message);
    return { ok: false, error: message };
  }
}

export async function searchAccommodation(params: {
  location: { latitude: number; longitude: number };
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
}): Promise<AccommodationSearchResult> {
  const duffel = getClient();
  if (!duffel) {
    return { ok: false, error: 'Duffel not configured' };
  }

  try {
    const guestCount = Math.max(1, Math.min(8, Math.floor(params.guests)));
    const guests = Array.from({ length: guestCount }, () => ({
      type: 'adult' as const,
    }));

    const search = await duffel.stays.search({
      rooms: Math.max(1, params.rooms),
      check_in_date: params.checkIn,
      check_out_date: params.checkOut,
      guests,
      location: {
        radius: 5,
        geographic_coordinates: {
          latitude: params.location.latitude,
          longitude: params.location.longitude,
        },
      },
    });

    const results: AccommodationOfferSummary[] = [];
    for (const result of (search.data.results ?? []).slice(0, 8)) {
      let rateId: string | null = null;
      try {
        const rates = await duffel.stays.searchResults.fetchAllRates(result.id);
        const rooms = (rates.data as { accommodation?: { rooms?: Array<{ rates?: Array<{ id: string }> }> } })
          .accommodation?.rooms;
        rateId = rooms?.[0]?.rates?.[0]?.id ?? null;
      } catch (rateErr) {
        console.warn(
          '[duffel] fetchAllRates failed for',
          result.id,
          errMessage(rateErr)
        );
      }

      results.push({
        searchResultId: result.id,
        rateId,
        name: result.accommodation?.name ?? 'Accommodation',
        totalAmount: parseAmount(result.cheapest_rate_total_amount),
        currency: result.cheapest_rate_currency,
        latitude: result.accommodation?.location?.geographic_coordinates?.latitude ?? null,
        longitude:
          result.accommodation?.location?.geographic_coordinates?.longitude ??
          null,
        checkIn: result.check_in_date,
        checkOut: result.check_out_date,
      });
    }

    return { ok: true, results };
  } catch (err) {
    const message = errMessage(err);
    console.error('[duffel] searchAccommodation failed:', message);
    return { ok: false, error: message };
  }
}

export async function createFlightOrder(params: {
  offerId: string;
  passengers: PassengerInfo[];
}): Promise<BookingResult> {
  const duffel = getClient();
  if (!duffel) {
    return { ok: false, error: 'Duffel not configured' };
  }

  try {
    const offerRes = await duffel.offers.get(params.offerId);
    const offer = offerRes.data;
    const offerPassengers = offer.passengers ?? [];
    if (offerPassengers.length === 0) {
      return { ok: false, error: 'Offer has no passengers' };
    }

    const passengers = offerPassengers.map((op, idx) => {
      const info = params.passengers[idx] ?? params.passengers[0];
      return {
        id: op.id,
        given_name: info.givenName,
        family_name: info.familyName,
        born_on: info.bornOn ?? '1990-01-01',
        email: info.email ?? 'traveler@outbound.local',
        phone_number: info.phoneNumber ?? '+15555550100',
        gender: info.gender ?? ('m' as const),
        title: (info.title as 'mr' | 'mrs' | 'ms' | 'miss' | 'dr') ?? 'mr',
      };
    });

    const orderRes = await duffel.orders.create({
      type: 'instant',
      selected_offers: [params.offerId],
      passengers,
      payments: [
        {
          type: 'balance',
          amount: offer.total_amount,
          currency: offer.total_currency,
        },
      ],
    });

    const order = orderRes.data;
    return {
      ok: true,
      orderId: order.id,
      bookingReference: order.booking_reference ?? null,
      totalAmount: parseAmount(order.total_amount),
      currency: order.total_currency ?? null,
      cancellationPolicy: {
        available_actions: order.available_actions ?? [],
      },
      confirmationDetails: {
        booking_reference: order.booking_reference,
        airline_order_ids: (order.documents ?? []).map((d) => d.unique_identifier),
        slices: order.slices,
      },
    };
  } catch (err) {
    const message = errMessage(err);
    console.error('[duffel] createFlightOrder failed:', message);
    return { ok: false, error: message };
  }
}

export async function createAccommodationBooking(params: {
  rateId: string;
  guests: GuestInfo[];
}): Promise<BookingResult> {
  const duffel = getClient();
  if (!duffel) {
    return { ok: false, error: 'Duffel not configured' };
  }

  try {
    const quoteRes = await duffel.stays.quotes.create(params.rateId);
    const quote = quoteRes.data;
    const primary = params.guests[0];
    if (!primary) {
      return { ok: false, error: 'At least one guest is required' };
    }

    const bookingRes = await duffel.stays.bookings.create({
      quote_id: quote.id,
      email: primary.email,
      phone_number: primary.phoneNumber,
      guests: params.guests.map((g) => ({
        given_name: g.givenName,
        family_name: g.familyName,
      })),
    });

    const booking = bookingRes.data;
    const bookingAny = booking as {
      total_amount?: string;
      total_currency?: string;
      reference?: string | null;
      confirmation_code?: string;
      refund?: unknown;
      status?: string;
      check_in_date?: string;
      check_out_date?: string;
      accommodation?: { name?: string };
    };
    return {
      ok: true,
      orderId: booking.id,
      bookingReference:
        bookingAny.reference ?? bookingAny.confirmation_code ?? null,
      totalAmount: parseAmount(
        bookingAny.total_amount ?? quote.total_amount ?? null
      ),
      currency: bookingAny.total_currency ?? quote.total_currency ?? null,
      cancellationPolicy: {
        refund: bookingAny.refund ?? null,
        status: bookingAny.status,
      },
      confirmationDetails: {
        reference: bookingAny.reference,
        status: bookingAny.status,
        check_in_date: bookingAny.check_in_date,
        check_out_date: bookingAny.check_out_date,
        accommodation: bookingAny.accommodation?.name,
      },
    };
  } catch (err) {
    const message = errMessage(err);
    console.error('[duffel] createAccommodationBooking failed:', message);
    return { ok: false, error: message };
  }
}

export async function cancelBooking(params: {
  orderId: string;
  type: 'flight' | 'accommodation';
}): Promise<CancellationResult> {
  const duffel = getClient();
  if (!duffel) {
    return { ok: false, error: 'Duffel not configured' };
  }

  try {
    if (params.type === 'accommodation') {
      const res = await duffel.stays.bookings.cancel(params.orderId);
      return {
        ok: true,
        cancellationId: res.data.id,
        refundAmount: null,
        currency: null,
      };
    }

    const pending = await duffel.orderCancellations.create({
      order_id: params.orderId,
    });
    const confirmed = await duffel.orderCancellations.confirm(pending.data.id);
    return {
      ok: true,
      cancellationId: confirmed.data.id,
      refundAmount: parseAmount(confirmed.data.refund_amount),
      currency: confirmed.data.refund_currency ?? null,
    };
  } catch (err) {
    const message = errMessage(err);
    console.error('[duffel] cancelBooking failed:', message);
    return { ok: false, error: message };
  }
}
