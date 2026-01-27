/**
 * Zustand Store for Captures List
 *
 * Centralized store for captures list state management.
 * Event-driven architecture - no polling.
 *
 * Usage:
 * - useCapturesStore() in components for reactive state
 * - useCapturesStore.getState() outside React for imperative access
 * - useCapturesListener() hook to activate event synchronization
 *
 * Architecture:
 * - Store manages list state
 * - EventBus triggers updates via events
 * - No persist (data comes from SQLite DB)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { container } from 'tsyringe';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import type { ICaptureRepository } from '../contexts/capture/domain/ICaptureRepository';
import { TOKENS } from '../infrastructure/di/tokens';

interface CapturesState {
  // State
  captures: Capture[];
  isLoading: boolean;
  error: Error | null;

  // Actions
  loadCaptures: () => Promise<void>;
  updateCapture: (captureId: string) => Promise<void>;
  addCapture: (capture: Capture) => void;
  removeCapture: (captureId: string) => void;
  setCaptures: (captures: Capture[]) => void;
}

export const useCapturesStore = create<CapturesState>()(
  devtools(
    (set, get) => ({
      // State initial
      captures: [],
      isLoading: true,
      error: null,

      // Charge toute la liste (au mount)
      loadCaptures: async () => {
        try {
          set({ isLoading: true, error: null });
          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const allCaptures = await repository.findAll();
          const sorted = allCaptures.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          set({ captures: sorted, isLoading: false });
          console.log('[CapturesStore] ✓ Loaded', sorted.length, 'captures');
        } catch (error) {
          console.error('[CapturesStore] Load failed:', error);
          set({ error: error as Error, isLoading: false });
        }
      },

      // Reload UNE seule capture (optimisé)
      // Si la capture n'existe pas dans la liste, elle est ajoutée
      updateCapture: async (captureId: string) => {
        try {
          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const updated = await repository.findById(captureId);

          if (!updated) {
            console.warn('[CapturesStore] Capture not found:', captureId);
            return;
          }

          set(state => {
            const existingIndex = state.captures.findIndex(c => c.id === captureId);

            if (existingIndex >= 0) {
              // Capture existe déjà → mise à jour
              const newCaptures = [...state.captures];
              newCaptures[existingIndex] = updated;
              return { captures: newCaptures };
            } else {
              // Capture n'existe pas → ajout en début de liste
              return { captures: [updated, ...state.captures] };
            }
          });
          console.log('[CapturesStore] ✓ Updated capture:', captureId);
        } catch (error) {
          console.error('[CapturesStore] Update capture failed:', captureId, error);
        }
      },

      // Ajoute une nouvelle capture (event-driven)
      addCapture: (capture) => {
        set(state => ({
          captures: [capture, ...state.captures]
        }));
        console.log('[CapturesStore] ✓ Added capture:', capture.id);
      },

      // Supprime une capture (event-driven)
      removeCapture: (captureId) => {
        set(state => ({
          captures: state.captures.filter(c => c.id !== captureId)
        }));
        console.log('[CapturesStore] ✓ Removed capture:', captureId);
      },

      // Set direct (utilitaire)
      setCaptures: (captures) => {
        set({ captures });
      },
    }),
    {
      name: 'captures-store',
    }
  )
);
