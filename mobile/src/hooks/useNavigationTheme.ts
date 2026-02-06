/**
 * Navigation Theme Hooks
 *
 * Centralized hooks for navigation theming that adapt to color scheme preferences.
 * These hooks combine the current theme state (dark/light) with the color scheme
 * preference (blue/green/monochrome) to generate the appropriate navigation styles.
 */

import { useMemo } from 'react';
import { useTheme } from './useTheme';
import {
  getNavigationTheme,
  getTabBarStyle,
  getTabHeaderOptions,
  getStackScreenOptions,
} from '../navigation/theme';

/**
 * Get navigation theme based on current theme and color scheme
 *
 * Usage in App.tsx NavigationContainer:
 * ```tsx
 * const navigationTheme = useNavigationTheme();
 * <NavigationContainer theme={navigationTheme}>
 * ```
 */
export function useNavigationTheme() {
  const { isDark, colorSchemePreference } = useTheme();

  return useMemo(
    () => getNavigationTheme(isDark, colorSchemePreference),
    [isDark, colorSchemePreference]
  );
}

/**
 * Get tab bar style based on current theme and color scheme
 *
 * Usage in MainNavigator:
 * ```tsx
 * const tabBarStyle = useTabBarStyle();
 * <Tab.Navigator screenOptions={{
 *   tabBarActiveTintColor: tabBarStyle.activeTintColor,
 *   ...
 * }}>
 * ```
 */
export function useTabBarStyle() {
  const { isDark, colorSchemePreference } = useTheme();

  return useMemo(
    () => getTabBarStyle(isDark, colorSchemePreference),
    [isDark, colorSchemePreference]
  );
}

/**
 * Get tab header options based on current theme and color scheme
 *
 * Usage in MainNavigator:
 * ```tsx
 * const tabHeaderOptions = useTabHeaderOptions();
 * <Tab.Navigator screenOptions={{
 *   ...tabHeaderOptions,
 *   headerShown: true,
 * }}>
 * ```
 */
export function useTabHeaderOptions() {
  const { isDark, colorSchemePreference } = useTheme();

  return useMemo(
    () => getTabHeaderOptions(isDark, colorSchemePreference),
    [isDark, colorSchemePreference]
  );
}

/**
 * Get stack screen options based on current theme and color scheme
 *
 * Usage in Stack Navigators:
 * ```tsx
 * const stackScreenOptions = useStackScreenOptions();
 * <Stack.Navigator screenOptions={{
 *   ...stackScreenOptions,
 *   headerBackTitle: t('common.back'),
 * }}>
 * ```
 */
export function useStackScreenOptions() {
  const { isDark, colorSchemePreference } = useTheme();

  return useMemo(
    () => getStackScreenOptions(isDark, colorSchemePreference),
    [isDark, colorSchemePreference]
  );
}
