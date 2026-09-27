export const designTokens = {
  colors: { ink: '#0b132b', accent: '#5541f5', surface: '#ffffff' },
  radius: { sharp: '0px', subtle: '0.5rem', rounded: '1rem', pill: '9999px' },
} as const;

export type DesignTokens = typeof designTokens;

