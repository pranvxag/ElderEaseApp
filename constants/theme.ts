// ElderEase Theme — Warm, Accessible, High-Contrast
// Designed for seniors (65+): large fonts, strong contrast, calm palette

export const Colors = {
  // Core brand
  primary: '#1A7A6E',
  primaryDark: '#125C54',
  primaryLight: '#E6F4F2',
  primaryMid: '#A8D8D2',

  // Accent
  accent: '#F5A623',
  accentLight: '#FFF4E0',

  // Emergency
  emergency: '#D93025',
  emergencyLight: '#FDECEA',
  emergencyBorder: '#F5C6C3',

  // Status
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#E65100',
  warningLight: '#FFF3E0',
  missed: '#B71C1C',
  missedLight: '#FFEBEE',

  // Neutrals
  background: '#F5F0EA',
  cardBg: '#FFFFFF',
  inputBg: '#F9F6F1',
  border: '#DDD5C8',
  divider: '#EDE7DE',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#5C5C5C',
  textMuted: '#9E9E9E',
  textOnPrimary: '#FFFFFF',

  // Tab bar
  tabActive: '#1A7A6E',
  tabInactive: '#9E9E9E',
};

export const FontSizes = {
  // Larger than usual — seniors need readability
  xs: 14,
  sm: 16,
  md: 18,
  body: 19,
  lg: 22,
  xl: 26,
  xxl: 30,
  display: 36,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Shadows = {
  card: {
    shadowColor: '#1A7A6E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
};