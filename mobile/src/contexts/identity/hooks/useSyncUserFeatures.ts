/**
 * useSyncUserFeatures Hook
 * Story 24.3: Feature Flag System — Adaptation Mobile & UI Gating
 *
 * Syncs user features from backend to SettingsStore.
 * Uses setFeatures() to store the full Record<string, boolean>.
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
 * Hook to automatically sync user features from backend to SettingsStore.
 * Stores the full Record<string, boolean> via setFeatures().
 * Runs at app startup and whenever user features change.
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
  const setFeatures = useSettingsStore((state) => state.setFeatures);

  // Sync features to SettingsStore when they change
  useEffect(() => {
    if (isSuccess && features) {
      setFeatures(features);
    }
  }, [isSuccess, features, setFeatures]);

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
