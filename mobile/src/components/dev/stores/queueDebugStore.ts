/**
 * Zustand Store for TranscriptionQueueDebug DevTool
 *
 * Lifecycle: Created/destroyed with TranscriptionQueueDebug component
 * Scope: Dev-only, contextual to screen displaying the DevTool
 * Updated by: QueueDebugStoreSync (EventBus listener)
 *
 * Architecture:
 * - Store is local to DevTool component (not global)
 * - Sync listener subscribes to queue events on mount
 * - Everything cleaned up on unmount (zero memory leak)
 * - Production builds: never instantiated (__DEV__ check)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface QueueItem {
  id: string; // Generated as tq_{timestamp}_{random}
  capture_id: string;
  status: string;
  audio_path: string;
  audio_duration: number | null;
  created_at: number;
  updated_at: number;
}

export interface QueueStats {
  total: number; // In queue (pending + processing)
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isPaused: boolean;
  totalProcessed: number; // Cumulative (completed + failed)
}

interface QueueDebugState {
  // State
  items: QueueItem[];
  stats: QueueStats;

  // Actions (called by QueueDebugStoreSync)
  setItems: (items: QueueItem[]) => void;
  setStats: (stats: QueueStats) => void;
  addItem: (item: QueueItem) => void;
  updateItem: (captureId: string, updates: Partial<QueueItem>) => void;
  removeItem: (captureId: string) => void;
}

const initialStats: QueueStats = {
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  isPaused: false,
  totalProcessed: 0,
};

export const useQueueDebugStore = create<QueueDebugState>()(
  devtools(
    (set) => ({
      // Initial state
      items: [],
      stats: initialStats,

      // Actions
      setItems: (items) => set({ items }),
      setStats: (stats) => set({ stats }),

      addItem: (item) =>
        set((state) => ({
          items: [...state.items, item],
        })),

      updateItem: (captureId, updates) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.capture_id === captureId ? { ...item, ...updates } : item
          ),
        })),

      removeItem: (captureId) =>
        set((state) => ({
          items: state.items.filter((item) => item.capture_id !== captureId),
        })),
    }),
    {
      name: 'queue-debug-store',
      enabled: __DEV__,
    }
  )
);
