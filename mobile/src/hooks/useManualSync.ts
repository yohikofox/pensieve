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

/**
 * Hook to trigger manual sync.
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
    try {
      await syncService.sync({ priority: 'high' });
    } finally {
      setIsManualSyncing(false);
    }
  }, [syncService, isManualSyncing]);

  return { triggerManualSync, isManualSyncing };
};
