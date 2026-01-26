const { colors, spacing, typography, borderRadius } = require('./src/design-system/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  // Required for manual color scheme control via colorScheme.set()
  // Without this, you get: "Cannot manually set color scheme, as dark mode is type 'media'"
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    // Override defaults avec nos tokens
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      // Static palette (for cases where you need specific shades)
      primary: colors.primary,
      secondary: colors.secondary,
      neutral: colors.neutral,
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,

      // Static shortcuts
      white: colors.neutral[0],
      black: colors.neutral[1000],

      // ============================================
      // SEMANTIC COLORS (Theme-aware via CSS variables)
      // These automatically change based on light/dark theme
      // ============================================

      // Backgrounds
      'bg-screen': 'rgb(var(--color-bg-screen) / <alpha-value>)',
      'bg-card': 'rgb(var(--color-bg-card) / <alpha-value>)',
      'bg-elevated': 'rgb(var(--color-bg-elevated) / <alpha-value>)',
      'bg-input': 'rgb(var(--color-bg-input) / <alpha-value>)',
      'bg-subtle': 'rgb(var(--color-bg-subtle) / <alpha-value>)',
      'bg-inverse': 'rgb(var(--color-bg-inverse) / <alpha-value>)',

      // Text
      'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
      'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
      'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
      'text-inverse': 'rgb(var(--color-text-inverse) / <alpha-value>)',
      'text-link': 'rgb(var(--color-text-link) / <alpha-value>)',

      // Borders
      'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
      'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
      'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',

      // Primary (theme-aware)
      'primary-action': 'rgb(var(--color-primary) / <alpha-value>)',
      'primary-hover': 'rgb(var(--color-primary-hover) / <alpha-value>)',
      'primary-subtle': 'rgb(var(--color-primary-subtle) / <alpha-value>)',
      'primary-text': 'rgb(var(--color-primary-text) / <alpha-value>)',

      // Secondary (theme-aware)
      'secondary-action': 'rgb(var(--color-secondary) / <alpha-value>)',
      'secondary-subtle': 'rgb(var(--color-secondary-subtle) / <alpha-value>)',

      // Status - Success (theme-aware)
      'status-success': 'rgb(var(--color-success) / <alpha-value>)',
      'status-success-bg': 'rgb(var(--color-success-bg) / <alpha-value>)',
      'status-success-text': 'rgb(var(--color-success-text) / <alpha-value>)',
      'status-success-border': 'rgb(var(--color-success-border) / <alpha-value>)',

      // Status - Warning (theme-aware)
      'status-warning': 'rgb(var(--color-warning) / <alpha-value>)',
      'status-warning-bg': 'rgb(var(--color-warning-bg) / <alpha-value>)',
      'status-warning-text': 'rgb(var(--color-warning-text) / <alpha-value>)',
      'status-warning-border': 'rgb(var(--color-warning-border) / <alpha-value>)',

      // Status - Error (theme-aware)
      'status-error': 'rgb(var(--color-error) / <alpha-value>)',
      'status-error-bg': 'rgb(var(--color-error-bg) / <alpha-value>)',
      'status-error-text': 'rgb(var(--color-error-text) / <alpha-value>)',
      'status-error-border': 'rgb(var(--color-error-border) / <alpha-value>)',

      // Status - Info (theme-aware)
      'status-info': 'rgb(var(--color-info) / <alpha-value>)',
      'status-info-bg': 'rgb(var(--color-info-bg) / <alpha-value>)',
      'status-info-text': 'rgb(var(--color-info-text) / <alpha-value>)',
      'status-info-border': 'rgb(var(--color-info-border) / <alpha-value>)',

      // Icons (theme-aware)
      'icon-default': 'rgb(var(--color-icon-default) / <alpha-value>)',
      'icon-subtle': 'rgb(var(--color-icon-subtle) / <alpha-value>)',
      'icon-primary': 'rgb(var(--color-icon-primary) / <alpha-value>)',
    },

    spacing: Object.fromEntries(
      Object.entries(spacing).map(([key, value]) => [key, `${value}px`])
    ),

    fontSize: Object.fromEntries(
      Object.entries(typography.fontSize).map(([key, value]) => [key, `${value}px`])
    ),

    fontWeight: typography.fontWeight,

    borderRadius: Object.fromEntries(
      Object.entries(borderRadius).map(([key, value]) => [key, `${value}px`])
    ),

    extend: {
      fontFamily: {
        sans: [typography.fontFamily.sans],
        mono: [typography.fontFamily.mono],
      },
    },
  },
  plugins: [],
};
