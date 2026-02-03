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

// Theme preference type
export type ThemePreference = 'light' | 'dark' | 'system';

// Audio player type (Story 3.2b)
export type AudioPlayerType = 'waveform' | 'classic';

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

  // Audio player type - 'waveform' (default) or 'classic' (Story 3.2b)
  audioPlayerType: AudioPlayerType;

  // Debug mode - enables all debug features (WAV player, etc.)
  // Can be enabled by user permissions in production
  debugMode: boolean;

  // Show calibration grid - override to hide grid even when debugMode is on
  // Allows disabling grid independently from other debug features
  showCalibrationGrid: boolean;

  // Debug button position (draggable, anchored to edge)
  debugButtonPosition: DebugButtonPosition;

  // Auto-transcription - automatically transcribe audio captures after recording
  // When disabled, transcription must be triggered manually from capture details
  autoTranscriptionEnabled: boolean;

  // LLM settings - AI post-processing configuration (consulted app-wide)
  llm: LLMSettings;

  // Actions
  setThemePreference: (preference: ThemePreference) => void;
  setAudioPlayerType: (type: AudioPlayerType) => void;
  setDebugMode: (enabled: boolean) => void;
  toggleDebugMode: () => void;
  setShowCalibrationGrid: (show: boolean) => void;
  setDebugButtonPosition: (position: DebugButtonPosition) => void;
  setAutoTranscription: (enabled: boolean) => void;

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

        // Initial state - waveform player by default (Story 3.2b)
        audioPlayerType: 'waveform' as AudioPlayerType,

        // Initial state - debug mode off by default
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

        setAudioPlayerType: (type: AudioPlayerType) => {
          set({ audioPlayerType: type });
          console.log('[SettingsStore] Audio player type:', type);
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
