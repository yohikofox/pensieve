/**
 * useSyncStatusBridge - Bridge EventBus → SyncStatusStore
 *
 * Story 6.4 - Task 1: Connect EventBus sync events to SyncStatusStore
 *
 * Problem: SyncStatusStore exists but is NOT connected to EventBus sync events.
 * Solution: Subscribe to SyncCompleted/SyncFailed events and update the store accordingly.
 *
 * This hook should be called once at the app root (AppContent in MainApp.tsx).
 *
 * @architecture Layer: Application Hook (bridge between infrastructure events and UI state)
 */

import { useEffect } from 'react';
import { eventBus } from '../contexts/shared/events/EventBus';
import { useSyncStatusStore } from '../stores/SyncStatusStore';
import {
  isSyncCompletedEvent,
  isSyncFailedEvent,
} from '../infrastructure/sync/events/SyncEvents';

/**
 * Bridges EventBus sync events to SyncStatusStore.
 *
 * Handles:
 * - SyncCompletedEvent → setSynced(timestamp)
 * - SyncFailedEvent (retryable) → setPending(currentCount) — preserves existing count
 * - SyncFailedEvent (non-retryable) → setError(message)
 *
 * Must be called inside AppContent to run after bootstrap completes.
 */
export const useSyncStatusBridge = (): void => {
  const setSynced = useSyncStatusStore((state) => state.setSynced);
  const setError = useSyncStatusStore((state) => state.setError);
  const setPending = useSyncStatusStore((state) => state.setPending);

  useEffect(() => {
    const subscription = eventBus.subscribeAll((event) => {
      if (isSyncCompletedEvent(event)) {
        setSynced(Date.now());
      } else if (isSyncFailedEvent(event)) {
        if (event.payload.retryable) {
          // Retry in progress — preserve existing pendingCount, only update status
          const currentCount = useSyncStatusStore.getState().pendingCount;
          setPending(currentCount);
        } else {
          // Non-retryable failure — show error
          setError(event.payload.error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setSynced, setError, setPending]);
};
