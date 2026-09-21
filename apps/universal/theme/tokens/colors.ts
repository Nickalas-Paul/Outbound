/**
 * Design tokens — color primitives and semantic mappings.
 * Parallel to existing hardcoded styles / tviColors.ts / signalsUi.ts.
 * New Phase 2 components should import from here; do not migrate old screens yet.
 */

export const palette = {
  // Dark explorer
  navy950: '#0b0b12',
  navy900: '#0e0e16',
  navy850: '#12121c',
  navy800: '#1a1a2e',
  navy700: '#2a2a3e',
  navyOverlay: 'rgba(12,12,20,0.85)',

  // Light / marketing
  cream50: '#f7f7f5',
  ink900: '#1a1a1a',
  white: '#ffffff',

  // TVI choropleth scale (low → high)
  score1: '#1e3a5f',
  score2: '#1a6b5a',
  score3: '#7a7a2e',
  score4: '#c4651a',
  score5: '#d93025',

  // Filter / data accents
  blue500: '#5b8def',
  blue600: '#3d8bfd',
  amber500: '#e0a03a',
  green500: '#3ecf8e',
  red400: '#d96b6b',
  purple400: '#9b7bde',

  // Text on dark surfaces (from explorer overlays)
  white70: 'rgba(255,255,255,0.7)',
  white55: 'rgba(255,255,255,0.55)',
} as const;

export const colors = {
  background: palette.navy950,
  backgroundElevated: palette.navy900,
  surface: palette.navy850,
  surfaceOverlay: palette.navyOverlay,
  border: palette.navy700,

  textPrimary: palette.white,
  textSecondary: palette.white70,
  textMuted: palette.white55,
  textOnLight: palette.ink900,

  /** Primary brand / action — explorer population accent / action blue */
  accent: palette.blue500,
  accentHover: palette.blue600,

  success: palette.green500,
  warning: palette.amber500,
  error: palette.red400,

  scoreLow: palette.score1,
  scoreMidLow: palette.score2,
  scoreMid: palette.score3,
  scoreMidHigh: palette.score4,
  scoreHigh: palette.score5,
  scoreNull: palette.navy800,
} as const;
