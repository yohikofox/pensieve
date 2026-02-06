/**
 * useLayoutConfig - Access layout configuration from screen registry
 *
 * Retrieves the layout configuration for the current screen from the registry.
 * This allows screens to apply StandardLayout with the correct safe area settings.
 *
 * Usage in a screen component:
 * ```tsx
 * const layoutConfig = useLayoutConfig('News');
 * return (
 *   <StandardLayout {...layoutConfig}>
 *     // content
 *   </StandardLayout>
 * );
 * ```
 */

import { useMemo } from 'react';
import { tabScreens, type TabScreenName } from '../screens/registry';
import type { LayoutConfig } from '../screens/registry';

/**
 * Get layout configuration for a specific screen
 *
 * @param screenName - Name of the screen from registry
 * @returns Layout configuration object or default values
 */
export function useLayoutConfig(screenName: TabScreenName): LayoutConfig {
  return useMemo(() => {
    const screenConfig = tabScreens[screenName];

    // Return screen's layout config or sensible defaults
    return {
      useSafeArea: screenConfig.layout?.useSafeArea ?? false,
      noPadding: screenConfig.layout?.noPadding ?? true,
    };
  }, [screenName]);
}
