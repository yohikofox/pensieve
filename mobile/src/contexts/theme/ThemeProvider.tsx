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
import { lightTheme, darkTheme } from '../../design-system/theme';

// Theme context type
interface ThemeContextType {
  /** Current active color scheme ('light' | 'dark') */
  colorScheme: 'light' | 'dark';
  /** User's preference ('light' | 'dark' | 'system') */
  themePreference: ThemePreference;
  /** Set the theme preference */
  setTheme: (preference: ThemePreference) => void;
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
  const setThemePreference = useSettingsStore((state) => state.setThemePreference);

  // Calculate effective theme
  const effectiveTheme: 'light' | 'dark' =
    themePreference === 'system'
      ? (deviceColorScheme ?? 'light')
      : themePreference;

  // Also sync with NativeWind's colorScheme for dark: classes (if any still exist)
  useEffect(() => {
    console.log('[ThemeProvider] Theme changed to:', effectiveTheme, '(preference:', themePreference, ', device:', deviceColorScheme, ')');
    nwColorScheme.set(effectiveTheme);
  }, [effectiveTheme, themePreference, deviceColorScheme]);

  const setTheme = (preference: ThemePreference) => {
    console.log('[ThemeProvider] setTheme:', preference);
    setThemePreference(preference);
  };

  const contextValue: ThemeContextType = {
    colorScheme: effectiveTheme,
    themePreference,
    setTheme,
    isDark: effectiveTheme === 'dark',
  };

  // Apply theme CSS variables via View wrapper
  // This is the key mechanism that makes theme-aware colors work
  const themeVars = effectiveTheme === 'dark' ? darkTheme : lightTheme;

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
