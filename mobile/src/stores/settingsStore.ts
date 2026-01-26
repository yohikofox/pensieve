/**
 * Zustand Store for Application Settings
 *
 * Centralized store for user preferences and feature flags.
 * Settings are persisted to AsyncStorage.
 *
 * Usage:
 * - useSettingsStore() in components for reactive state
 * - useSettingsStore.getState() outside React for imperative access
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Theme preference type
export type ThemePreference = 'light' | 'dark' | 'system';

// Debug button position (anchored to edge)
export interface DebugButtonPosition {
  edge: 'left' | 'right';
  verticalPercent: number; // 0-1, percentage from top
}

interface SettingsState {
  // Theme preference - 'light', 'dark', or 'system' (follows OS)
  themePreference: ThemePreference;

  // Debug mode - enables all debug features (WAV player, etc.)
  // Can be enabled by user permissions in production
  debugMode: boolean;

  // Debug button position (draggable, anchored to edge)
  debugButtonPosition: DebugButtonPosition;

  // Actions
  setThemePreference: (preference: ThemePreference) => void;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
  setDebugButtonPosition: (position: DebugButtonPosition) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - system theme by default
        themePreference: 'system' as ThemePreference,

        // Initial state - debug mode off by default
        debugMode: false,

        // Default button position: bottom right
        debugButtonPosition: {
          edge: 'right',
          verticalPercent: 0.85, // Near bottom
        },

        // Actions
        setThemePreference: (preference: ThemePreference) => {
          set({ themePreference: preference });
          console.log('[SettingsStore] Theme preference:', preference);
        },

        setDebugMode: (enabled: boolean) => {
          set({ debugMode: enabled });
          console.log('[SettingsStore] Debug mode:', enabled ? 'ON' : 'OFF');
        },

        toggleDebugMode: () => {
          const current = get().debugMode;
          set({ debugMode: !current });
          console.log('[SettingsStore] Debug mode toggled:', !current ? 'ON' : 'OFF');
        },

        setDebugButtonPosition: (position: DebugButtonPosition) => {
          set({ debugButtonPosition: position });
        },
      }),
      {
        name: 'pensieve-settings',
        storage: createJSONStorage(() => AsyncStorage),
      }
    ),
    {
      name: 'settings-store',
    }
  )
);

/**
 * Helper to check if debug mode is enabled
 * Can be used outside React components
 */
export function isDebugModeEnabled(): boolean {
  return useSettingsStore.getState().debugMode;
}
