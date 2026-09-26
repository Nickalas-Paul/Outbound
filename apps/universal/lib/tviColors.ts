/** TVI choropleth — re-exports shared scale from @outbound/core for app imports. */

import {
  SCORE_COLOR_STOPS,
  SCORE_NULL_FILL,
  SCORE_STOP_MAX,
  SCORE_STOP_MIN,
  scoreColor,
  scoreFillColorExpression,
} from '@outbound/core';

export const TVI_NULL_FILL = SCORE_NULL_FILL;
export const TVI_BORDER = '#2a2a3e';
export const TVI_BORDER_HOVER = '#c8c8d8';

export const TVI_SCORE_MIN = SCORE_STOP_MIN;
export const TVI_SCORE_MAX = SCORE_STOP_MAX;

export const TVI_COLOR_STOPS: Array<[number, string]> = SCORE_COLOR_STOPS.map(
  ([s, c]) => [s, c]
);

export const tviScoreColor = scoreColor;

/** Web + native use the same property and stops. */
export function tviFillColorExpression(): unknown[] {
  return scoreFillColorExpression('overall');
}

export function tviFillColorExpressionNative(): unknown[] {
  return scoreFillColorExpression('overallScore');
}

export const TVI_LEGEND_GRADIENT = `linear-gradient(90deg, ${TVI_COLOR_STOPS.map(
  ([, c]) => c
).join(', ')})`;
