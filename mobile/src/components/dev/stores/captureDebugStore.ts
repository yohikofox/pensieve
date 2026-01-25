/**
 * Zustand Store for CaptureDevTools DevTool
 *
 * Lifecycle: Created/destroyed with CaptureDevTools component
 * Scope: Dev-only, contextual to screen displaying the DevTool
 * Updated by: CaptureDebugStoreSync (EventBus listener)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CaptureDebugItem {
  id: string;
  type: 'audio' | 'text';
  state: string;
  rawContent: string | null;
  duration: number | null;
  createdAt: Date;
  syncStatus: string;
}

export interface SyncStats {
  pending: number;
  synced: number;
  total: number;
}

interface CaptureDebugState {
  // State
  captures: CaptureDebugItem[];
  syncStats: SyncStats;
  error: string | null;

  // Actions (called by CaptureDebugStoreSync)
  setCaptures: (captures: CaptureDebugItem[]) => void;
  addCapture: (capture: CaptureDebugItem) => void;
  updateCapture: (captureId: string, updates: Partial<CaptureDebugItem>) => void;
  removeCapture: (captureId: string) => void;
  setSyncStats: (stats: SyncStats) => void;
  setError: (error: string | null) => void;
}

export const useCaptureDebugStore = create<CaptureDebugState>()(
  devtools(
    (set) => ({
      // Initial state
      captures: [],
      syncStats: { pending: 0, synced: 0, total: 0 },
      error: null,

      // Actions
      setCaptures: (captures) => set({ captures }),

      addCapture: (capture) =>
        set((state) => ({
          captures: [capture, ...state.captures], // New captures at top
        })),

      updateCapture: (captureId, updates) =>
        set((state) => ({
          captures: state.captures.map((c) =>
            c.id === captureId ? { ...c, ...updates } : c
          ),
        })),

      removeCapture: (captureId) =>
        set((state) => ({
          captures: state.captures.filter((c) => c.id !== captureId),
        })),

      setSyncStats: (syncStats) => set({ syncStats }),

      setError: (error) => set({ error }),
    }),
    {
      name: 'capture-debug-store',
      enabled: __DEV__,
    }
  )
);
