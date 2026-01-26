/**
 * useThemeInit Hook
 *
 * Synchronizes the theme preference from the settings store with NativeWind's colorScheme.
 * Should be called once at app startup (in App.tsx).
 *
 * Handles three modes:
 * - 'light': Always use light theme
 * - 'dark': Always use dark theme
 * - 'system': Follow the device's color scheme preference
 */

import { useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';
import { useSettingsStore } from '../stores/settingsStore';

export function useThemeInit() {
  const themePreference = useSettingsStore((state) => state.themePreference);
  const systemColorScheme = useSystemColorScheme();

  useEffect(() => {
    const targetScheme = themePreference === 'system'
      ? (systemColorScheme ?? 'light')
      : themePreference;

    console.log('[useThemeInit] Setting colorScheme via nwColorScheme.set():', targetScheme, '(preference:', themePreference, ', system:', systemColorScheme, ')');
    nwColorScheme.set(targetScheme);
  }, [themePreference, systemColorScheme]);
}
