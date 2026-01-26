/**
 * useTheme Hook
 *
 * Utility hook for accessing and modifying the theme.
 * Wraps the ThemeContext for convenience.
 */

import { useThemeContext } from '../contexts/theme/ThemeProvider';

export function useTheme() {
  return useThemeContext();
}
