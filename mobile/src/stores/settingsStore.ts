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

import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
// ASYNC_STORAGE_OK: UI preferences only (theme, color scheme, debug mode, haptic, LLM settings) — not critical data (ADR-022)
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  LLMModelId,
  LLMTask,
} from "../contexts/Normalization/services/LLMModelService";
import type { ColorScheme } from "../design-system/tokens";
import { FEATURE_KEYS } from "../contexts/identity/domain/feature-keys";

// Theme preference type
export type ThemePreference = "light" | "dark" | "system";

// Audio player type (Story 3.2b)
export type AudioPlayerType = "waveform" | "simple";

// Debug button position (anchored to edge)
export interface DebugButtonPosition {
  edge: "left" | "right";
  verticalPercent: number; // 0-1, percentage from top
}

// LLM settings (global - consulted throughout the app)
export interface LLMSettings {
  // AI post-processing enabled/disabled
  isEnabled: boolean;

  // Automatic post-processing after transcription
  isAutoPostProcess: boolean;

  // Selected models for each task
  selectedPostProcessingModel: LLMModelId | null;
  selectedAnalysisModel: LLMModelId | null;
}

interface SettingsState {
  // Theme preference - 'light', 'dark', or 'system' (follows OS)
  themePreference: ThemePreference;

  // Color scheme - 'blue' (default), 'green' (nature), or 'monochrome' (grayscale)
  colorScheme: ColorScheme;

  // Audio player type - 'waveform' (default) or 'simple' (Story 3.2b)
  audioPlayerType: AudioPlayerType;

  // Story 24.3: Dynamic feature flags from backend.
  // Replaces individual debugModeAccess / dataMiningEnabled booleans.
  // Volatile: NOT persisted — reset on every app launch and re-fetched via useSyncUserFeatures.
  // ADR-022: Never persist this in AsyncStorage directly.
  features: Record<string, boolean>;

  // Debug mode local toggle - user's preference to enable/disable debug mode.
  // Only effective when getFeature('debug_mode') is true (double gate — AC2).
  debugMode: boolean;

  // Show calibration grid - override to hide grid even when debugMode is on
  // Allows disabling grid independently from other debug features
  showCalibrationGrid: boolean;

  // Debug button position (draggable, anchored to edge)
  debugButtonPosition: DebugButtonPosition;

  // Auto-transcription - automatically transcribe audio captures after recording
  // When disabled, transcription must be triggered manually from capture details
  autoTranscriptionEnabled: boolean;

  // Haptic feedback - enable/disable haptic feedback for UI interactions
  // Story 5.2 Code Review Fix #7: User preference check before haptics
  hapticFeedbackEnabled: boolean;

  // LLM settings - AI post-processing configuration (consulted app-wide)
  llm: LLMSettings;

  // Story 7.3: GitHub Bug Reporting config (stored in settingsStore for non-sensitive fields)
  // Note: GitHub token is stored in expo-secure-store via GitHubIssueService (ADR-022)
  githubRepo: string; // Format: "owner/repo"

  // Actions
  setThemePreference: (preference: ThemePreference) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setAudioPlayerType: (type: AudioPlayerType) => void;
  setGithubRepo: (repo: string) => void;

  // Story 24.3: Set all features at once (replaces setDebugModeAccess / setDataMiningEnabled)
  setFeatures: (features: Record<string, boolean>) => void;

  // Story 24.3: Get a single feature value by key (returns false if absent)
  getFeature: (key: string) => boolean;

  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
  setShowCalibrationGrid: (show: boolean) => void;
  setDebugButtonPosition: (position: DebugButtonPosition) => void;
  setAutoTranscription: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;

  // Story 6.4: Sync only on Wi-Fi
  syncOnWifiOnly: boolean;
  setSyncOnWifiOnly: (enabled: boolean) => void;

  // LLM Actions
  setLLMEnabled: (enabled: boolean) => void;
  setLLMAutoPostProcess: (enabled: boolean) => void;
  setLLMModelForTask: (task: LLMTask, modelId: LLMModelId | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state - system theme by default
        themePreference: "system" as ThemePreference,

        // Initial state - blue color scheme by default
        colorScheme: "blue" as ColorScheme,

        // Initial state - waveform player by default (Story 3.2b)
        audioPlayerType: "waveform" as AudioPlayerType,

        // Story 24.3: features — volatile, starts empty (all getFeature() return false)
        // Not persisted — always re-fetched via useSyncUserFeatures on app launch
        features: {},

        // Initial state - debug mode local toggle off by default
        debugMode: false,

        // Initial state - show calibration grid enabled by default (when debugMode is on)
        showCalibrationGrid: true,

        // Default button position: bottom right
        debugButtonPosition: {
          edge: "right",
          verticalPercent: 0.85, // Near bottom
        },

        // Initial state - auto-transcription disabled by default (manual trigger from capture details)
        autoTranscriptionEnabled: false,

        // Initial state - haptic feedback enabled by default (Story 5.2 Code Review Fix #7)
        hapticFeedbackEnabled: true,

        // Story 7.3: GitHub Bug Reporting — non-sensitive config
        githubRepo: '',

        // Story 6.4: Sync only on Wi-Fi - disabled by default (sync on all connections)
        syncOnWifiOnly: false,

        // Initial LLM state - disabled by default
        llm: {
          isEnabled: false,
          isAutoPostProcess: false,
          selectedPostProcessingModel: null,
          selectedAnalysisModel: null,
        },

        // Actions
        setThemePreference: (preference: ThemePreference) => {
          set({ themePreference: preference });
          console.debug("[SettingsStore] Theme preference:", preference);
        },

        setColorScheme: (scheme: ColorScheme) => {
          set({ colorScheme: scheme });
          console.debug("[SettingsStore] Color scheme:", scheme);
        },

        setAudioPlayerType: (type: AudioPlayerType) => {
          set({ audioPlayerType: type });
          console.debug("[SettingsStore] Audio player type:", type);
        },

        // Story 24.3: Replace all feature flags at once (from backend response)
        setFeatures: (features: Record<string, boolean>) => {
          set({ features });
          console.debug("[SettingsStore] Features updated:", Object.keys(features).length, "keys");
        },

        // Story 24.3: Get a single feature value (returns false if absent — security by default)
        getFeature: (key: string): boolean => {
          return get().features[key] ?? false;
        },

        // AC2: Verify debug_mode feature before activating debug mode (double gate)
        setDebugMode: (enabled: boolean) => {
          const hasDebugAccess = get().features[FEATURE_KEYS.DEBUG_MODE] ?? false;

          // Only allow enabling if backend feature is granted
          if (enabled && !hasDebugAccess) {
            console.warn(
              "[SettingsStore] Debug mode activation blocked: debug_mode feature not granted",
            );
            return;
          }

          set({ debugMode: enabled });
          console.debug("[SettingsStore] Debug mode:", enabled ? "ON" : "OFF");
        },

        toggleDebugMode: () => {
          const { debugMode } = get();
          const hasDebugAccess = get().features[FEATURE_KEYS.DEBUG_MODE] ?? false;

          // Only allow toggling ON if backend feature is granted
          if (!debugMode && !hasDebugAccess) {
            console.warn(
              "[SettingsStore] Debug mode toggle blocked: debug_mode feature not granted",
            );
            return;
          }

          set({ debugMode: !debugMode });
          console.debug(
            "[SettingsStore] Debug mode toggled:",
            !debugMode ? "ON" : "OFF",
          );
        },

        setShowCalibrationGrid: (show: boolean) => {
          set({ showCalibrationGrid: show });
          console.debug(
            "[SettingsStore] Show calibration grid:",
            show ? "ON" : "OFF",
          );
        },

        setDebugButtonPosition: (position: DebugButtonPosition) => {
          set({ debugButtonPosition: position });
        },

        setAutoTranscription: (enabled: boolean) => {
          set({ autoTranscriptionEnabled: enabled });
          console.debug(
            "[SettingsStore] Auto-transcription:",
            enabled ? "ON" : "OFF",
          );
        },

        setHapticFeedback: (enabled: boolean) => {
          set({ hapticFeedbackEnabled: enabled });
          console.debug(
            "[SettingsStore] Haptic feedback:",
            enabled ? "ON" : "OFF",
          );
        },

        // Story 7.3: GitHub repo config
        setGithubRepo: (repo: string) => {
          set({ githubRepo: repo });
          console.debug('[SettingsStore] GitHub repo:', repo);
        },

        // Story 6.4: Sync on Wi-Fi only
        setSyncOnWifiOnly: (enabled: boolean) => {
          set({ syncOnWifiOnly: enabled });
          console.debug(
            "[SettingsStore] Sync on Wi-Fi only:",
            enabled ? "ON" : "OFF",
          );
        },

        // LLM Actions
        setLLMEnabled: (enabled: boolean) => {
          set((state) => ({
            llm: { ...state.llm, isEnabled: enabled },
          }));
          console.debug("[SettingsStore] LLM enabled:", enabled ? "ON" : "OFF");
        },

        setLLMAutoPostProcess: (enabled: boolean) => {
          set((state) => ({
            llm: { ...state.llm, isAutoPostProcess: enabled },
          }));
          console.debug(
            "[SettingsStore] LLM auto post-process:",
            enabled ? "ON" : "OFF",
          );
        },

        setLLMModelForTask: (task: LLMTask, modelId: LLMModelId | null) => {
          set((state) => ({
            llm: {
              ...state.llm,
              [task === "postProcessing"
                ? "selectedPostProcessingModel"
                : "selectedAnalysisModel"]: modelId,
            },
          }));
          console.debug(`[SettingsStore] LLM model for ${task}:`, modelId);
        },
      }),
      {
        name: "pensieve-settings",
        storage: createJSONStorage(() => AsyncStorage),
        // features is volatile — never persist (ADR-022: non-authoritative, TTL-based cache managed by UserFeaturesRepository)
        partialize: (state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { features, ...rest } = state;
          return rest;
        },
      },
    ),
    {
      name: "settings-store",
    },
  ),
);

/**
 * Helper to check if debug mode is enabled
 * Can be used outside React components
 *
 * Story 24.3 — Double gate:
 * Debug mode is ONLY active when BOTH conditions are met:
 * 1. getFeature('debug_mode') = true (backend feature granted)
 * 2. debugMode = true (user toggle enabled)
 *
 * This is an AND operation, not OR.
 */
export function isDebugModeEnabled(): boolean {
  const state = useSettingsStore.getState();
  const hasDebugAccess = state.features[FEATURE_KEYS.DEBUG_MODE] ?? false;
  return state.debugMode && hasDebugAccess;
}

/**
 * Zustand selector for debug mode (for use in React components)
 * Returns true only if BOTH feature AND toggle are enabled
 */
export const selectIsDebugModeEnabled = (state: SettingsState): boolean => {
  const hasDebugAccess = state.features[FEATURE_KEYS.DEBUG_MODE] ?? false;
  return state.debugMode && hasDebugAccess;
};

/**
 * Helper to check if data mining is enabled
 * Can be used outside React components
 *
 * Story 24.3 — AC2:
 * Data mining is active when getFeature('data_mining') = true.
 */
export function isDataMiningEnabled(): boolean {
  const state = useSettingsStore.getState();
  return state.features[FEATURE_KEYS.DATA_MINING] ?? false;
}
