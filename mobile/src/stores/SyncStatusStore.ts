/**
 * SyncStatusStore - Zustand store for sync status UI
 *
 * Story 6.2 - Task 9.4: Sync status tracking
 *
 * Provides reactive state for sync status indicator in UI.
 * Consumed by SyncStatusIndicator component (Task 9.6).
 *
 * @architecture Layer: UI State Management
 * @pattern Zustand (lightweight state management)
 */

import { create } from 'zustand';

/**
 * Sync status types
 */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

/**
 * SyncStatusStore State
 */
export interface SyncStatusState {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingCount: number;
  errorMessage: string | null;

  // Actions
  setSyncing: () => void;
  setSynced: (timestamp: number) => void;
  setPending: (count: number) => void;
  setError: (message: string) => void;
  reset: () => void;
  getTimeSinceLastSync: () => number | null;
}

/**
 * Initial state
 */
const initialState = {
  status: 'synced' as SyncStatus,
  lastSyncTime: null,
  pendingCount: 0,
  errorMessage: null,
};

/**
 * SyncStatusStore - Zustand store
 */
export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
  ...initialState,

  /**
   * Set syncing status
   * Clears any previous error
   */
  setSyncing: () =>
    set({
      status: 'syncing',
      errorMessage: null,
    }),

  /**
   * Set synced status with timestamp
   * Clears any previous error
   *
   * @param timestamp - Unix timestamp of sync completion
   */
  setSynced: (timestamp: number) =>
    set({
      status: 'synced',
      lastSyncTime: timestamp,
      errorMessage: null,
    }),

  /**
   * Set pending status with count
   *
   * @param count - Number of pending items to sync
   */
  setPending: (count: number) =>
    set({
      status: 'pending',
      pendingCount: count,
    }),

  /**
   * Set error status with message
   *
   * @param message - Error description
   */
  setError: (message: string) =>
    set({
      status: 'error',
      errorMessage: message,
    }),

  /**
   * Reset to initial state
   */
  reset: () => set(initialState),

  /**
   * Get time elapsed since last sync in seconds
   *
   * @returns Seconds elapsed, or null if never synced
   */
  getTimeSinceLastSync: () => {
    const { lastSyncTime } = get();
    if (!lastSyncTime) {
      return null;
    }

    const now = Date.now();
    const elapsedMs = now - lastSyncTime;
    return Math.floor(elapsedMs / 1000);
  },
}));
