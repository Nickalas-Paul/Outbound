/**
 * Smoke test: Duffel flight search JFK → LHR, 30 days out, 1 pax economy.
 * Run from server/api: npx ts-node --transpile-only src/scripts/duffel-smoke.ts
 */

import '../config/env';
import {
  isDuffelConfigured,
  searchFlights,
} from '../services/booking/duffel';

async function main() {
  console.log('[duffel-smoke] configured =', isDuffelConfigured());
  const departure = new Date();
  departure.setUTCDate(departure.getUTCDate() + 30);
  const departureDate = departure.toISOString().slice(0, 10);

  const result = await searchFlights({
    origin: 'JFK',
    destination: 'LHR',
    departureDate,
    passengers: 1,
    cabinClass: 'economy',
  });

  if (!result.ok) {
    console.error('[duffel-smoke] FAILED:', result.error);
    process.exitCode = 1;
    return;
  }

  console.log('[duffel-smoke] offerRequestId =', result.offerRequestId);
  console.log('[duffel-smoke] offers =', result.offers.length);
  if (result.offers[0]) {
    const o = result.offers[0];
    console.log('[duffel-smoke] sample offer', {
      id: o.id,
      totalAmount: o.totalAmount,
      currency: o.currency,
      cabinClass: o.cabinClass,
      slices: o.slices,
    });
  }
}

void main();
