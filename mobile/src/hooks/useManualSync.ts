/**
 * useManualSync - Manual sync trigger hook
 *
 * Story 6.4 - Task 5: Pull-to-refresh as manual sync trigger
 *
 * Provides a unified way to trigger manual sync from any screen.
 * Integrates with SyncStatusStore for loading state feedback.
 *
 * @architecture Layer: Application Hook
 */

import { useCallback, useState } from 'react';
import { useSyncService } from './useServices';
import { useSyncStatusStore } from '../stores/SyncStatusStore';
import { SyncResult } from '../infrastructure/sync/types';

/**
 * Hook to trigger manual sync.
 *
 * ADR-023: Uses Result Pattern — never throws, handles SyncResult.
 *
 * @returns triggerManualSync - async function to trigger sync
 * @returns isManualSyncing - boolean loading state
 */
export const useManualSync = () => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const syncService = useSyncService();

  const triggerManualSync = useCallback(async (): Promise<void> => {
    if (!syncService || isManualSyncing) {
      return;
    }

    setIsManualSyncing(true);
    useSyncStatusStore.getState().setSyncing();

    const response = await syncService.sync({ priority: 'high' });

    setIsManualSyncing(false);

    // ADR-023: Handle Result Pattern — no throw, drive store state from result
    if (response.result === SyncResult.SUCCESS) {
      // setSynced will be triggered by useSyncStatusBridge via SyncCompletedEvent
      // No duplicate state update needed here
    } else if (response.retryable) {
      const currentCount = useSyncStatusStore.getState().pendingCount;
      useSyncStatusStore.getState().setPending(currentCount);
    } else {
      const errorMessage =
        response.error ?? 'Échec de la synchronisation. Veuillez réessayer.';
      useSyncStatusStore.getState().setError(errorMessage);
    }
  }, [syncService, isManualSyncing]);

  return { triggerManualSync, isManualSyncing };
};
