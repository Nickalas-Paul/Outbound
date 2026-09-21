/**
 * Market signal types — Layer 2 event/prediction overlays on TVI scores.
 *
 * Travel categories (Phase 1 Step 5). Formerly GEXIS business categories
 * (tariff_risk, trade_agreement, regulatory_change, economic_policy, labor_unrest).
 */

export type SignalDirection = "positive" | "negative" | "neutral";

export const SIGNAL_TYPE_KEYS = [
  "political_instability",
  "natural_disaster",
  "currency_crisis",
  "sanctions",
  "entry_policy_change",
  "civil_unrest",
  "infrastructure_event",
  "travel_advisory",
  "health_emergency",
  "extreme_weather",
  "airline_disruption",
] as const;

export type SignalType = (typeof SIGNAL_TYPE_KEYS)[number];

export const SIGNAL_TYPE_LABELS: Record<SignalType, string> = {
  political_instability: "Political Instability",
  natural_disaster: "Natural Disaster",
  currency_crisis: "Currency Crisis",
  sanctions: "Sanctions",
  entry_policy_change: "Entry Policy Change",
  civil_unrest: "Civil Unrest",
  infrastructure_event: "Infrastructure Event",
  travel_advisory: "Travel Advisory",
  health_emergency: "Health Emergency",
  extreme_weather: "Extreme Weather",
  airline_disruption: "Airline Disruption",
};

export const SIGNAL_TYPE_DESCRIPTIONS: Record<SignalType, string> = {
  political_instability: "Political unrest, coups, protests",
  natural_disaster: "Earthquakes, floods, volcanic activity",
  currency_crisis: "Rapid currency devaluation, capital controls",
  sanctions: "International sanctions affecting travel",
  entry_policy_change: "Visa policy changes, border restrictions",
  civil_unrest: "Strikes, demonstrations, civil disorder",
  infrastructure_event: "Transport shutdowns, power outages",
  travel_advisory: "Government travel advisory level changes",
  health_emergency: "Disease outbreaks, WHO declarations",
  extreme_weather: "Severe storms, heat waves, flooding",
  airline_disruption: "Route cancellations, airline strikes",
};

export interface MarketSignal {
  id: string;
  source: string;
  signalType: SignalType | string;
  title: string;
  description: string | null;
  probability: number | null;
  severity: number;
  direction: SignalDirection;
  affectedDimensions: string[];
  eventUrl: string | null;
  fetchedAt: string;
  expiresAt: string | null;
}

/** Geography ISO3 → active signal count (summary endpoint). */
export type SignalSummaryMap = Record<string, number>;
