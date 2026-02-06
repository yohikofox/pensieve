/**
 * withCaptureTheme HOC
 *
 * Higher-Order Component that automatically injects theme data into components.
 * This eliminates the need to pass themeColors and isDark as props.
 *
 * Usage:
 * ```tsx
 * // Before (manual theme injection):
 * export function MyComponent({ themeColors, isDark, ...props }: MyComponentProps) {
 *   // use themeColors and isDark
 * }
 *
 * // After (automatic theme injection):
 * function MyComponentBase({ theme, ...props }: MyComponentBaseProps) {
 *   // use theme.colors and theme.isDark
 * }
 * export const MyComponent = withCaptureTheme(MyComponentBase);
 * ```
 *
 * Story 5.4 - Theme Pattern Standardization
 */

import React from "react";
import { useCaptureTheme, type ThemeColors } from "../hooks/useCaptureTheme";

export interface CaptureTheme {
  colors: ThemeColors;
  isDark: boolean;
}

export interface WithCaptureThemeProps {
  theme: CaptureTheme;
}

/**
 * HOC that wraps a component and injects theme automatically
 */
export function withCaptureTheme<P extends WithCaptureThemeProps>(
  Component: React.ComponentType<P>
) {
  const WithTheme = (props: Omit<P, keyof WithCaptureThemeProps>) => {
    const { themeColors, isDark } = useCaptureTheme();

    const theme: CaptureTheme = {
      colors: themeColors,
      isDark,
    };

    return <Component {...(props as P)} theme={theme} />;
  };

  WithTheme.displayName = `withCaptureTheme(${Component.displayName || Component.name || "Component"})`;

  return WithTheme;
}

/**
 * Alternative: Render Props Pattern
 *
 * For cases where HOC is not suitable, use this component:
 *
 * ```tsx
 * <CaptureThemeProvider>
 *   {(theme) => (
 *     <MyComponent theme={theme} />
 *   )}
 * </CaptureThemeProvider>
 * ```
 */
export function CaptureThemeProvider({
  children,
}: {
  children: (theme: CaptureTheme) => React.ReactNode;
}) {
  const { themeColors, isDark } = useCaptureTheme();

  const theme: CaptureTheme = {
    colors: themeColors,
    isDark,
  };

  return <>{children(theme)}</>;
}

/**
 * Hook version for direct access (current approach)
 *
 * Use this when you need more control:
 *
 * ```tsx
 * export function MyComponent(props: MyComponentProps) {
 *   const theme = useCaptureThemeData();
 *   // use theme.colors and theme.isDark
 * }
 * ```
 */
export function useCaptureThemeData(): CaptureTheme {
  const { themeColors, isDark } = useCaptureTheme();

  return {
    colors: themeColors,
    isDark,
  };
}
