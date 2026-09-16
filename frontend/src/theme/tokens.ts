import { Platform } from 'react-native';

/**
 * PRAMAN Government Compliance Design System Tokens
 */

export const pramanColor = {
  bgIvory: '#F7F4EC',
  cardWhite: '#FFFFFF',
  primaryBlue: '#1E4E79',
  deepBlue: '#173E62',
  accentBlue: '#3E76A6',
  borderColor: '#DEE1D5',
  mutedText: '#66695F',
  darkText: '#17252A',
  dangerRed: '#B91C1C',
  dangerBg: '#FDF2F2',
  successGreen: '#15803D',
  successBg: '#F0FDF4',
  inputBg: '#FAF9F6',
  tabInactiveBg: '#EFECE4',
};

export const pramanFont = {
  heading: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Fraunces, "Times New Roman", Georgia, serif',
  }),
  body: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  }),
  mono: Platform.select({
    ios: 'Courier',
    android: 'monospace',
    default: '"JetBrains Mono", "Courier New", Consolas, monospace',
  }),
};

export const color = {
  // Canvas & Surfaces
  background: pramanColor.bgIvory,
  surface: pramanColor.cardWhite,
  surfaceElevated: '#FFFFFF',
  surfaceHeader: pramanColor.deepBlue,
  surfaceBorder: pramanColor.borderColor,
  surfaceBorderDark: '#BCC1B3',
  surfaceHover: '#F2EFE6',
  surfaceSelected: '#E6ECF2',

  // Typography / Ink
  ink: pramanColor.darkText,
  inkSecondary: '#3E4238',
  inkMuted: pramanColor.mutedText,
  inkLight: '#8A8D83',
  inkInverse: '#FFFFFF',

  // Brand / Primary Action
  primary: pramanColor.primaryBlue,
  primaryHover: pramanColor.deepBlue,
  primaryLight: '#E8F0F7',
  primaryBorder: pramanColor.accentBlue,

  // Accent Tones & Legacy Aliases
  accent: pramanColor.primaryBlue,
  accentSoft: '#EEF2FF',
  accentViolet: '#5B468D',
  accentPink: '#9D446E',
  accentRose: '#9F3A3A',
  accentEmerald: pramanColor.successGreen,
  accentAmber: '#B46C09',
  accentSky: pramanColor.accentBlue,
  accentTeal: '#2A6A74',
  accentCyan: '#0EA5E9',

  // Neutral Tones
  mist: '#F1F5F9',
  slate: '#64748B',
  white: '#FFFFFF',

  // Status & Pass/Fail Aliases
  pass: '#10B981',
  passBorder: '#A7F3D0',
  passSoft: '#ECFDF5',
  failBorder: '#FCA5A5',
  warningSoft: '#FFFBEB',
  success: pramanColor.successGreen,
  successBg: pramanColor.successBg,
  successBorder: '#BBF7D0',
  successText: '#15803D',

  warning: '#B46C09',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  danger: pramanColor.dangerRed,
  dangerBg: pramanColor.dangerBg,
  dangerBorder: '#FCA5A5',
  dangerText: pramanColor.dangerRed,

  info: pramanColor.accentBlue,
  infoBg: '#F0F5FA',
  infoBorder: '#BAE6FD',
  infoText: pramanColor.primaryBlue,
};

export const font = {
  family: pramanFont.body,
  familyHeading: pramanFont.heading,
  familyMono: pramanFont.mono,
  size: {
    xs: 12,
    sm: 13,
    body: 14,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    heading: 28,
    display: 32,
  },
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const space = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const shadow = {
  sm: Platform.select({
    web: { boxShadow: '0 2px 6px 0 rgba(23, 62, 98, 0.05)' },
    default: {
      shadowColor: '#173E62',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
  }),
  md: Platform.select({
    web: { boxShadow: '0 4px 16px -2px rgba(23, 62, 98, 0.08), 0 2px 4px -1px rgba(23, 62, 98, 0.04)' },
    default: {
      shadowColor: '#173E62',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
  }),
  lg: Platform.select({
    web: { boxShadow: '0 12px 28px -4px rgba(23, 62, 98, 0.12), 0 4px 12px -2px rgba(23, 62, 98, 0.06)' },
    default: {
      shadowColor: '#173E62',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    },
  }),
};
