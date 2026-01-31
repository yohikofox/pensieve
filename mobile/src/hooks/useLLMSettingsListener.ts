/**
 * LLM Settings Listener Hook
 *
 * Synchronizes LLMModelService (AsyncStorage source of truth) with settingsStore (in-memory cache).
 *
 * Pattern: Service → Store sync (one-way data flow)
 * - LLMModelService is the source of truth (persisted in AsyncStorage)
 * - settingsStore.llm is a reactive cache for UI
 * - This listener loads settings on mount and keeps them in sync
 *
 * Usage:
 * - Call once in App.tsx or root layout
 * - Updates are pushed to settingsStore for reactive UI updates
 */

import { useEffect } from 'react';
import { container } from 'tsyringe';
import { LLMModelService } from '../contexts/Normalization/services/LLMModelService';
import { useSettingsStore } from '../stores/settingsStore';

export function useLLMSettingsListener() {
  useEffect(() => {
    const modelService = container.resolve(LLMModelService);

    // Load initial state from service (source of truth)
    const loadSettings = async () => {
      try {
        const [isEnabled, isAutoPostProcess, postProcessingModel, analysisModel] = await Promise.all([
          modelService.isPostProcessingEnabled(),
          modelService.isAutoPostProcessEnabled(),
          modelService.getModelForTask('postProcessing'),
          modelService.getModelForTask('analysis'),
        ]);

        // Sync to store (cache)
        const { setLLMEnabled, setLLMAutoPostProcess, setLLMModelForTask } = useSettingsStore.getState();
        setLLMEnabled(isEnabled);
        setLLMAutoPostProcess(isAutoPostProcess);

        if (postProcessingModel) {
          setLLMModelForTask('postProcessing', postProcessingModel);
        }

        if (analysisModel) {
          setLLMModelForTask('analysis', analysisModel);
        }

        console.log('[LLMSettingsListener] ✓ Settings loaded from service');
      } catch (error) {
        console.error('[LLMSettingsListener] Failed to load settings:', error);
      }
    };

    loadSettings();

    // No cleanup needed - this is a one-time initial sync
    // Updates will be handled by components calling settingsStore actions
    // which should also update the service
  }, []);
}
