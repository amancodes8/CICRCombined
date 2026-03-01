/**
 * CICR Mobile – Design system matching the web app's dark theme.
 * Mirrors CSS custom properties from cicrfrontend/src/index.css.
 */

export const colors = {
  // Surfaces (dark gradient depth)
  surface0: '#070a0f',
  surface1: '#0c1017',
  surface2: '#10151e',
  surface3: '#151b26',
  surface4: '#181f2a',

  // Text
  textPrimary: '#f3f4f6',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  textInverse: '#0f172a',

  // Brand accent
  accentBlue: '#38bdf8',
  accentPurple: '#a78bfa',
  accentGradientStart: '#38bdf8',
  accentGradientEnd: '#818cf8',

  // Status
  success: '#34d399',
  successBg: 'rgba(52,211,153,0.10)',
  warning: '#fbbf24',
  warningBg: 'rgba(251,191,36,0.10)',
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.10)',
  info: '#60a5fa',
  infoBg: 'rgba(96,165,250,0.10)',

  // Borders
  borderSubtle: 'rgba(148,163,184,0.12)',
  borderMedium: 'rgba(148,163,184,0.22)',
  borderStrong: 'rgba(148,163,184,0.42)',

  // Specific UI
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Status badge colors
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
  cyan: '#22d3ee',
  blue: '#60a5fa',
  purple: '#a78bfa',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 36,
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const shadow = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 10,
  },
};
