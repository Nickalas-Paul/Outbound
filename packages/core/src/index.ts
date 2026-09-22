export interface Geography {
  id: string;
  name: string;
  regionType: "country" | "state" | "metro" | "municipality";
  geometry: GeoJSON.Geometry;
  tviScore?: number;
}

export interface TVIScore {
  overall: number;
  dimensions: {
    tourismInfrastructure: number;
    accessibility: number;
    costIndex: number;
    safetyAndEntry: number;
    travelInfrastructure: number;
    crowding: number;
    trajectory: number;
  };
  confidence: "high" | "medium" | "low";
  lastUpdated: string;
}

export const TVI_VERSION = "0.1.0";

export {
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_VIEWPORT,
  type MapViewport,
} from "./mapConfig";

export {
  COUNTRY_QUICK_FACTS,
  getQuickFacts,
  type CountryQuickFacts,
} from "./quickFacts";

export {
  TVI_DIMENSION_DISPLAY,
  TVI_UI_DIMENSION_ORDER,
  SOURCE_DISPLAY_NAMES,
  TVI_SOURCE_CATALOG,
  TVI_SCORING_VERSION_LABEL,
  getDimensionDisplay,
  getOrderedDimensionDisplay,
  sourceDisplayName,
  formatNormalization,
  formatDirection,
  type DimensionKey,
  type DimensionDisplay,
  type IndicatorDisplay,
  type IndicatorDirection,
  type IndicatorNormalization,
  type SourceCatalogEntry,
} from "./tviDisplay";

export {
  ALL_FILTER_KEYS,
  ALL_HORIZONS,
  FREE_FILTER_KEYS,
  GATING_ENABLED,
  TIER_FEATURES,
  canAccessFeature,
  canUseFilter,
  canUseHorizon,
  getAvailableFilters,
  isGatingEnabled,
  type FilterKey,
  type SubscriptionTier,
  type TierFeature,
  type TierFeatureMap,
  type TimeHorizon,
} from "./tiers";

// Agents
export * from "./agents";

// Traveler Profiles (formerly industry verticals)
export * from "./travelerProfiles";

// Market Signals (Layer 2)
export {
  SIGNAL_TYPE_KEYS,
  SIGNAL_TYPE_LABELS,
  SIGNAL_TYPE_DESCRIPTIONS,
  type MarketSignal,
  type SignalDirection,
  type SignalSummaryMap,
  type SignalType,
} from "./signals";

// Trip intake (Phase 2 Prompt 4a)
export {
  SERVICE_TIERS,
  TRIP_TYPES,
  intakeSchema,
  isGroupSizeSoftWarning,
  type IntakePayload,
} from "./schemas/intake";

// Explorer traveler preferences (Phase 3)
export {
  BUDGET_TIERS,
  CROWDING_PREFERENCES,
  DEFAULT_TRAVELER_PREFERENCES,
  EASE_OF_TRAVEL,
  SAFETY_TOLERANCES,
  TRIP_TYPES_PREF,
  isTravelerPreferences,
  normalizeWeights,
  parseTravelerPreferences,
  preferencesToFilters,
  preferencesToWeights,
  weightSum,
  type BudgetTier,
  type CrowdingPreference,
  type DimensionWeights,
  type EaseOfTravel,
  type PreferenceHardFilters,
  type SafetyTolerance,
  type TravelerPreferences,
  type TripTypePref,
} from "./preferences";
