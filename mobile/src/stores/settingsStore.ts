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
import type { LLMModelId, LLMTask } from '../contexts/Normalization/services/LLMModelService';
import type { ColorScheme } from '../design-system/tokens';

// Theme preference type
export type ThemePreference = 'light' | 'dark' | 'system';

// Audio player type (Story 3.2b)
export type AudioPlayerType = 'waveform' | 'simple';

// Debug button position (anchored to edge)
export interface DebugButtonPosition {
  edge: 'left' | 'right';
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

  // Story 7.1: Support Mode avec Permissions Backend
  // Backend permission to access debug mode features
  // Controls whether the debug mode toggle appears in settings
  debugModeAccess: boolean;

  // Debug mode local toggle - user's preference to enable/disable debug mode
  // Only effective when debugModeAccess is true
  // This was previously just "debugMode" but renamed for clarity
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

  // Actions
  setThemePreference: (preference: ThemePreference) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setAudioPlayerType: (type: AudioPlayerType) => void;
  setDebugModeAccess: (enabled: boolean) => void; // Story 7.1: Update backend permission
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
  setShowCalibrationGrid: (show: boolean) => void;
  setDebugButtonPosition: (position: DebugButtonPosition) => void;
  setAutoTranscription: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;

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
        themePreference: 'system' as ThemePreference,

        // Initial state - blue color scheme by default
        colorScheme: 'blue' as ColorScheme,

        // Initial state - waveform player by default (Story 3.2b)
        audioPlayerType: 'waveform' as AudioPlayerType,

        // Story 7.1: Backend permission for debug mode - default false (security)
        debugModeAccess: false,

        // Initial state - debug mode local toggle off by default
        debugMode: false,

        // Initial state - show calibration grid enabled by default (when debugMode is on)
        showCalibrationGrid: true,

        // Default button position: bottom right
        debugButtonPosition: {
          edge: 'right',
          verticalPercent: 0.85, // Near bottom
        },

        // Initial state - auto-transcription disabled by default (manual trigger from capture details)
        autoTranscriptionEnabled: false,

        // Initial state - haptic feedback enabled by default (Story 5.2 Code Review Fix #7)
        hapticFeedbackEnabled: true,

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
          console.log('[SettingsStore] Theme preference:', preference);
        },

        setColorScheme: (scheme: ColorScheme) => {
          set({ colorScheme: scheme });
          console.log('[SettingsStore] Color scheme:', scheme);
        },

        setAudioPlayerType: (type: AudioPlayerType) => {
          set({ audioPlayerType: type });
          console.log('[SettingsStore] Audio player type:', type);
        },

        // Story 7.1: Set backend permission for debug mode access
        setDebugModeAccess: (enabled: boolean) => {
          set({ debugModeAccess: enabled });
          console.log('[SettingsStore] Debug mode access (backend):', enabled ? 'GRANTED' : 'DENIED');

          // AC7: If permission denied, disable local debug mode
          if (!enabled) {
            set({ debugMode: false });
            console.log('[SettingsStore] Debug mode disabled (permission revoked)');
          }
        },

        // AC8: Verify permission before activating debug mode
        setDebugMode: (enabled: boolean) => {
          const { debugModeAccess } = get();

          // Only allow enabling if backend permission is granted
          if (enabled && !debugModeAccess) {
            console.warn('[SettingsStore] Debug mode activation blocked: no backend permission');
            return;
          }

          set({ debugMode: enabled });
          console.log('[SettingsStore] Debug mode:', enabled ? 'ON' : 'OFF');
        },

        toggleDebugMode: () => {
          const { debugMode, debugModeAccess } = get();

          // Only allow toggling if backend permission is granted
          if (!debugMode && !debugModeAccess) {
            console.warn('[SettingsStore] Debug mode toggle blocked: no backend permission');
            return;
          }

          set({ debugMode: !debugMode });
          console.log('[SettingsStore] Debug mode toggled:', !debugMode ? 'ON' : 'OFF');
        },

        setShowCalibrationGrid: (show: boolean) => {
          set({ showCalibrationGrid: show });
          console.log('[SettingsStore] Show calibration grid:', show ? 'ON' : 'OFF');
        },

        setDebugButtonPosition: (position: DebugButtonPosition) => {
          set({ debugButtonPosition: position });
        },

        setAutoTranscription: (enabled: boolean) => {
          set({ autoTranscriptionEnabled: enabled });
          console.log('[SettingsStore] Auto-transcription:', enabled ? 'ON' : 'OFF');
        },

        setHapticFeedback: (enabled: boolean) => {
          set({ hapticFeedbackEnabled: enabled });
          console.log('[SettingsStore] Haptic feedback:', enabled ? 'ON' : 'OFF');
        },

        // LLM Actions
        setLLMEnabled: (enabled: boolean) => {
          set((state) => ({
            llm: { ...state.llm, isEnabled: enabled },
          }));
          console.log('[SettingsStore] LLM enabled:', enabled ? 'ON' : 'OFF');
        },

        setLLMAutoPostProcess: (enabled: boolean) => {
          set((state) => ({
            llm: { ...state.llm, isAutoPostProcess: enabled },
          }));
          console.log('[SettingsStore] LLM auto post-process:', enabled ? 'ON' : 'OFF');
        },

        setLLMModelForTask: (task: LLMTask, modelId: LLMModelId | null) => {
          set((state) => ({
            llm: {
              ...state.llm,
              [task === 'postProcessing' ? 'selectedPostProcessingModel' : 'selectedAnalysisModel']: modelId,
            },
          }));
          console.log(`[SettingsStore] LLM model for ${task}:`, modelId);
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
