/**
 * Booking execution pipeline — Duffel search/book per manifest segment.
 */

import { pool } from '../../config/database';
import { sendEmail } from '../email';
import {
  isItineraryContent,
  type ItineraryContent,
} from '../itinerary-types';
import {
  buildTripPdfUrl,
} from '../verification';
import {
  bookingConfirmationEmail,
  bookingFailureEmail,
  bookingSummaryEmail,
} from '../../templates/emails';
import {
  createAccommodationBooking,
  createFlightOrder,
  searchAccommodation,
  searchFlights,
  type GuestInfo,
  type PassengerInfo,
} from './duffel';
import {
  generateBookingManifest,
  type BookingManifestSegment,
  type TripRecord,
} from './manifest';

const PRICE_TOLERANCE = 0.05;

type TripRow = TripRecord & {
  service_tier: string;
  status: string;
  client_profile_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
};

function splitName(full: string): { givenName: string; familyName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { givenName: 'Traveler', familyName: 'Guest' };
  if (parts.length === 1) return { givenName: parts[0], familyName: 'Guest' };
  return {
    givenName: parts[0],
    familyName: parts.slice(1).join(' '),
  };
}

function withinTolerance(
  offerPrice: number,
  estimated: number | null | undefined
): { ok: boolean; deltaPct: number | null } {
  if (estimated == null || !Number.isFinite(estimated) || estimated <= 0) {
    return { ok: true, deltaPct: null };
  }
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    return { ok: true, deltaPct: null };
  }
  const deltaPct = (offerPrice - estimated) / estimated;
  return { ok: deltaPct <= PRICE_TOLERANCE, deltaPct };
}

function nameSimilarity(a: string, b: string): number {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  const ta = new Set(na.split(/[^a-z0-9]+/).filter(Boolean));
  const tb = new Set(nb.split(/[^a-z0-9]+/).filter(Boolean));
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap / Math.max(1, Math.max(ta.size, tb.size));
}

async function resolveCoords(
  location: string,
  destinations: TripRecord['destinations']
): Promise<{ latitude: number; longitude: number } | null> {
  const loc = location.trim();
  const byName = await pool.query<{ lat: number; lon: number }>(
    `
    SELECT ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lon
    FROM geographies
    WHERE centroid IS NOT NULL
      AND (
        name ILIKE $1
        OR name ILIKE $2
        OR $3 ILIKE '%' || name || '%'
      )
    ORDER BY CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END, population DESC NULLS LAST
    LIMIT 1
    `,
    [loc, `%${loc}%`, loc]
  );
  if (byName.rows[0]) {
    return {
      latitude: Number(byName.rows[0].lat),
      longitude: Number(byName.rows[0].lon),
    };
  }

  for (const d of destinations ?? []) {
    const iso = d.iso?.trim().toUpperCase();
    if (!iso) continue;
    const byIso = await pool.query<{ lat: number; lon: number }>(
      `
      SELECT ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lon
      FROM geographies
      WHERE iso_code = $1 AND centroid IS NOT NULL
      LIMIT 1
      `,
      [iso]
    );
    if (byIso.rows[0]) {
      return {
        latitude: Number(byIso.rows[0].lat),
        longitude: Number(byIso.rows[0].lon),
      };
    }
  }
  return null;
}

async function insertBooking(row: {
  tripId: string;
  itineraryVersionId: string;
  segment: BookingManifestSegment;
  bookingType: 'flight' | 'hotel';
  status: string;
  providerBookingRef?: string | null;
  passengerDetails?: unknown;
  pricing?: unknown;
  confirmationDetails?: unknown;
  cancellationPolicy?: unknown;
  failureReason?: string | null;
}): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO bookings (
      trip_id, itinerary_version_id, segment_reference, booking_type,
      provider, provider_booking_ref, status, passenger_details, pricing,
      confirmation_details, cancellation_policy, failure_reason
    ) VALUES (
      $1, $2, $3::jsonb, $4, 'duffel', $5, $6, $7::jsonb, $8::jsonb,
      $9::jsonb, $10::jsonb, $11
    )
    RETURNING id
    `,
    [
      row.tripId,
      row.itineraryVersionId,
      JSON.stringify(row.segment),
      row.bookingType,
      row.providerBookingRef ?? null,
      row.status,
      row.passengerDetails != null
        ? JSON.stringify(row.passengerDetails)
        : null,
      row.pricing != null ? JSON.stringify(row.pricing) : null,
      row.confirmationDetails != null
        ? JSON.stringify(row.confirmationDetails)
        : null,
      row.cancellationPolicy != null
        ? JSON.stringify(row.cancellationPolicy)
        : null,
      row.failureReason ?? null,
    ]
  );
  return result.rows[0].id;
}

async function processFlight(opts: {
  trip: TripRow;
  itineraryVersionId: string;
  segment: Extract<BookingManifestSegment, { type: 'flight' }>;
  passengers: PassengerInfo[];
}): Promise<'confirmed' | 'pending' | 'failed'> {
  const { trip, itineraryVersionId, segment, passengers } = opts;
  const details = segment.details;

  const search = await searchFlights({
    origin: details.origin,
    destination: details.destination,
    departureDate: details.date,
    passengers: details.passengers,
    cabinClass: details.cabinClass,
  });

  if (!search.ok || search.offers.length === 0) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'flight',
      status: 'failed',
      failureReason: search.ok
        ? 'No flight offers returned'
        : search.error,
    });
    return 'failed';
  }

  const sorted = [...search.offers].sort(
    (a, b) => a.totalAmount - b.totalAmount
  );
  const offer =
    sorted.find((o) =>
      details.cabinClass
        ? (o.cabinClass ?? '').toLowerCase() === details.cabinClass.toLowerCase()
        : true
    ) ?? sorted[0];

  const tol = withinTolerance(offer.totalAmount, details.estimatedCost);
  if (!tol.ok) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'flight',
      status: 'pending',
      pricing: {
        offerAmount: offer.totalAmount,
        currency: offer.currency,
        estimated: details.estimatedCost,
        deltaPct: tol.deltaPct,
        reason: 'price_over_tolerance',
      },
      failureReason: `Offer ${offer.totalAmount} ${offer.currency} exceeds estimated cost by more than 5%`,
    });
    console.warn('[booking] flight price over tolerance', {
      tripId: trip.id,
      offer: offer.totalAmount,
      estimated: details.estimatedCost,
    });
    return 'pending';
  }

  const booked = await createFlightOrder({
    offerId: offer.id,
    passengers,
  });

  if (!booked.ok) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'flight',
      status: 'failed',
      failureReason: booked.error,
      pricing: {
        offerAmount: offer.totalAmount,
        currency: offer.currency,
      },
    });
    return 'failed';
  }

  await insertBooking({
    tripId: trip.id,
    itineraryVersionId,
    segment,
    bookingType: 'flight',
    status: 'confirmed',
    providerBookingRef: booked.bookingReference ?? booked.orderId,
    passengerDetails: passengers,
    pricing: {
      amount: booked.totalAmount,
      currency: booked.currency,
      offerAmount: offer.totalAmount,
    },
    confirmationDetails: booked.confirmationDetails,
    cancellationPolicy: booked.cancellationPolicy,
  });

  const email = bookingConfirmationEmail({
    name: trip.client_name,
    segmentType: 'flight',
    segmentLabel: `${details.originLabel} → ${details.destinationLabel}`,
    dates: details.date,
    confirmationNumber: booked.bookingReference ?? booked.orderId,
    cancellationSummary: 'See your airline confirmation for change and cancellation terms.',
    providerName: 'Airline partner via Outbound',
  });
  void sendEmail({
    to: trip.client_email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  }).catch((err) => console.error('[booking] segment email failed:', err));

  return 'confirmed';
}

async function processHotel(opts: {
  trip: TripRow;
  itineraryVersionId: string;
  segment: Extract<BookingManifestSegment, { type: 'hotel' }>;
  guests: GuestInfo[];
}): Promise<'confirmed' | 'pending' | 'failed'> {
  const { trip, itineraryVersionId, segment, guests } = opts;
  const details = segment.details;

  const coords = await resolveCoords(details.location, trip.destinations);
  if (!coords) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'hotel',
      status: 'failed',
      failureReason: `Could not resolve coordinates for "${details.location}"`,
    });
    return 'failed';
  }

  const search = await searchAccommodation({
    location: coords,
    checkIn: details.checkIn,
    checkOut: details.checkOut,
    guests: details.guests,
    rooms: details.rooms,
  });

  if (!search.ok || search.results.length === 0) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'hotel',
      status: 'failed',
      failureReason: search.ok
        ? 'No accommodation results returned'
        : search.error,
    });
    return 'failed';
  }

  const ranked = [...search.results].sort((a, b) => {
    const sa = nameSimilarity(a.name, details.name);
    const sb = nameSimilarity(b.name, details.name);
    if (sb !== sa) return sb - sa;
    return a.totalAmount - b.totalAmount;
  });
  const match = ranked.find((r) => r.rateId) ?? ranked[0];

  if (!match.rateId) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'hotel',
      status: 'failed',
      failureReason: 'No bookable rate found for accommodation search results',
      pricing: {
        cheapest: match.totalAmount,
        currency: match.currency,
        matchedName: match.name,
      },
    });
    return 'failed';
  }

  const tol = withinTolerance(match.totalAmount, details.estimatedCost);
  if (!tol.ok) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'hotel',
      status: 'pending',
      pricing: {
        offerAmount: match.totalAmount,
        currency: match.currency,
        estimated: details.estimatedCost,
        deltaPct: tol.deltaPct,
        matchedName: match.name,
        reason: 'price_over_tolerance',
      },
      failureReason: `Rate ${match.totalAmount} ${match.currency} exceeds estimated cost by more than 5%`,
    });
    return 'pending';
  }

  const booked = await createAccommodationBooking({
    rateId: match.rateId,
    guests,
  });

  if (!booked.ok) {
    await insertBooking({
      tripId: trip.id,
      itineraryVersionId,
      segment,
      bookingType: 'hotel',
      status: 'failed',
      failureReason: booked.error,
      pricing: {
        offerAmount: match.totalAmount,
        currency: match.currency,
        matchedName: match.name,
      },
    });
    return 'failed';
  }

  await insertBooking({
    tripId: trip.id,
    itineraryVersionId,
    segment,
    bookingType: 'hotel',
    status: 'confirmed',
    providerBookingRef: booked.bookingReference ?? booked.orderId,
    passengerDetails: guests,
    pricing: {
      amount: booked.totalAmount,
      currency: booked.currency,
      offerAmount: match.totalAmount,
      matchedName: match.name,
    },
    confirmationDetails: booked.confirmationDetails,
    cancellationPolicy: booked.cancellationPolicy,
  });

  const email = bookingConfirmationEmail({
    name: trip.client_name,
    segmentType: 'hotel',
    segmentLabel: details.name,
    dates: `${details.checkIn} → ${details.checkOut}`,
    confirmationNumber: booked.bookingReference ?? booked.orderId,
    cancellationSummary:
      'Free cancellation windows vary by property — check your confirmation for details.',
    providerName: match.name,
  });
  void sendEmail({
    to: trip.client_email,
    subject: email.subject,
    html: email.html,
    text: email.text,
  }).catch((err) => console.error('[booking] segment email failed:', err));

  return 'confirmed';
}

/**
 * Execute bookings for a confirmed full-service trip. Safe for fire-and-forget.
 */
export async function executeBookings(tripId: string): Promise<void> {
  console.info('[booking] starting', { tripId });

  try {
    const tripResult = await pool.query<TripRow>(
      `
      SELECT
        t.id,
        t.group_size,
        t.accommodation_style,
        t.budget_range,
        t.travel_dates,
        t.destinations,
        t.service_tier,
        t.status,
        t.client_profile_id,
        c.name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone
      FROM trips t
      JOIN client_profiles c ON c.id = t.client_profile_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [tripId]
    );

    if (tripResult.rows.length === 0) {
      console.error('[booking] trip not found', { tripId });
      return;
    }

    const trip = tripResult.rows[0];
    if (trip.service_tier !== 'full_service') {
      console.info('[booking] skipping itinerary-only trip', { tripId });
      return;
    }

    const versionResult = await pool.query<{
      id: string;
      content: ItineraryContent;
    }>(
      `
      SELECT id, content
      FROM itinerary_versions
      WHERE trip_id = $1
        AND (version_type = 'confirmed' OR status = 'confirmed' OR status = 'sent')
      ORDER BY
        CASE WHEN version_type = 'confirmed' OR status = 'confirmed' THEN 0 ELSE 1 END,
        version_number DESC
      LIMIT 1
      `,
      [tripId]
    );

    if (
      versionResult.rows.length === 0 ||
      !isItineraryContent(versionResult.rows[0].content)
    ) {
      console.error('[booking] no confirmed itinerary', { tripId });
      return;
    }

    const itineraryVersionId = versionResult.rows[0].id;
    const itinerary = versionResult.rows[0].content;
    const manifest = generateBookingManifest(itinerary, trip);

    await pool.query(
      `UPDATE trips
       SET status = 'booking_in_progress', updated_at = NOW()
       WHERE id = $1`,
      [tripId]
    );

    if (manifest.segments.length === 0) {
      console.warn('[booking] empty manifest — escalating', { tripId });
      await pool.query(
        `UPDATE trips
         SET escalation_flag = true,
             escalation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [
          tripId,
          'No bookable flight or hotel segments could be extracted from the itinerary.',
        ]
      );
      const failEmail = bookingFailureEmail({
        name: trip.client_name,
        destinationLabel: itinerary.destinations?.join(', ') || 'your trip',
        reason:
          'I could not automatically map your itinerary into bookable flights and hotels.',
        optionsNote:
          "I'll review the plan manually and follow up with booking options shortly.",
      });
      void sendEmail({
        to: trip.client_email,
        subject: failEmail.subject,
        html: failEmail.html,
        text: failEmail.text,
      }).catch((err) => console.error('[booking] failure email failed:', err));
      return;
    }

    const { givenName, familyName } = splitName(trip.client_name);
    const phone = trip.client_phone?.trim() || '+15555550100';
    const passengers: PassengerInfo[] = Array.from(
      { length: Math.max(1, trip.group_size) },
      (_, i) => ({
        givenName: i === 0 ? givenName : givenName,
        familyName: i === 0 ? familyName : familyName,
        email: trip.client_email,
        phoneNumber: phone,
        bornOn: '1990-01-01',
        gender: 'm',
        title: 'mr',
      })
    );
    const guests: GuestInfo[] = [
      {
        givenName,
        familyName,
        email: trip.client_email,
        phoneNumber: phone,
      },
    ];

    const outcomes: Array<'confirmed' | 'pending' | 'failed'> = [];
    const failedLabels: string[] = [];
    const pendingLabels: string[] = [];
    const confirmedSummaries: Array<{
      type: string;
      label: string;
      confirmationNumber: string;
      amountNote?: string;
    }> = [];

    for (const segment of manifest.segments) {
      try {
        if (segment.type === 'flight') {
          const result = await processFlight({
            trip,
            itineraryVersionId,
            segment,
            passengers,
          });
          outcomes.push(result);
          const label = `${segment.details.origin}→${segment.details.destination}`;
          if (result === 'failed') failedLabels.push(`flight ${label}`);
          if (result === 'pending') pendingLabels.push(`flight ${label}`);
          if (result === 'confirmed') {
            confirmedSummaries.push({
              type: 'flight',
              label,
              confirmationNumber: '(see segment email)',
            });
          }
        } else {
          const result = await processHotel({
            trip,
            itineraryVersionId,
            segment,
            guests,
          });
          outcomes.push(result);
          const label = segment.details.name;
          if (result === 'failed') failedLabels.push(`hotel ${label}`);
          if (result === 'pending') pendingLabels.push(`hotel ${label}`);
          if (result === 'confirmed') {
            confirmedSummaries.push({
              type: 'hotel',
              label,
              confirmationNumber: '(see segment email)',
            });
          }
        }
      } catch (segErr) {
        console.error('[booking] segment crashed:', segErr);
        outcomes.push('failed');
        failedLabels.push(
          segment.type === 'flight'
            ? `flight ${segment.details.origin}→${segment.details.destination}`
            : `hotel ${segment.details.name}`
        );
        await insertBooking({
          tripId: trip.id,
          itineraryVersionId,
          segment,
          bookingType: segment.type === 'flight' ? 'flight' : 'hotel',
          status: 'failed',
          failureReason:
            segErr instanceof Error ? segErr.message : String(segErr),
        }).catch(() => undefined);
      }
    }

    // Refresh confirmation numbers from DB for summary
    const bookingRows = await pool.query<{
      booking_type: string;
      provider_booking_ref: string | null;
      status: string;
      segment_reference: BookingManifestSegment;
      pricing: { amount?: number; currency?: string; offerAmount?: number } | null;
    }>(
      `SELECT booking_type, provider_booking_ref, status, segment_reference, pricing
       FROM bookings WHERE trip_id = $1 ORDER BY created_at ASC`,
      [tripId]
    );

    const confirmed = outcomes.filter((o) => o === 'confirmed').length;
    const failed = outcomes.filter((o) => o === 'failed').length;
    const pending = outcomes.filter((o) => o === 'pending').length;
    const total = outcomes.length;

    const destLabel =
      itinerary.destinations?.join(', ') ||
      (trip.destinations ?? []).map((d) => d.name || d.iso).filter(Boolean).join(', ') ||
      'your trip';

    if (failed === total) {
      await pool.query(
        `UPDATE trips
         SET escalation_flag = true,
             escalation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [
          tripId,
          `All ${total} booking segment(s) failed: ${failedLabels.join('; ')}`,
        ]
      );
      const failEmail = bookingFailureEmail({
        name: trip.client_name,
        destinationLabel: destLabel,
        reason: `I wasn't able to complete the automatic bookings (${failedLabels.join(', ')}).`,
        optionsNote:
          "Reply to this email or I'll reach out with alternatives shortly.",
      });
      void sendEmail({
        to: trip.client_email,
        subject: failEmail.subject,
        html: failEmail.html,
        text: failEmail.text,
      }).catch((err) => console.error('[booking] failure email failed:', err));
      console.info('[booking] all segments failed', { tripId });
      return;
    }

    const escalationParts: string[] = [];
    if (failed > 0) escalationParts.push(`Failed: ${failedLabels.join('; ')}`);
    if (pending > 0) {
      escalationParts.push(
        `Pending client input (price): ${pendingLabels.join('; ')}`
      );
    }

    await pool.query(
      `UPDATE trips
       SET status = 'booked',
           escalation_flag = $2,
           escalation_reason = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [
        tripId,
        escalationParts.length > 0,
        escalationParts.length > 0 ? escalationParts.join(' | ') : null,
      ]
    );

    if (pending > 0 || failed > 0) {
      const failEmail = bookingFailureEmail({
        name: trip.client_name,
        destinationLabel: destLabel,
        reason:
          pending > 0 && failed === 0
            ? `A price change above 5% blocked automatic booking for: ${pendingLabels.join(', ')}.`
            : `Some segments need attention: ${[...failedLabels, ...pendingLabels].join(', ')}.`,
        optionsNote:
          "Reply to this email or I'll reach out with alternatives.",
      });
      void sendEmail({
        to: trip.client_email,
        subject: failEmail.subject,
        html: failEmail.html,
        text: failEmail.text,
      }).catch((err) => console.error('[booking] failure email failed:', err));
    }

    const summaryLines = bookingRows.rows
      .filter((r) => r.status === 'confirmed')
      .map((r) => {
        const seg = r.segment_reference;
        const label =
          seg.type === 'flight'
            ? `${seg.details.origin} → ${seg.details.destination}`
            : seg.details.name;
        const amount =
          r.pricing?.amount != null
            ? `${r.pricing.amount} ${r.pricing.currency ?? ''}`.trim()
            : undefined;
        return {
          type: r.booking_type,
          label,
          confirmationNumber: r.provider_booking_ref ?? 'pending',
          amountNote: amount,
        };
      });

    const summary = bookingSummaryEmail({
      name: trip.client_name,
      destinationLabel: destLabel,
      segments: summaryLines.length ? summaryLines : confirmedSummaries,
      itineraryUrl: buildTripPdfUrl(tripId),
      notes:
        pending > 0 || failed > 0
          ? 'A few segments still need a human touch — I will follow up separately.'
          : undefined,
    });
    void sendEmail({
      to: trip.client_email,
      subject: summary.subject,
      html: summary.html,
      text: summary.text,
    }).catch((err) => console.error('[booking] summary email failed:', err));

    console.info('[booking] complete', {
      tripId,
      confirmed,
      pending,
      failed,
      total,
    });
  } catch (err) {
    console.error('[booking] unexpected failure', { tripId, err });
    try {
      await pool.query(
        `UPDATE trips
         SET escalation_flag = true,
             escalation_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [
          tripId,
          err instanceof Error ? err.message : 'Unexpected booking pipeline error',
        ]
      );
    } catch {
      /* ignore */
    }
  }
}

export function scheduleExecuteBookings(tripId: string): void {
  setImmediate(() => {
    void executeBookings(tripId).catch((err) => {
      console.error('[booking] unhandled', { tripId, err });
    });
  });
}
