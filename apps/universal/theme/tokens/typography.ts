/**
 * Typography tokens standardized from existing apps/universal StyleSheet usage.
 *
 * Frequency notes (active explorer + marketing screens):
 * - 11: captions, filter hints, legend edges, pills
 * - 13: explorer chrome buttons, tabs, list rows
 * - 14: body copy, methodology, form helpers
 * - 16: inputs, landing subcopy
 * - 22: section / country titles
 * - 28: page titles (login, settings)
 * - 36: landing / methodology display headlines
 * Absolute lineHeights in-app are typically fontSize × ~1.2–1.5
 * (e.g. 16→24, 14→20, 36→42).
 */

export const typography = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 14,
    lg: 16,
    xl: 22,
    xxl: 28,
    display: 36,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.65,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;
