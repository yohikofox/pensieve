/**
 * useSyncUserFeatures Hook
 * Story 7.1: Support Mode avec Permissions Backend
 *
 * Syncs user features from backend to SettingsStore
 * AC3: Fetch at app startup
 * AC5: Manual refresh
 */

import { useEffect } from "react";
import { AppState } from "react-native";
import { useUserFeatures } from "./useUserFeatures";
import { useSettingsStore } from "@/stores/settingsStore";

interface UseSyncUserFeaturesOptions {
  /**
   * User ID to fetch features for
   * Should come from auth context
   */
  userId: string | null;

  /**
   * Enable automatic sync (default: true)
   */
  enabled?: boolean;
}

/**
 * Hook to automatically sync user features from backend to SettingsStore
 * Runs at app startup and whenever user features change
 *
 * @param options - Hook options with userId
 *
 * @example
 * ```tsx
 * // In App.tsx or MainApp.tsx
 * const { data: user } = useAuth();
 * useSyncUserFeatures({ userId: user?.id });
 * ```
 */
export function useSyncUserFeatures(options: UseSyncUserFeaturesOptions) {
  const { userId, enabled = true } = options;
  const { data: features, isSuccess, refetch } = useUserFeatures({ userId, enabled });
  const setDebugModeAccess = useSettingsStore(
    (state) => state.setDebugModeAccess,
  );
  const setDataMiningEnabled = useSettingsStore(
    (state) => state.setDataMiningEnabled,
  );

  // Sync features to SettingsStore when they change
  useEffect(() => {
    if (isSuccess && features) {
      setDebugModeAccess(features.debug_mode_access);
      setDataMiningEnabled(features.data_mining_access);
    }
  }, [isSuccess, features, setDebugModeAccess, setDataMiningEnabled]);

  // Force-refresh when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && userId) {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch, userId]);
}
