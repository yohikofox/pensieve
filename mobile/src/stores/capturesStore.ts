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

// Item de liste unifié : soit une vraie capture, soit un placeholder skeleton
export type ListEntry =
  | { kind: 'capture'; data: CaptureWithQueue }
  | { kind: 'skeleton'; id: string };

interface CapturesState {
  // State
  captures: CaptureWithQueue[];
  pendingCaptureIds: string[];   // IDs en cours de chargement → skeleton cards
  isInitialLoading: boolean;     // true uniquement sur 1er load liste vide
  isLoadingMore: boolean;
  hasMoreCaptures: boolean;
  error: Error | null;

  // Actions
  loadCaptures: () => Promise<void>;
  loadMoreCaptures: () => Promise<void>;
  updateCapture: (captureId: string) => Promise<void>;
  addPendingCapture: (captureId: string) => void;
  reloadCapture: (captureId: string) => Promise<void>;
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
      pendingCaptureIds: [],
      isInitialLoading: true,
      isLoadingMore: false,
      hasMoreCaptures: true,
      error: null,

      // Charge la première page (au mount)
      // Story 3.1 - AC4: Optimisé avec pagination DB (offset/limit) + LIMIT+1 trick
      loadCaptures: async () => {
        const { captures, pendingCaptureIds } = get();
        // Spinner uniquement si vraiment rien à afficher (premier load)
        if (captures.length === 0 && pendingCaptureIds.length === 0) {
          set({ isInitialLoading: true, error: null, hasMoreCaptures: true });
        }
        // Si du contenu est déjà affiché → refresh silencieux (pas de spinner)
        try {
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
            isInitialLoading: false,
            hasMoreCaptures: hasMore
          });
          console.log('[CapturesStore] ✓ Loaded', firstPage.length, 'captures (first page, hasMore:', hasMore, ')');
        } catch (error) {
          console.error('[CapturesStore] Load failed:', error);
          set({ error: error as Error, isInitialLoading: false });
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
      // Si la capture n'existe pas dans la liste, elle est ajoutée.
      // Retire aussi la capture des pendingCaptureIds (skeleton → carte réelle).
      updateCapture: async (captureId: string) => {
        try {
          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const updated = await repository.findById(captureId);

          if (!updated) {
            console.warn('[CapturesStore] Capture not found:', captureId);
            // Retire des pending même si non trouvée (évite skeleton bloqué)
            set(state => ({
              pendingCaptureIds: state.pendingCaptureIds.filter(id => id !== captureId)
            }));
            return;
          }

          set(state => {
            const existingIndex = state.captures.findIndex(c => c.id === captureId);
            const newPendingIds = state.pendingCaptureIds.filter(id => id !== captureId);

            if (existingIndex >= 0) {
              // Capture existe déjà → mise à jour en place
              // Preserve isInQueue: UI-only flag not persisted in DB
              const newCaptures = [...state.captures];
              newCaptures[existingIndex] = { ...updated, isInQueue: state.captures[existingIndex].isInQueue };
              return { captures: newCaptures, pendingCaptureIds: newPendingIds };
            } else {
              // Capture pending → résolue, ajout en tête de liste
              return { captures: [updated, ...state.captures], pendingCaptureIds: newPendingIds };
            }
          });
          console.log('[CapturesStore] ✓ Updated capture:', captureId);
        } catch (error) {
          console.error('[CapturesStore] Update capture failed:', captureId, error);
          // Retire des pending même en cas d'erreur (évite skeleton bloqué)
          set(state => ({ pendingCaptureIds: state.pendingCaptureIds.filter(id => id !== captureId) }));
        }
      },

      // Ajoute un ID de capture en attente → affiche une skeleton card en haut de liste
      addPendingCapture: (captureId: string) => {
        set(state => ({
          pendingCaptureIds: [captureId, ...state.pendingCaptureIds]
        }));
        console.log('[CapturesStore] ✓ Added pending:', captureId);
      },

      // Retire la carte de la liste, affiche un skeleton 5 s, puis recharge depuis la DB.
      // Usage : debug/test de l'animation skeleton via long press.
      reloadCapture: async (captureId: string) => {
        console.log('[CapturesStore] 🔄 Reloading capture (skeleton test):', captureId);

        // 1. Retire la vraie carte et met l'ID en pending → skeleton apparaît en haut
        set(state => ({
          captures: state.captures.filter(c => c.id !== captureId),
          pendingCaptureIds: [captureId, ...state.pendingCaptureIds],
        }));

        // 2. Simulation d'un chargement long pour observer le skeleton
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 3. Recharge depuis la DB et résout le pending (même logique que updateCapture)
        try {
          const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
          const updated = await repository.findById(captureId);

          if (!updated) {
            console.warn('[CapturesStore] Reload: capture not found:', captureId);
            set(state => ({ pendingCaptureIds: state.pendingCaptureIds.filter(id => id !== captureId) }));
            return;
          }

          set(state => ({
            captures: [updated, ...state.captures],
            pendingCaptureIds: state.pendingCaptureIds.filter(id => id !== captureId),
          }));
          console.log('[CapturesStore] ✓ Reload complete:', captureId);
        } catch (error) {
          console.error('[CapturesStore] Reload failed:', captureId, error);
          set(state => ({ pendingCaptureIds: state.pendingCaptureIds.filter(id => id !== captureId) }));
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
