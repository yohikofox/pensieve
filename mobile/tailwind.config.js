const { colors, spacing, typography, borderRadius } = require('./src/design-system/tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    // Override defaults avec nos tokens
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      // Palette
      primary: colors.primary,
      secondary: colors.secondary,
      neutral: colors.neutral,
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,

      // Raccourcis sémantiques
      white: colors.neutral[0],
      black: colors.neutral[1000],
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
