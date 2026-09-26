/**
 * Shared TVI / score choropleth scale — single source for web, native, legends.
 * Sequential cool→warm-green (not red-high). Colorblind-friendlier than red/green diverging.
 * Observed score band ~18–76 (padded).
 */

export const SCORE_NULL_FILL = '#1a1a2e';

/** Observed paint range (matches compute_tvi band with slight pad). */
export const SCORE_STOP_MIN = 18;
export const SCORE_STOP_MAX = 76;

/**
 * Linear stops: muted slate → vivid mint.
 * High scores are positive/vivid green — never red.
 */
export const SCORE_COLOR_STOPS: ReadonlyArray<readonly [number, string]> = [
  [18, '#3a4a62'],
  [32, '#2d6a7e'],
  [47, '#1f8f7a'],
  [62, '#22b45a'],
  [76, '#5ce08a'],
] as const;

export function scoreColor(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return SCORE_NULL_FILL;
  const s = Math.max(SCORE_STOP_MIN, Math.min(SCORE_STOP_MAX, score));
  for (let i = 0; i < SCORE_COLOR_STOPS.length - 1; i++) {
    const [aScore, aColor] = SCORE_COLOR_STOPS[i];
    const [bScore, bColor] = SCORE_COLOR_STOPS[i + 1];
    if (s <= bScore) {
      if (s <= aScore) return aColor;
      const t = (s - aScore) / (bScore - aScore);
      return lerpHex(aColor, bColor, t);
    }
  }
  return SCORE_COLOR_STOPS[SCORE_COLOR_STOPS.length - 1][1];
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

/** Mapbox GL / RNMapbox interpolate expression for a numeric GeoJSON property. */
export function scoreFillColorExpression(property: string): unknown[] {
  const interpolate: unknown[] = [
    'interpolate',
    ['linear'],
    ['get', property],
  ];
  for (const [score, color] of SCORE_COLOR_STOPS) {
    interpolate.push(score, color);
  }
  return [
    'case',
    ['==', ['typeof', ['get', property]], 'number'],
    interpolate,
    SCORE_NULL_FILL,
  ];
}
