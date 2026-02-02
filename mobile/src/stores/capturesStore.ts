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

// Extend Capture with queue status (event-driven)
export type CaptureWithQueue = Capture & {
  isInQueue?: boolean;
};

interface CapturesState {
  // State
  captures: CaptureWithQueue[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreCaptures: boolean;
  error: Error | null;

  // Actions
  loadCaptures: () => Promise<void>;
  loadMoreCaptures: () => Promise<void>;
  updateCapture: (captureId: string) => Promise<void>;
  addCapture: (capture: Capture) => void;
  removeCapture: (captureId: string) => void;
  setCaptures: (captures: Capture[]) => void;
  setIsInQueue: (captureId: string, isInQueue: boolean) => void;
}

const PAGE_SIZE = 20; // Nombre de captures par page

export const useCapturesStore = create<CapturesState>()(
  devtools(
    (set, get) => ({
      // State initial
      captures: [],
      isLoading: true,
      isLoadingMore: false,
      hasMoreCaptures: true,
      error: null,

      // Charge la première page (au mount)
      // Story 3.1 - AC4: Optimisé avec pagination DB (offset/limit) + LIMIT+1 trick
      loadCaptures: async () => {
        try {
          set({ isLoading: true, error: null, hasMoreCaptures: true });
          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);

          // PERFORMANCE: Use LIMIT+1 trick to avoid expensive COUNT(*) query
          // Load PAGE_SIZE+1 items to check if there are more without counting all rows
          const results = await repository.findAllPaginated(PAGE_SIZE + 1, 0);

          // If we got PAGE_SIZE+1 items, there are more pages
          const hasMore = results.length > PAGE_SIZE;

          // Keep only PAGE_SIZE items for display
          const firstPage = hasMore ? results.slice(0, PAGE_SIZE) : results;

          set({
            captures: firstPage,
            isLoading: false,
            hasMoreCaptures: hasMore
          });
          console.log('[CapturesStore] ✓ Loaded', firstPage.length, 'captures (first page, hasMore:', hasMore, ')');
        } catch (error) {
          console.error('[CapturesStore] Load failed:', error);
          set({ error: error as Error, isLoading: false });
        }
      },

      // Charge la page suivante (infinite scroll)
      // Story 3.1 - AC4: Optimisé avec pagination DB (offset/limit) + LIMIT+1 trick
      loadMoreCaptures: async () => {
        const { isLoadingMore, hasMoreCaptures, captures } = get();

        // Ne rien faire si déjà en cours ou plus de captures
        if (isLoadingMore || !hasMoreCaptures) {
          return;
        }

        try {
          set({ isLoadingMore: true });

          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const currentLength = captures.length;

          // PERFORMANCE: Use LIMIT+1 trick to avoid expensive COUNT(*) query
          const results = await repository.findAllPaginated(PAGE_SIZE + 1, currentLength);

          // If we got PAGE_SIZE+1 items, there are more pages
          const hasMore = results.length > PAGE_SIZE;

          // Keep only PAGE_SIZE items for display
          const nextPage = hasMore ? results.slice(0, PAGE_SIZE) : results;

          set({
            captures: [...captures, ...nextPage],
            isLoadingMore: false,
            hasMoreCaptures: hasMore
          });
          console.log('[CapturesStore] ✓ Loaded', nextPage.length, 'more captures (total:', currentLength + nextPage.length, ', hasMore:', hasMore, ')');
        } catch (error) {
          console.error('[CapturesStore] Load more failed:', error);
          set({ isLoadingMore: false });
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

      // Set queue status for a capture (event-driven)
      setIsInQueue: (captureId, isInQueue) => {
        set(state => ({
          captures: state.captures.map(c =>
            c.id === captureId ? { ...c, isInQueue } : c
          )
        }));
        console.log('[CapturesStore] ✓ Set isInQueue:', captureId, isInQueue);
      },
    }),
    {
      name: 'captures-store',
    }
  )
);
