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
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository
  ) {}

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
