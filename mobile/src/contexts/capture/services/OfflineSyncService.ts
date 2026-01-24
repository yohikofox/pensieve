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
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { type ICaptureRepository } from '../domain/ICaptureRepository';
import { type ISyncQueueService } from '../domain/ISyncQueueService';
import {
  type IOfflineSyncService,
  type SyncStats,
  type PendingCapture,
} from '../domain/IOfflineSyncService';

/**
 * OfflineSyncService manages the offline queue of captures
 *
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve<IOfflineSyncService>(TOKENS.IOfflineSyncService);
 * const pending = await service.getPendingCaptures();
 * // ... sync to cloud ...
 * await service.markAsSynced(captureId);
 * ```
 */
@injectable()
export class OfflineSyncService implements IOfflineSyncService {
  constructor(
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository,
    @inject(TOKENS.ISyncQueueService) private syncQueueService: ISyncQueueService
  ) {}

  /**
   * Get all captures pending synchronization
   *
   * Returns captures that exist in sync_queue
   */
  async getPendingCaptures(): Promise<PendingCapture[]> {
    try {
      const pendingCaptures = await this.repository.findPendingSync();

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
   * Removes all pending sync queue items for this capture
   */
  async markAsSynced(captureId: string): Promise<void> {
    try {
      // Get all pending queue items for this capture
      const queueItems = await this.syncQueueService.getPendingOperationsForEntity(
        'capture',
        captureId
      );

      // Mark each queue item as synced (removes from queue)
      for (const item of queueItems) {
        await this.syncQueueService.markAsSynced(item.id);
      }

      console.log(`[OfflineSync] Marked capture ${captureId} as synced (removed ${queueItems.length} queue items)`);
    } catch (error) {
      console.error(
        `[OfflineSync] Failed to mark capture ${captureId} as synced:`,
        error
      );
    }
  }

  /**
   * Mark a capture as pending (retry after failed sync)
   * Adds the capture back to the sync queue
   */
  async markAsPending(captureId: string): Promise<void> {
    try {
      // Get the capture to add to queue
      const capture = await this.repository.findById(captureId);
      if (!capture) {
        console.error(`[OfflineSync] Cannot mark as pending: capture ${captureId} not found`);
        return;
      }

      // Add to sync queue
      await this.syncQueueService.enqueue(
        'capture',
        capture.id,
        'update', // Use 'update' for retry
        {
          type: capture.type,
          state: capture.state,
          rawContent: capture.rawContent,
          duration: capture.duration,
          fileSize: capture.fileSize,
        }
      );

      console.log(`[OfflineSync] Marked capture ${captureId} as pending (added to queue)`);
    } catch (error) {
      console.error(
        `[OfflineSync] Failed to mark capture ${captureId} as pending:`,
        error
      );
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    try {
      const allCaptures = await this.repository.findAll();
      const pendingCaptures = await this.repository.findPendingSync();
      const syncedCaptures = await this.repository.findSynced();

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
      const pending = await this.repository.findPendingSync();
      return pending.length > 0;
    } catch (error) {
      console.error('[OfflineSync] Failed to check pending sync:', error);
      return false;
    }
  }
}
