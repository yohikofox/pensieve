/**
 * Theme Definitions - CSS Variables for Light/Dark modes
 *
 * This file defines the CSS variables that change based on theme.
 * Used with NativeWind's vars() to dynamically switch themes.
 */

import { vars } from 'nativewind';
import { colors } from './tokens';

/**
 * Convert hex color to RGB values string (for CSS variables)
 * Example: '#3B82F6' -> '59 130 246'
 */
function hexToRgbValues(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0 0';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

/**
 * Semantic color tokens that change based on theme
 * These are the CSS variable names used in tailwind.config.js
 */
export const lightTheme = vars({
  // Backgrounds
  '--color-bg-screen': hexToRgbValues(colors.neutral[100]),
  '--color-bg-card': hexToRgbValues(colors.neutral[0]),
  '--color-bg-elevated': hexToRgbValues(colors.neutral[0]),
  '--color-bg-input': hexToRgbValues(colors.neutral[0]),
  '--color-bg-subtle': hexToRgbValues(colors.neutral[50]),
  '--color-bg-inverse': hexToRgbValues(colors.neutral[900]),

  // Text
  '--color-text-primary': hexToRgbValues(colors.neutral[900]),
  '--color-text-secondary': hexToRgbValues(colors.neutral[500]),
  '--color-text-tertiary': hexToRgbValues(colors.neutral[400]),
  '--color-text-inverse': hexToRgbValues(colors.neutral[0]),
  '--color-text-link': hexToRgbValues(colors.primary[500]),

  // Borders
  '--color-border-default': hexToRgbValues(colors.neutral[200]),
  '--color-border-subtle': hexToRgbValues(colors.neutral[100]),
  '--color-border-strong': hexToRgbValues(colors.neutral[300]),

  // Primary action colors
  '--color-primary': hexToRgbValues(colors.primary[500]),
  '--color-primary-hover': hexToRgbValues(colors.primary[600]),
  '--color-primary-subtle': hexToRgbValues(colors.primary[100]),
  '--color-primary-text': hexToRgbValues(colors.primary[500]),

  // Secondary colors
  '--color-secondary': hexToRgbValues(colors.secondary[500]),
  '--color-secondary-subtle': hexToRgbValues(colors.secondary[100]),

  // Status colors - Success
  '--color-success': hexToRgbValues(colors.success[500]),
  '--color-success-bg': hexToRgbValues(colors.success[50]),
  '--color-success-text': hexToRgbValues(colors.success[700]),
  '--color-success-border': hexToRgbValues(colors.success[200]),

  // Status colors - Warning
  '--color-warning': hexToRgbValues(colors.warning[500]),
  '--color-warning-bg': hexToRgbValues(colors.warning[50]),
  '--color-warning-text': hexToRgbValues(colors.warning[700]),
  '--color-warning-border': hexToRgbValues(colors.warning[200]),

  // Status colors - Error
  '--color-error': hexToRgbValues(colors.error[500]),
  '--color-error-bg': hexToRgbValues(colors.error[50]),
  '--color-error-text': hexToRgbValues(colors.error[700]),
  '--color-error-border': hexToRgbValues(colors.error[200]),

  // Status colors - Info
  '--color-info': hexToRgbValues(colors.info[500]),
  '--color-info-bg': hexToRgbValues(colors.info[50]),
  '--color-info-text': hexToRgbValues(colors.info[700]),
  '--color-info-border': hexToRgbValues(colors.info[200]),

  // Icon colors
  '--color-icon-default': hexToRgbValues(colors.neutral[500]),
  '--color-icon-subtle': hexToRgbValues(colors.neutral[400]),
  '--color-icon-primary': hexToRgbValues(colors.primary[500]),
});

export const darkTheme = vars({
  // Backgrounds
  '--color-bg-screen': hexToRgbValues(colors.neutral[900]),
  '--color-bg-card': hexToRgbValues(colors.neutral[800]),
  '--color-bg-elevated': hexToRgbValues(colors.neutral[800]),
  '--color-bg-input': hexToRgbValues(colors.neutral[800]),
  '--color-bg-subtle': hexToRgbValues(colors.neutral[700]),
  '--color-bg-inverse': hexToRgbValues(colors.neutral[100]),

  // Text
  '--color-text-primary': hexToRgbValues(colors.neutral[50]),
  '--color-text-secondary': hexToRgbValues(colors.neutral[400]),
  '--color-text-tertiary': hexToRgbValues(colors.neutral[500]),
  '--color-text-inverse': hexToRgbValues(colors.neutral[900]),
  '--color-text-link': hexToRgbValues(colors.primary[400]),

  // Borders
  '--color-border-default': hexToRgbValues(colors.neutral[700]),
  '--color-border-subtle': hexToRgbValues(colors.neutral[800]),
  '--color-border-strong': hexToRgbValues(colors.neutral[600]),

  // Primary action colors
  '--color-primary': hexToRgbValues(colors.primary[500]),
  '--color-primary-hover': hexToRgbValues(colors.primary[400]),
  '--color-primary-subtle': hexToRgbValues(colors.primary[900]),
  '--color-primary-text': hexToRgbValues(colors.primary[400]),

  // Secondary colors
  '--color-secondary': hexToRgbValues(colors.secondary[500]),
  '--color-secondary-subtle': hexToRgbValues(colors.secondary[900]),

  // Status colors - Success
  '--color-success': hexToRgbValues(colors.success[500]),
  '--color-success-bg': hexToRgbValues(colors.success[900]),
  '--color-success-text': hexToRgbValues(colors.success[300]),
  '--color-success-border': hexToRgbValues(colors.success[700]),

  // Status colors - Warning
  '--color-warning': hexToRgbValues(colors.warning[500]),
  '--color-warning-bg': hexToRgbValues(colors.warning[900]),
  '--color-warning-text': hexToRgbValues(colors.warning[300]),
  '--color-warning-border': hexToRgbValues(colors.warning[700]),

  // Status colors - Error
  '--color-error': hexToRgbValues(colors.error[500]),
  '--color-error-bg': hexToRgbValues(colors.error[900]),
  '--color-error-text': hexToRgbValues(colors.error[300]),
  '--color-error-border': hexToRgbValues(colors.error[700]),

  // Status colors - Info
  '--color-info': hexToRgbValues(colors.info[500]),
  '--color-info-bg': hexToRgbValues(colors.info[900]),
  '--color-info-text': hexToRgbValues(colors.info[300]),
  '--color-info-border': hexToRgbValues(colors.info[700]),

  // Icon colors
  '--color-icon-default': hexToRgbValues(colors.neutral[400]),
  '--color-icon-subtle': hexToRgbValues(colors.neutral[500]),
  '--color-icon-primary': hexToRgbValues(colors.primary[400]),
});

/**
 * Get theme vars based on color scheme
 */
export function getThemeVars(colorScheme: 'light' | 'dark') {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
