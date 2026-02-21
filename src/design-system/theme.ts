import { colors, radius, spacing, typography } from './tokens'

export const theme = {
  colors,
  radius,
  spacing,
  typography,
} as const

export type AppTheme = typeof theme
