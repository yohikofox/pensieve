/**
 * Navigation Theme Configuration
 *
 * Centralized theme configuration for React Navigation
 * based on the design system tokens
 */

import { DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';
import { colors, typography } from '../design-system/tokens';

/**
 * Light theme based on design system
 */
export const lightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary[500],
    background: colors.neutral[100],
    card: colors.neutral[0],
    text: colors.neutral[900],
    border: colors.neutral[200],
    notification: colors.error[500],
  },
};

/**
 * Dark theme based on design system
 */
export const darkNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary[400],
    background: colors.neutral[900],
    card: colors.neutral[800],
    text: colors.neutral[50],
    border: colors.neutral[700],
    notification: colors.error[400],
  },
};

/**
 * @deprecated Use lightNavigationTheme instead
 */
export const navigationTheme = lightNavigationTheme;

/**
 * Tab bar style configuration (Light theme)
 */
export const lightTabBarStyle = {
  activeTintColor: colors.primary[500],
  inactiveTintColor: colors.neutral[400],
  style: {
    backgroundColor: colors.neutral[0],
    borderTopColor: colors.neutral[200],
    borderTopWidth: 1,
  },
  labelStyle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
};

/**
 * Tab bar style configuration (Dark theme)
 */
export const darkTabBarStyle = {
  activeTintColor: colors.primary[400],
  inactiveTintColor: colors.neutral[500],
  style: {
    backgroundColor: colors.neutral[800],
    borderTopColor: colors.neutral[700],
    borderTopWidth: 1,
  },
  labelStyle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
  },
};

/**
 * @deprecated Use lightTabBarStyle instead
 */
export const tabBarStyle = lightTabBarStyle;

/**
 * Stack navigator screen options (Light theme)
 */
export const lightStackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.neutral[0],
  },
  headerTintColor: colors.primary[500],
  headerTitleStyle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.neutral[900],
  },
  headerShadowVisible: false,
  headerBackTitleStyle: {
    fontSize: typography.fontSize.base,
  },
  contentStyle: {
    backgroundColor: colors.neutral[100],
  },
};

/**
 * Stack navigator screen options (Dark theme)
 */
export const darkStackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.neutral[800],
  },
  headerTintColor: colors.primary[400],
  headerTitleStyle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as '600',
    color: colors.neutral[50],
  },
  headerShadowVisible: false,
  headerBackTitleStyle: {
    fontSize: typography.fontSize.base,
  },
  contentStyle: {
    backgroundColor: colors.neutral[900],
  },
};

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
