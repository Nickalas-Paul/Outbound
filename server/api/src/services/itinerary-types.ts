/**
 * Structured itinerary JSON produced by Sonnet composition.
 */

export type ItineraryContent = {
  title: string;
  summary: string;
  destinations: string[];
  totalDays: number;
  estimatedBudgetPerPerson: {
    low: number;
    high: number;
    currency: string;
  };
  days: Array<{
    dayNumber: number;
    date?: string;
    location: string;
    theme: string;
    accommodation: {
      name: string;
      type: string;
      estimatedCostPerNight: number;
      bookingNotes: string;
    };
    activities: Array<{
      time: string;
      name: string;
      description: string;
      estimatedCost: number;
      duration: string;
      bookingRequired: boolean;
    }>;
    meals: Array<{
      type: string;
      suggestion: string;
      estimatedCost: number;
    }>;
    logistics: string;
    tips: string;
  }>;
  generalTips: string[];
  packingNotes: string[];
  importantNotes: string[];
};

export function isItineraryContent(raw: unknown): raw is ItineraryContent {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.title === 'string' &&
    typeof o.summary === 'string' &&
    Array.isArray(o.days) &&
    o.days.length > 0
  );
}
