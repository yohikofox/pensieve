/**
 * Offline Sync Service Interface
 *
 * Defines contract for offline capture queue management.
 * Handles tracking and synchronization of pending captures.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

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

export interface IOfflineSyncService {
  /**
   * Get all captures pending synchronization
   */
  getPendingCaptures(): Promise<PendingCapture[]>;

  /**
   * Mark a capture as successfully synced
   */
  markAsSynced(captureId: string): Promise<void>;

  /**
   * Mark a capture as pending (retry after failed sync)
   */
  markAsPending(captureId: string): Promise<void>;

  /**
   * Get sync statistics
   */
  getSyncStats(): Promise<SyncStats>;
}
