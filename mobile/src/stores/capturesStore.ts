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
import { FLATLIST_PERFORMANCE } from '../constants/performance';

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

// Use centralized performance constant for consistency
const PAGE_SIZE = FLATLIST_PERFORMANCE.PAGINATION_BATCH_SIZE;

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

          /**
           * PERFORMANCE OPTIMIZATION: LIMIT+1 Pagination Pattern
           *
           * Instead of expensive COUNT(*) query to check if more pages exist,
           * we request one extra item (PAGE_SIZE+1) and check if we got it.
           *
           * Benefits:
           * - Eliminates separate COUNT(*) query (O(n) → O(1))
           * - Single database round-trip instead of two
           * - Scales to millions of rows without performance degradation
           *
           * Trade-off:
           * - Fetches 1 extra row per page (negligible cost)
           * - Slightly more complex logic (worth the performance gain)
           *
           * References:
           * - Use The Index Luke: https://use-the-index-luke.com/sql/partial-results/fetch-next-page
           * - Efficient Pagination: https://stackoverflow.com/a/34110100
           */
          const results = await repository.findAllPaginated(PAGE_SIZE + 1, 0);

          // If we got PAGE_SIZE+1 items, there are more pages
          const hasMore = results.length > PAGE_SIZE;

          // Keep only PAGE_SIZE items for display (discard the extra item)
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

          // PERFORMANCE: LIMIT+1 pattern (see loadCaptures for full documentation)
          const results = await repository.findAllPaginated(PAGE_SIZE + 1, currentLength);

          // If we got PAGE_SIZE+1 items, there are more pages
          const hasMore = results.length > PAGE_SIZE;

          // Keep only PAGE_SIZE items for display (discard the extra item)
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
              // Preserve isInQueue: UI-only flag not persisted in DB
              const newCaptures = [...state.captures];
              newCaptures[existingIndex] = { ...updated, isInQueue: state.captures[existingIndex].isInQueue };
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
