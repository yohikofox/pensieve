/**
 * Screen layout configuration
 *
 * Extracted from registry.ts to break the circular dependency:
 * registry.ts → NewsScreen → useLayoutConfig → registry.ts
 *
 * useLayoutConfig only needs layout data (useSafeArea, noPadding),
 * not the component references that create the cycle.
 */

export interface LayoutConfig {
  /** Use SafeAreaView wrapper (default: auto-detect from headerShown) */
  useSafeArea?: boolean;
  /** Disable default padding (default: true) */
  noPadding?: boolean;
}

export const tabScreensLayout = {
  News:     { useSafeArea: false },
  Captures: { useSafeArea: false },
  Capture:  { useSafeArea: false },
  Actions:  { useSafeArea: false },
  Projects: { useSafeArea: false },
  Settings: { useSafeArea: false },
} as const satisfies Record<string, LayoutConfig>;

export type TabScreenName = keyof typeof tabScreensLayout;
