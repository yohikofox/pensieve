/**
 * Zustand Store for Capture Detail Screen
 *
 * Centralized store for single capture detail state.
 * Event-driven architecture - no polling.
 *
 * Architecture: Un écran = un store
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { container } from 'tsyringe';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import type { ICaptureRepository } from '../contexts/capture/domain/ICaptureRepository';
import type { ICaptureMetadataRepository } from '../contexts/capture/domain/ICaptureMetadataRepository';
import type { ICaptureAnalysisRepository } from '../contexts/capture/domain/ICaptureAnalysisRepository';
import { TOKENS } from '../infrastructure/di/tokens';
import type { CaptureMetadata } from '../contexts/capture/domain/CaptureMetadata.model';
import type { CaptureAnalysis } from '../contexts/capture/domain/CaptureAnalysis.model';

interface CaptureDetailState {
  // State
  capture: Capture | null;
  metadata: Record<string, CaptureMetadata>; // Full metadata objects
  metadataMap: Record<string, string | null>; // Simple key-value map (legacy format)
  analyses: Record<string, CaptureAnalysis | null>; // Analyses by type
  isLoading: boolean;
  error: Error | null;

  // Actions
  loadCapture: (captureId: string) => Promise<void>;
  updateCapture: (captureId: string) => Promise<void>;
  clearCapture: () => void;
}

export const useCaptureDetailStore = create<CaptureDetailState>()(
  devtools(
    (set, get) => ({
      // State initial
      capture: null,
      metadata: {},
      metadataMap: {},
      analyses: {},
      isLoading: false,
      error: null,

      // Load complete capture with metadata and analyses
      loadCapture: async (captureId: string) => {
        try {
          set({ isLoading: true, error: null });

          const captureRepo = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const metadataRepo = container.resolve<ICaptureMetadataRepository>(TOKENS.ICaptureMetadataRepository);
          const analysisRepo = container.resolve<ICaptureAnalysisRepository>(TOKENS.ICaptureAnalysisRepository);

          const [capture, metadata, analysesList] = await Promise.all([
            captureRepo.findById(captureId),
            metadataRepo.getAllAsMap(captureId),
            analysisRepo.findByCaptureId(captureId),
          ]);

          // Convert metadata to simple map (legacy format)
          const metadataMap: Record<string, string | null> = {};
          Object.entries(metadata || {}).forEach(([key, meta]) => {
            metadataMap[key] = meta.value;
          });

          // Convert analyses array to map by type
          const analysesMap: Record<string, CaptureAnalysis | null> = {};
          (analysesList || []).forEach(analysis => {
            analysesMap[analysis.type] = analysis;
          });

          set({
            capture: capture || null,
            metadata: metadata || {},
            metadataMap,
            analyses: analysesMap,
            isLoading: false,
          });

          console.log('[CaptureDetailStore] ✓ Loaded capture:', captureId);
        } catch (error) {
          console.error('[CaptureDetailStore] Load failed:', error);
          set({ error: error as Error, isLoading: false });
        }
      },

      // Update capture (called by event listener)
      updateCapture: async (captureId: string) => {
        const currentCapture = get().capture;

        // Only update if it's the current capture
        if (!currentCapture || currentCapture.id !== captureId) {
          return;
        }

        // Reload everything
        await get().loadCapture(captureId);
      },

      // Clear on unmount
      clearCapture: () => {
        set({
          capture: null,
          metadata: {},
          metadataMap: {},
          analyses: {},
          isLoading: false,
          error: null,
        });
        console.log('[CaptureDetailStore] ✓ Cleared');
      },
    }),
    {
      name: 'capture-detail-store',
    }
  )
);
