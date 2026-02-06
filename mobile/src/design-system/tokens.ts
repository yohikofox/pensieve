/**
 * Design System Tokens - Source of Truth
 * Toutes les valeurs UI dérivent de ces tokens
 */

// ============================================
// COULEURS - Palette de base
// ============================================

// Color Scheme Types
export type ColorScheme = 'blue' | 'green' | 'monochrome';

export const colors = {
  // Palette primaire - Bleu (default)
  primary: {
    50: '#EBF5FF',
    100: '#E1EFFE',
    200: '#C3DDFD',
    300: '#A4CAFE',
    400: '#76A9FA',
    500: '#3B82F6', // Primary Blue
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Palette primaire - Vert (nature)
  primaryGreen: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981', // Primary Green
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Palette primaire - Monochrome (noir/blanc/gris)
  primaryMonochrome: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280', // Primary Monochrome
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Palette secondaire - Rose/Corail (pour Blue scheme)
  secondary: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#F43F5E', // Secondary Rose
    600: '#E11D48',
    700: '#BE123C',
    800: '#9F1239',
    900: '#881337',
  },

  // Palette secondaire - Orange/Terre (pour Green scheme)
  secondaryGreen: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316', // Secondary Orange
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },

  // Palette secondaire - Gris (pour Monochrome scheme)
  secondaryMonochrome: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#9CA3AF', // Secondary Gris clair (light mode)
    600: '#6B7280',
    700: '#4B5563',
    800: '#374151',
    900: '#374151', // Secondary Gris foncé (dark mode)
  },

  // Neutres
  neutral: {
    0: '#FFFFFF',
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
    1000: '#000000',
  },

  // Sémantiques - Success
  success: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    300: '#6EE7B7',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    800: '#065F46',
    900: '#064E3B',
  },

  // Sémantiques - Warning
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Sémantiques - Error
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Sémantiques - Info
  info: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },
} as const;

// ============================================
// COULEURS - Sémantiques UI
// ============================================
export const semanticColors = {
  // Backgrounds
  background: {
    primary: colors.neutral[0],
    secondary: colors.neutral[50],
    tertiary: colors.neutral[100],
    inverse: colors.neutral[900],
  },

  // Textes
  text: {
    primary: colors.neutral[900],
    secondary: colors.neutral[500],
    tertiary: colors.neutral[400],
    inverse: colors.neutral[0],
    link: colors.primary[500],
  },

  // Bordures
  border: {
    default: colors.neutral[200],
    subtle: colors.neutral[100],
    strong: colors.neutral[300],
  },

  // États de capture
  captureStatus: {
    pending: {
      background: colors.warning[50],
      text: colors.warning[700],
      border: colors.warning[200],
    },
    processing: {
      background: colors.info[50],
      text: colors.info[700],
      border: colors.info[200],
    },
    ready: {
      background: colors.success[50],
      text: colors.success[700],
      border: colors.success[200],
    },
    failed: {
      background: colors.error[50],
      text: colors.error[700],
      border: colors.error[200],
    },
  },

  // Actions
  action: {
    primary: colors.primary[500],
    primaryHover: colors.primary[600],
    secondary: colors.neutral[100],
    secondaryHover: colors.neutral[200],
    danger: colors.error[500],
    dangerHover: colors.error[600],
    success: colors.success[500],
  },
} as const;

// ============================================
// ESPACEMENTS
// ============================================
export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// ============================================
// TYPOGRAPHIE
// ============================================
export const typography = {
  fontFamily: {
    sans: 'System',
    mono: 'Menlo',
  },

  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ============================================
// BORDURES
// ============================================
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 10,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const borderWidth = {
  0: 0,
  1: 1,
  2: 2,
  4: 4,
} as const;

// ============================================
// OMBRES
// ============================================
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  base: {
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: colors.neutral[1000],
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// ============================================
// TAILLES DE COMPOSANTS
// ============================================
export const componentSizes = {
  // Boutons
  button: {
    sm: { height: 32, paddingHorizontal: spacing[3], fontSize: typography.fontSize.sm },
    md: { height: 44, paddingHorizontal: spacing[4], fontSize: typography.fontSize.base },
    lg: { height: 52, paddingHorizontal: spacing[5], fontSize: typography.fontSize.lg },
  },

  // Icônes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40,
  },

  // Cards
  card: {
    padding: spacing[4],
    borderRadius: borderRadius.lg,
  },

  // Inputs
  input: {
    height: 44,
    paddingHorizontal: spacing[3],
    borderRadius: borderRadius.base,
  },

  // Badges
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    fontSize: typography.fontSize.xs,
  },
} as const;

// ============================================
// ANIMATIONS
// ============================================
export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// ============================================
// Z-INDEX
// ============================================
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
} as const;

// ============================================
// COLOR SCHEME HELPERS
// ============================================

/**
 * Get the primary color palette for a given color scheme
 */
export function getPrimaryPaletteForColorScheme(scheme: ColorScheme) {
  switch (scheme) {
    case 'blue':
      return colors.primary;
    case 'green':
      return colors.primaryGreen;
    case 'monochrome':
      return colors.primaryMonochrome;
    default:
      return colors.primary;
  }
}

/**
 * Get the secondary color palette for a given color scheme
 */
export function getSecondaryPaletteForColorScheme(scheme: ColorScheme) {
  switch (scheme) {
    case 'blue':
      return colors.secondary;
    case 'green':
      return colors.secondaryGreen;
    case 'monochrome':
      return colors.secondaryMonochrome;
    default:
      return colors.secondary;
  }
}

/**
 * Get tinted background colors for a given color scheme
 */
export function getBackgroundColorsForColorScheme(scheme: ColorScheme, isDark: boolean) {
  switch (scheme) {
    case 'blue':
      return {
        screen: isDark ? '#0F1629' : '#EBF5FF',     // Teinte bleue
        card: isDark ? '#1E2A47' : '#FFFFFF',
        elevated: isDark ? '#1E2A47' : '#FFFFFF',
        input: isDark ? '#1E2A47' : '#FFFFFF',
        subtle: isDark ? '#2D3E5F' : '#E1EFFE',
        inverse: isDark ? '#F3F4F6' : '#111827',
      };
    case 'green':
      return {
        screen: isDark ? '#0A1F17' : '#ECFDF5',     // Teinte verte
        card: isDark ? '#1A3A2E' : '#FFFFFF',
        elevated: isDark ? '#1A3A2E' : '#FFFFFF',
        input: isDark ? '#1A3A2E' : '#FFFFFF',
        subtle: isDark ? '#2A4A3E' : '#D1FAE5',
        inverse: isDark ? '#F3F4F6' : '#111827',
      };
    case 'monochrome':
      return {
        screen: isDark ? colors.neutral[900] : colors.neutral[100],  // Gris pur
        card: isDark ? colors.neutral[800] : colors.neutral[0],
        elevated: isDark ? colors.neutral[800] : colors.neutral[0],
        input: isDark ? colors.neutral[800] : colors.neutral[0],
        subtle: isDark ? colors.neutral[700] : colors.neutral[50],
        inverse: isDark ? colors.neutral[100] : colors.neutral[900],
      };
    default:
      return {
        screen: isDark ? colors.neutral[900] : colors.neutral[100],
        card: isDark ? colors.neutral[800] : colors.neutral[0],
        elevated: isDark ? colors.neutral[800] : colors.neutral[0],
        input: isDark ? colors.neutral[800] : colors.neutral[0],
        subtle: isDark ? colors.neutral[700] : colors.neutral[50],
        inverse: isDark ? colors.neutral[100] : colors.neutral[900],
      };
  }
}
