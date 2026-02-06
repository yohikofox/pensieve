/**
 * Navigation Theme Configuration
 *
 * Centralized theme configuration for React Navigation
 * based on the design system tokens
 */

import { DefaultTheme, DarkTheme, type Theme } from "@react-navigation/native";
import {
  colors,
  typography,
  getPrimaryPaletteForColorScheme,
  getBackgroundColorsForColorScheme,
  type ColorScheme,
} from "../design-system/tokens";

/**
 * Get navigation theme based on color scheme
 */
export function getNavigationTheme(
  isDark: boolean,
  colorScheme: ColorScheme = "blue",
): Theme {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  const baseTheme = isDark ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: primaryPalette[isDark ? 400 : 500],
      background: backgrounds.screen,
      card: backgrounds.card,
      text: isDark ? colors.neutral[50] : colors.neutral[900],
      border: isDark ? colors.neutral[700] : colors.neutral[200],
      notification: colors.error[isDark ? 400 : 500],
    },
  };
}

/**
 * Light theme based on design system (default blue)
 */
export const lightNavigationTheme: Theme = getNavigationTheme(false, "blue");

/**
 * Dark theme based on design system (default blue)
 */
export const darkNavigationTheme: Theme = getNavigationTheme(true, "blue");

/**
 * @deprecated Use lightNavigationTheme instead
 */
export const navigationTheme = lightNavigationTheme;

/**
 * Get tab bar style configuration based on color scheme
 */
export function getTabBarStyle(
  isDark: boolean,
  colorScheme: ColorScheme = "blue",
) {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return {
    activeTintColor: primaryPalette[isDark ? 400 : 500],
    inactiveTintColor: isDark ? colors.neutral[500] : colors.neutral[400],
    style: {
      backgroundColor: backgrounds.card,
      borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
      borderTopWidth: 1,
    },
    labelStyle: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium as "500",
    },
  };
}

/**
 * Tab bar style configuration (Light theme - default blue)
 */
export const lightTabBarStyle = getTabBarStyle(false, "blue");

/**
 * Tab bar style configuration (Dark theme - default blue)
 */
export const darkTabBarStyle = getTabBarStyle(true, "blue");

/**
 * @deprecated Use lightTabBarStyle instead
 */
export const tabBarStyle = lightTabBarStyle;

/**
 * Get base header styles shared between Tab and Stack navigators
 * (colors, typography, tint - without shadow properties)
 */
function getBaseHeaderStyles(
  isDark: boolean,
  colorScheme: ColorScheme = "blue",
) {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return {
    backgroundColor: backgrounds.card,
    headerTintColor: primaryPalette[isDark ? 400 : 500],
    headerTitleStyle: {
      fontSize: 20,
      fontWeight: typography.fontWeight.semibold as "600",
      color: isDark ? colors.neutral[50] : colors.neutral[900],
    },
  };
}

/**
 * Get tab navigator header options based on color scheme
 * Tab Navigator supports CSS shadow properties
 */
export function getTabHeaderOptions(
  isDark: boolean,
  colorScheme: ColorScheme = "blue",
) {
  const baseStyles = getBaseHeaderStyles(isDark, colorScheme);

  return {
    headerStyle: {
      backgroundColor: baseStyles.backgroundColor,
      elevation: 12, // Android
    },
    headerTintColor: baseStyles.headerTintColor,
    headerTitleStyle: {
      ...baseStyles.headerTitleStyle,
      marginLeft: 0,
      marginRight: 0,
    },
    headerTitleAlign: "left" as const,
    headerLeftContainerStyle: {
      paddingLeft: 16,
    },
    headerRightContainerStyle: {
      paddingRight: 16,
    },
    headerShadowVisible: true,
  };
}

/**
 * Get stack navigator screen options based on color scheme
 * Note: These styles are used as fallback when CustomStackHeader is not applied
 */
export function getStackScreenOptions(
  isDark: boolean,
  colorScheme: ColorScheme = "blue",
) {
  const baseStyles = getBaseHeaderStyles(isDark, colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return {
    headerStyle: {
      backgroundColor: baseStyles.backgroundColor,
    },
    headerTintColor: baseStyles.headerTintColor,
    headerTitleStyle: {
      ...baseStyles.headerTitleStyle,
      marginLeft: 0,
      marginRight: 0,
    },
    headerTitleAlign: "left" as const,
    headerShadowVisible: true,
    headerBackTitleStyle: {
      fontSize: typography.fontSize.base,
    },
    contentStyle: {
      backgroundColor: backgrounds.screen,
    },
  };
}

/**
 * Stack navigator screen options (Light theme - default blue)
 */
export const lightStackScreenOptions = getStackScreenOptions(false, "blue");

/**
 * Stack navigator screen options (Dark theme - default blue)
 */
export const darkStackScreenOptions = getStackScreenOptions(true, "blue");

/**
 * @deprecated Use lightStackScreenOptions instead
 */
export const stackScreenOptions = lightStackScreenOptions;

/**
 * Tab icon sizes
 */
export const tabIconSize = {
  default: 24,
  focused: 26,
};
