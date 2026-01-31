/**
 * Zustand Store for LLM Settings Screen UI State
 *
 * This store manages UI-specific state for the LLM Settings screen only.
 * For global LLM settings (isEnabled, selected models, etc.), use settingsStore.llm
 *
 * Pattern: Screen-specific stores manage UI state that doesn't need to be
 * accessed outside the screen (model lists, auth state, NPU info).
 *
 * Usage:
 * - useLLMSettingsScreenStore() in LLMSettingsScreen components
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { LLMModelConfig } from '../contexts/Normalization/services/LLMModelService';
import type { NPUInfo } from '../contexts/Normalization/services/NPUDetectionService';
import type { HuggingFaceUser } from '../contexts/Normalization/services/HuggingFaceAuthService';

interface LLMSettingsScreenState {
  // Available models (cache for UI display)
  tpuModels: LLMModelConfig[];
  standardModels: LLMModelConfig[];

  // HuggingFace authentication (UI only)
  isHfAuthenticated: boolean;
  hfUser: HuggingFaceUser | null;

  // NPU detection info (UI only)
  npuInfo: NPUInfo | null;

  // Actions
  setModels: (tpu: LLMModelConfig[], standard: LLMModelConfig[]) => void;
  setHfAuth: (authenticated: boolean, user: HuggingFaceUser | null) => void;
  setNpuInfo: (info: NPUInfo) => void;
}

export const useLLMSettingsScreenStore = create<LLMSettingsScreenState>()(
  devtools(
    (set) => ({
      // Initial state
      tpuModels: [],
      standardModels: [],
      isHfAuthenticated: false,
      hfUser: null,
      npuInfo: null,

      // Actions
      setModels: (tpu: LLMModelConfig[], standard: LLMModelConfig[]) => {
        set({ tpuModels: tpu, standardModels: standard });
        console.log('[LLMSettingsScreen] Models updated:', {
          tpu: tpu.length,
          standard: standard.length,
        });
      },

      setHfAuth: (authenticated: boolean, user: HuggingFaceUser | null) => {
        set({ isHfAuthenticated: authenticated, hfUser: user });
        console.log('[LLMSettingsScreen] HF auth:', authenticated ? `✓ ${user?.name}` : '✗');
      },

      setNpuInfo: (info: NPUInfo) => {
        set({ npuInfo: info });
        console.log('[LLMSettingsScreen] NPU info:', info.type, info.hasNPU ? '✓' : '✗');
      },
    }),
    {
      name: 'llm-settings-screen-store',
    }
  )
);

/**
 * Helper to check if any models are downloaded
 */
export function hasDownloadedModels(): boolean {
  const { tpuModels, standardModels } = useLLMSettingsScreenStore.getState();
  const allModels = [...tpuModels, ...standardModels];
  return allModels.some((model) => model.downloaded);
}
