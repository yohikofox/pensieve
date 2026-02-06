/**
 * ThemeProvider - Provides theme context for the entire app
 *
 * Uses CSS variables (via NativeWind's vars()) to control theme colors.
 * The theme vars are applied to a wrapper View, making all children
 * automatically use the correct theme colors.
 */

import React, { createContext, useContext, useEffect, type ReactNode } from 'react';
import { View, useColorScheme as useDeviceColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';
import { useSettingsStore, type ThemePreference } from '../../stores/settingsStore';
import { getThemeVars } from '../../design-system/theme';
import type { ColorScheme } from '../../design-system/tokens';

// Theme context type
interface ThemeContextType {
  /** Current active brightness mode ('light' | 'dark') */
  colorScheme: 'light' | 'dark';
  /** User's theme preference ('light' | 'dark' | 'system') */
  themePreference: ThemePreference;
  /** User's color scheme preference ('blue' | 'green' | 'monochrome') */
  colorSchemePreference: ColorScheme;
  /** Set the theme preference */
  setTheme: (preference: ThemePreference) => void;
  /** Set the color scheme preference */
  setColorScheme: (scheme: ColorScheme) => void;
  /** Convenience boolean for dark mode checks */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const deviceColorScheme = useDeviceColorScheme();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const colorSchemePreference = useSettingsStore((state) => state.colorScheme);
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);
  const setColorSchemePreference = useSettingsStore((state) => state.setColorScheme);

  // Calculate effective theme
  const effectiveTheme: 'light' | 'dark' =
    themePreference === 'system'
      ? (deviceColorScheme ?? 'light')
      : themePreference;

  // Also sync with NativeWind's colorScheme for dark: classes (if any still exist)
  useEffect(() => {
    console.log('[ThemeProvider] Theme changed to:', effectiveTheme, '(preference:', themePreference, ', colorScheme:', colorSchemePreference, ', device:', deviceColorScheme, ')');
    nwColorScheme.set(effectiveTheme);
  }, [effectiveTheme, themePreference, colorSchemePreference, deviceColorScheme]);

  const setTheme = (preference: ThemePreference) => {
    console.log('[ThemeProvider] setTheme:', preference);
    setThemePreference(preference);
  };

  const setColorScheme = (scheme: ColorScheme) => {
    console.log('[ThemeProvider] setColorScheme:', scheme);
    setColorSchemePreference(scheme);
  };

  const contextValue: ThemeContextType = {
    colorScheme: effectiveTheme,
    themePreference,
    colorSchemePreference,
    setTheme,
    setColorScheme,
    isDark: effectiveTheme === 'dark',
  };

  // Apply theme CSS variables via View wrapper
  // This is the key mechanism that makes theme-aware colors work
  const themeVars = getThemeVars(effectiveTheme, colorSchemePreference);

  return (
    <ThemeContext.Provider value={contextValue}>
      <View style={[{ flex: 1 }, themeVars]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/**
 * useThemeContext - Access theme context
 *
 * Must be used within a ThemeProvider.
 */
export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
