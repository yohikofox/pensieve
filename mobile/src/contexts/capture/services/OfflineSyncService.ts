/**
 * Offline Sync Service - Manage Offline Capture Queue
 *
 * Handles:
 * - Tracking captures pending sync
 * - Preparing captures for cloud synchronization
 * - WatermelonDB sync protocol compatibility
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC3: Offline Functionality
 * - Mark Capture entities for future sync
 * - Implement offline queue for pending captures
 * - Ensure WatermelonDB sync protocol compatibility
 *
 * NFR7: Disponibilité capture offline = 100%
 */

import { CaptureRepository } from '../data/CaptureRepository';

export interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  totalCount: number;
}

export interface PendingCapture {
  id: string;
  type: string;
  state: string;
  rawContent: string;
  capturedAt: Date;
}

/**
 * OfflineSyncService manages the offline queue of captures
 *
 * Usage pattern:
 * ```typescript
 * const service = new OfflineSyncService(repository);
 * const pending = await service.getPendingCaptures();
 * // ... sync to cloud ...
 * await service.markAsSynced(captureId);
 * ```
 */
export class OfflineSyncService {
  private repository: CaptureRepository;

  constructor(repository: CaptureRepository) {
    this.repository = repository;
  }

  /**
   * Get all captures pending synchronization
   *
   * Returns captures in 'captured' or 'ready' state with syncStatus: 'pending'
   */
  async getPendingCaptures(): Promise<PendingCapture[]> {
    try {
      const pendingCaptures = await this.repository.findBySyncStatus('pending');

      // Map to simplified interface for sync
      return pendingCaptures.map((capture) => ({
        id: capture.id,
        type: capture.type,
        state: capture.state,
        rawContent: capture.rawContent,
        capturedAt: capture.capturedAt,
      }));
    } catch (error) {
      console.error('[OfflineSync] Failed to get pending captures:', error);
      return [];
    }
  }

  /**
   * Mark a capture as successfully synced
   */
  async markAsSynced(captureId: string): Promise<void> {
    const result = await this.repository.update(captureId, {
      syncStatus: 'synced',
    });

    if (result.type === 'success') {
      console.log(`[OfflineSync] Marked capture ${captureId} as synced`);
    } else {
      console.error(
        `[OfflineSync] Failed to mark capture ${captureId} as synced:`,
        result.error
      );
    }
  }

  /**
   * Mark a capture as pending (retry after failed sync)
   */
  async markAsPending(captureId: string): Promise<void> {
    const result = await this.repository.update(captureId, {
      syncStatus: 'pending',
    });

    if (result.type === 'success') {
      console.log(`[OfflineSync] Marked capture ${captureId} as pending`);
    } else {
      console.error(
        `[OfflineSync] Failed to mark capture ${captureId} as pending:`,
        result.error
      );
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const allCaptures = await this.repository.findAll();
      const pendingCaptures = await this.repository.findBySyncStatus('pending');
      const syncedCaptures = await this.repository.findBySyncStatus('synced');

      return {
        pendingCount: pendingCaptures.length,
        syncedCount: syncedCaptures.length,
        totalCount: allCaptures.length,
      };
    } catch (error) {
      console.error('[OfflineSync] Failed to get sync stats:', error);
      return {
        pendingCount: 0,
        syncedCount: 0,
        totalCount: 0,
      };
    }
  }

  /**
   * Get captures ready for sync (captured state + pending sync)
   *
   * Filters out captures that are still recording or failed
   */
  async getReadyForSync(): Promise<PendingCapture[]> {
    try {
      const pendingCaptures = await this.getPendingCaptures();

      // Only return captures in 'captured' or 'ready' state
      return pendingCaptures.filter(
        (capture) => capture.state === 'captured' || capture.state === 'ready'
      );
    } catch (error) {
      console.error('[OfflineSync] Failed to get ready captures:', error);
      return [];
    }
  }

  /**
   * Check if there are any captures pending sync
   */
  async hasPendingSync(): Promise<boolean> {
    try {
      const pending = await this.repository.findBySyncStatus('pending');
      return pending.length > 0;
    } catch (error) {
      console.error('[OfflineSync] Failed to check pending sync:', error);
      return false;
    }
  }
}
