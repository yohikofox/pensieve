/**
 * useCaptureTheme
 *
 * Custom hook that provides theme-aware color palette for CaptureDetailScreen.
 * Adapts colors based on dark mode and color scheme preferences.
 *
 * Extracted from CaptureDetailScreen.tsx to reduce complexity and improve reusability.
 */

import {
  colors,
  getBackgroundColorsForColorScheme,
  getPrimaryPaletteForColorScheme,
  type ColorScheme,
} from "../design-system/tokens";
import { useTheme } from "./useTheme";

export interface ThemeColors {
  // Backgrounds (adapted to color scheme)
  screenBg: string;
  cardBg: string;
  subtleBg: string;
  inputBg: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;

  // Borders (with primary color tint)
  borderDefault: string;
  borderSubtle: string;

  // Status backgrounds
  statusPendingBg: string;
  statusProcessingBg: string;
  statusReadyBg: string;
  statusFailedBg: string;

  // Analysis section
  analysisBg: string;
  analysisBorder: string;
  analysisContentBg: string;

  // Metadata section
  metadataBg: string;
  metadataBorder: string;
  metadataContentBg: string;

  // Actions section
  actionsBg: string;
  actionsBorder: string;
  actionsContentBg: string;
  actionsTitle: string;
  actionButtonBg: string;
  actionButtonDisabledBg: string;

  // Action items
  actionItemBg: string;
  actionItemBorder: string;
  actionItemTagBg: string;

  // Reprocess section
  reprocessBg: string;
  reprocessBorder: string;
  reprocessContentBg: string;
  reprocessTitle: string;
  reprocessText: string;
  reprocessStatusBg: string;
  reprocessStatusBorder: string;
  reprocessStatusLabel: string;
  reprocessStatusValue: string;
  reprocessStatusError: string;
  reprocessButtonTranscribe: string;
  reprocessButtonPostProcess: string;

  // Native debug section
  nativeDebugBg: string;
  nativeDebugBorder: string;
  nativeDebugContentBg: string;
  nativeDebugTitle: string;
  nativeDebugText: string;
  nativeDebugSelectedBg: string;
  nativeDebugSelectedBorder: string;

  // Contact picker
  contactBg: string;
  contactHeaderBg: string;
  contactItemBg: string;
  contactSearchBg: string;
}

export interface UseCaptureThemeReturn {
  themeColors: ThemeColors;
  isDark: boolean;
  colorSchemePreference: ColorScheme;
}

/**
 * Generates theme-aware color palette based on dark mode and color scheme
 */
const getThemeColors = (isDark: boolean, colorScheme: ColorScheme = "blue"): ThemeColors => {
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);

  return {
    // Backgrounds (adapted to color scheme)
    screenBg: backgrounds.screen,
    cardBg: backgrounds.card,
    subtleBg: isDark ? colors.neutral[700] : colors.neutral[50],
    inputBg: backgrounds.card,

    // Text
    textPrimary: isDark ? colors.neutral[50] : colors.neutral[900],
    textSecondary: isDark ? colors.neutral[400] : colors.neutral[500],
    textTertiary: isDark ? colors.neutral[500] : colors.neutral[400],
    textMuted: isDark ? colors.neutral[500] : "#8E8E93",

    // Borders (with primary color tint)
    borderDefault: isDark ? colors.neutral[700] : colors.neutral[200],
    borderSubtle: isDark ? colors.neutral[800] : "#E5E5EA",

    // Status backgrounds
    statusPendingBg: isDark ? colors.warning[900] : "#FFF3E0",
    statusProcessingBg: isDark ? colors.info[900] : "#E3F2FD",
    statusReadyBg: isDark ? colors.success[900] : "#E8F5E9",
    statusFailedBg: isDark ? colors.error[900] : "#FFEBEE",

    // Analysis section
    analysisBg: isDark ? "#2A1B35" : "#F3E5F5",
    analysisBorder: isDark ? "#6A4C7D" : "#CE93D8",
    analysisContentBg: isDark ? colors.neutral[800] : "#FAFAFA",

    // Metadata section
    metadataBg: isDark ? colors.neutral[800] : "#F5F5F5",
    metadataBorder: isDark ? colors.neutral[700] : "#E0E0E0",
    metadataContentBg: isDark ? colors.neutral[850] : "#FAFAFA",

    // Actions section
    actionsBg: isDark ? "#1A2F3F" : "#E3F2FD",
    actionsBorder: isDark ? "#2C5F7C" : "#90CAF9",
    actionsContentBg: isDark ? colors.neutral[800] : "#FAFAFA",
    actionsTitle: isDark ? colors.info[300] : colors.info[700],
    actionButtonBg: isDark ? colors.info[700] : colors.info[500],
    actionButtonDisabledBg: isDark ? colors.neutral[700] : colors.neutral[300],

    // Action items
    actionItemBg: isDark ? colors.neutral[800] : "#FAFAFA",
    actionItemBorder: isDark ? colors.neutral[700] : "#E0E0E0",
    actionItemTagBg: isDark ? "#2A1B35" : "#F3E5F5",

    // Reprocess section
    reprocessBg: isDark ? colors.warning[900] : "#FFF3E0",
    reprocessBorder: isDark ? colors.warning[700] : "#FFE0B2",
    reprocessContentBg: isDark ? colors.warning[800] : "#FFF8E1",
    reprocessTitle: isDark ? colors.warning[300] : "#E65100",
    reprocessText: isDark ? colors.neutral[300] : "#666",
    reprocessStatusBg: isDark ? colors.neutral[800] : "#FFFFFF",
    reprocessStatusBorder: isDark ? colors.neutral[700] : "#E0E0E0",
    reprocessStatusLabel: isDark ? colors.neutral[100] : "#333",
    reprocessStatusValue: isDark ? colors.neutral[400] : "#666",
    reprocessStatusError: isDark ? colors.error[400] : "#EF4444",
    reprocessButtonTranscribe: isDark ? "#1565C0" : "#2196F3",
    reprocessButtonPostProcess: isDark ? "#6A1B9A" : "#9C27B0",

    // Native debug section (blue theme, distinct from orange reprocess)
    nativeDebugBg: isDark ? "#1A2635" : "#E8F0FE",
    nativeDebugBorder: isDark ? "#2C4F6E" : "#90B8E0",
    nativeDebugContentBg: isDark ? colors.neutral[800] : "#F5F9FF",
    nativeDebugTitle: isDark ? colors.info[300] : "#1565C0",
    nativeDebugText: isDark ? colors.neutral[300] : "#555",
    nativeDebugSelectedBg: isDark ? "#1A3528" : "#E8F5E9",
    nativeDebugSelectedBorder: isDark ? colors.success[600] : colors.success[400],

    // Contact picker
    contactBg: isDark ? colors.neutral[900] : "#F2F2F7",
    contactHeaderBg: isDark ? colors.neutral[800] : colors.neutral[0],
    contactItemBg: isDark ? colors.neutral[800] : colors.neutral[0],
    contactSearchBg: isDark ? colors.neutral[700] : "#F2F2F7",
  };
};

/**
 * Hook that provides theme-aware colors for CaptureDetailScreen
 *
 * @returns Theme colors, dark mode flag, and color scheme preference
 *
 * @example
 * ```tsx
 * const { themeColors, isDark, colorSchemePreference } = useCaptureTheme();
 *
 * <View style={{ backgroundColor: themeColors.cardBg }}>
 *   <Text style={{ color: themeColors.textPrimary }}>Hello</Text>
 * </View>
 * ```
 */
export function useCaptureTheme(): UseCaptureThemeReturn {
  const { isDark, colorSchemePreference } = useTheme();
  const themeColors = getThemeColors(isDark, colorSchemePreference);

  return {
    themeColors,
    isDark,
    colorSchemePreference,
  };
}
