/**
 * useSyncDetails - Hook for detailed sync information
 *
 * Story 6.4 - Task 3: SyncStatusDetailModal + useSyncDetails hook
 *
 * Returns formatted sync status details for display in SyncStatusDetailModal.
 *
 * @architecture Layer: Application Hook (presentation logic)
 */

import { useSyncStatusStore } from '../stores/SyncStatusStore';
import type { SyncStatus } from '../stores/SyncStatusStore';

export interface SyncDetails {
  status: SyncStatus;
  statusLabel: string;
  lastSyncLabel: string;
  pendingCount: number;
  errorMessage: string | null;
  canRetry: boolean;
}

/**
 * Formats seconds into a human-readable elapsed time string.
 */
function formatElapsedTime(seconds: number | null): string {
  if (seconds === null) return 'Jamais synchronisé';
  if (seconds < 60) return 'À l\'instant';
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
  return `Il y a ${Math.floor(seconds / 86400)} j`;
}

/**
 * Returns a human-readable label for a sync status.
 */
function getStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'syncing':
      return 'Synchronisation en cours...';
    case 'synced':
      return 'Synchronisé';
    case 'pending':
      return 'En attente de synchronisation';
    case 'error':
      return 'Erreur de synchronisation';
    default:
      return 'Inconnu';
  }
}

/**
 * Hook providing detailed sync information for the detail modal.
 *
 * @returns SyncDetails object with formatted display values
 */
export const useSyncDetails = (): SyncDetails => {
  const { status, pendingCount, errorMessage, getTimeSinceLastSync } =
    useSyncStatusStore();

  const secondsElapsed = getTimeSinceLastSync();

  return {
    status,
    statusLabel: getStatusLabel(status),
    lastSyncLabel: formatElapsedTime(secondsElapsed),
    pendingCount,
    errorMessage,
    canRetry: status === 'error' || status === 'pending',
  };
};
