export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
} as const

export const radii = {
  sm: '5px',
  md: '8px',
  lg: '12px',
} as const

export const fontFamily = {
  display: '"DM Sans Variable", "Figtree Variable", system-ui, sans-serif',
  body: '"DM Sans Variable", "Figtree Variable", system-ui, sans-serif',
  mono: '"JetBrains Mono Variable", "JetBrains Mono", "IBM Plex Mono", monospace',
} as const

/** Color token names — hexes live in CSS `:root` / `.dark` */
export const colorTokenNames = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'fg',
  'muted',
  'accent',
  'accent-2',
  'green',
  'amber',
  'red',
] as const

export type ColorTokenName = (typeof colorTokenNames)[number]

export const designTokens = {
  spacing,
  radii,
  fontFamily,
  colorTokenNames,
} as const
