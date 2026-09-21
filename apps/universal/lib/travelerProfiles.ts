/** Client-facing traveler profile catalog (labels). Weights live on the API. */

export type TravelerProfileOption = {
  key: string;
  label: string;
  description?: string;
};

export const TRAVELER_PROFILE_OPTIONS: TravelerProfileOption[] = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'Equal emphasis across destination factors',
  },
  {
    key: 'solo_backpacker',
    label: 'Solo Backpacker',
    description: 'cost and access first, with safety',
  },
  {
    key: 'couple',
    label: 'Couple / Honeymoon',
    description: 'safety and travel comfort',
  },
  {
    key: 'family',
    label: 'Family',
    description: 'safety-first, steadier destinations',
  },
  {
    key: 'group',
    label: 'Group / Tour',
    description: 'access and tourism infrastructure',
  },
  {
    key: 'luxury',
    label: 'Luxury',
    description: 'travel infrastructure and comfort',
  },
  {
    key: 'budget',
    label: 'Budget',
    description: 'cost-led with flexibility',
  },
];

export const DEFAULT_TRAVELER_PROFILE = 'balanced';

export function profileLabel(key: string): string {
  return (
    TRAVELER_PROFILE_OPTIONS.find((v) => v.key === key)?.label ??
    TRAVELER_PROFILE_OPTIONS[0].label
  );
}
