/**
 * Navigation Theme Configuration
 *
 * Centralized theme configuration for React Navigation
 * based on the design system tokens
 */

import { DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';
import {
  colors,
  typography,
  getPrimaryPaletteForColorScheme,
  getBackgroundColorsForColorScheme,
  type ColorScheme,
} from '../design-system/tokens';

/**
 * Get navigation theme based on color scheme
 */
export function getNavigationTheme(isDark: boolean, colorScheme: ColorScheme = 'blue'): Theme {
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
export const lightNavigationTheme: Theme = getNavigationTheme(false, 'blue');

/**
 * Dark theme based on design system (default blue)
 */
export const darkNavigationTheme: Theme = getNavigationTheme(true, 'blue');

/**
 * @deprecated Use lightNavigationTheme instead
 */
export const navigationTheme = lightNavigationTheme;

/**
 * Get tab bar style configuration based on color scheme
 */
export function getTabBarStyle(isDark: boolean, colorScheme: ColorScheme = 'blue') {
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
      fontWeight: typography.fontWeight.medium as '500',
    },
  };
}

/**
 * Tab bar style configuration (Light theme - default blue)
 */
export const lightTabBarStyle = getTabBarStyle(false, 'blue');

/**
 * Tab bar style configuration (Dark theme - default blue)
 */
export const darkTabBarStyle = getTabBarStyle(true, 'blue');

/**
 * @deprecated Use lightTabBarStyle instead
 */
export const tabBarStyle = lightTabBarStyle;

/**
 * Get stack navigator screen options based on color scheme
 */
export function getStackScreenOptions(isDark: boolean, colorScheme: ColorScheme = 'blue') {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return {
    headerStyle: {
      backgroundColor: backgrounds.card,
      // Custom shadow for better visual separation
      shadowColor: isDark ? '#fff' : '#000',
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: isDark ? 0.3 : 0.2,
      shadowRadius: 12,
      elevation: 16, // Android
      // Add bottom border as fallback for better separation
      borderBottomWidth: isDark ? 3 : 0,
      borderBottomColor: isDark ? '#FF0000' : 'transparent',
    },
    headerTintColor: primaryPalette[isDark ? 400 : 500],
    headerTitleStyle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold as '600',
      color: isDark ? colors.neutral[50] : colors.neutral[900],
    },
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
export const lightStackScreenOptions = getStackScreenOptions(false, 'blue');

/**
 * Stack navigator screen options (Dark theme - default blue)
 */
export const darkStackScreenOptions = getStackScreenOptions(true, 'blue');

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
