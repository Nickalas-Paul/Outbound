/**
 * Display helpers for Layer 2 market signals in the explorer UI.
 */

import type { MarketSignal, SignalDirection } from '@outbound/core';

const DIM_SHORT: Record<string, string> = {
  tourismInfrastructure: 'Tourism Cap.',
  accessibility: 'Access',
  costIndex: 'Cost',
  safetyAndEntry: 'Safety',
  travelInfrastructure: 'Travel Infra',
  crowding: 'Crowding',
  trajectory: 'Trajectory',
};

export function shortDimensionLabels(dims: string[] | null | undefined): string {
  if (!dims?.length) return '';
  return dims.map((d) => DIM_SHORT[d] ?? d).join(', ');
}

export function shortDimensionList(dims: string[] | null | undefined): string[] {
  if (!dims?.length) return [];
  return dims.map((d) => DIM_SHORT[d] ?? d);
}

export function signalAccent(direction: SignalDirection): {
  dot: string;
  cardBg: string;
  pillBg: string;
  pillText: string;
} {
  if (direction === 'negative') {
    return {
      dot: '#f59e0b',
      cardBg: 'rgba(245, 158, 11, 0.06)',
      pillBg: 'rgba(245, 158, 11, 0.12)',
      pillText: '#f59e0b',
    };
  }
  if (direction === 'positive') {
    return {
      dot: '#22d3ee',
      cardBg: 'rgba(34, 211, 238, 0.04)',
      pillBg: 'rgba(34, 211, 238, 0.12)',
      pillText: '#22d3ee',
    };
  }
  return {
    dot: '#9ca3af',
    cardBg: 'rgba(156, 163, 175, 0.06)',
    pillBg: 'rgba(156, 163, 175, 0.12)',
    pillText: '#9ca3af',
  };
}

export function formatRelativeFetchedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Updated recently';
  const hours = Math.max(0, Math.round((Date.now() - t) / 3_600_000));
  if (hours < 1) return 'Updated just now';
  if (hours === 1) return 'Updated 1h ago';
  if (hours < 48) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}

export function formatProbabilityPct(p: number | null | undefined): string | null {
  if (p == null || Number.isNaN(Number(p))) return null;
  const n = Number(p);
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}% prob`;
}

export function directionLabel(direction: SignalDirection): string {
  if (direction === 'positive') return 'Positive';
  if (direction === 'negative') return 'Negative';
  return 'Neutral';
}

/** MaterialCommunityIcons name closest to the Tabler mapping in the spec. */
export function signalTypeIcon(signalType: string): string {
  switch (signalType) {
    case 'political_instability':
      return 'alert';
    case 'natural_disaster':
      return 'weather-lightning';
    case 'currency_crisis':
      return 'currency-usd';
    case 'sanctions':
      return 'cancel';
    case 'entry_policy_change':
      return 'passport';
    case 'civil_unrest':
      return 'account-group';
    case 'infrastructure_event':
      return 'road-variant';
    case 'travel_advisory':
      return 'map-marker-alert';
    case 'health_emergency':
      return 'hospital-box';
    case 'extreme_weather':
      return 'weather-pouring';
    case 'airline_disruption':
      return 'airplane-off';
    default:
      return 'information-outline';
  }
}

export function signalTypeLabel(signalType: string): string {
  const labels: Record<string, string> = {
    political_instability: 'Political Instability',
    natural_disaster: 'Natural Disaster',
    currency_crisis: 'Currency Alert',
    sanctions: 'Sanctions',
    entry_policy_change: 'Entry Policy Change',
    civil_unrest: 'Civil Unrest',
    infrastructure_event: 'Infrastructure Event',
    travel_advisory: 'Travel Advisory',
    health_emergency: 'Health Emergency',
    extreme_weather: 'Extreme Weather',
    airline_disruption: 'Airline Disruption',
  };
  return labels[signalType] ?? signalType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sourceDisplayLabel(source: string): string {
  const map: Record<string, string> = {
    polymarket: 'Polymarket',
    kalshi: 'Kalshi',
    gdelt: 'GDELT',
    gdelt_seed: 'GDELT',
    seed: 'Seed',
    gdacs: 'GDACS',
    ecb_fx: 'ECB',
    opensanctions: 'OpenSanctions',
    state_dept: 'US State Dept',
    newsapi: 'News',
  };
  return map[source] ?? source;
}

export type { MarketSignal };
