/**
 * Navigation Theme Configuration
 *
 * Centralized theme configuration for React Navigation
 * based on the design system tokens
 */

import { DefaultTheme, type Theme } from '@react-navigation/native';
import { colors, typography } from '../design-system/tokens';

/**
 * Light theme based on design system
 */
export const navigationTheme: Theme = {
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
 * Tab bar style configuration
 */
export const tabBarStyle = {
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
 * Stack navigator screen options
 */
export const stackScreenOptions = {
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
 * Tab icon sizes
 */
export const tabIconSize = {
  default: 24,
  focused: 26,
};
