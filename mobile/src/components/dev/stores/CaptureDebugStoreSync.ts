/**
 * CaptureDebugStoreSync - Synchronizes EventBus events to CaptureDebugStore
 *
 * Responsibility: Listen to capture domain events and update Zustand store
 * Lifecycle: Created/destroyed with CaptureDevTools component
 */

import type { Subscription } from 'rxjs';
import type { EventBus } from '../../../contexts/shared/events/EventBus';
import type { CaptureRecordedEvent, CaptureDeletedEvent } from '../../../contexts/capture/events/CaptureEvents';
import type { ICaptureRepository } from '../../../contexts/capture/domain/ICaptureRepository';
import type { IOfflineSyncService } from '../../../contexts/capture/domain/IOfflineSyncService';
import { database } from '../../../database';
import { useCaptureDebugStore, type CaptureDebugItem } from './captureDebugStore';

export class CaptureDebugStoreSync {
  private subscriptions: Subscription[] = [];
  private isRunning = false;

  constructor(
    private eventBus: EventBus,
    private repository: ICaptureRepository,
    private syncService: IOfflineSyncService
  ) {}

  /**
   * Start listening to capture events and sync to store
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[CaptureDebugStoreSync] Already running');
      return;
    }

    // Initial load from repository
    await this.loadInitialState();

    // Subscribe to domain events
    this.subscriptions = [
      this.eventBus.subscribe<CaptureRecordedEvent>('CaptureRecorded', (event) =>
        this.handleCaptureRecorded(event)
      ),
      this.eventBus.subscribe<CaptureDeletedEvent>('CaptureDeleted', (event) =>
        this.handleCaptureDeleted(event)
      ),
    ];

    this.isRunning = true;
    console.log('[CaptureDebugStoreSync] ✅ Started syncing capture events to store');
  }

  /**
   * Stop listening and cleanup
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions = [];
    this.isRunning = false;

    console.log('[CaptureDebugStoreSync] 🛑 Stopped syncing');
  }

  /**
   * Load initial state from repository
   * Public for manual refresh support
   */
  async loadInitialState(): Promise<void> {
    try {
      const captures = await this.repository.findAll();

      // Get pending sync IDs from sync_queue table
      const pendingSyncIds = this.getPendingSyncIds();

      const debugItems = captures.map((capture) =>
        this.mapToDebugItem(capture, pendingSyncIds)
      );
      useCaptureDebugStore.getState().setCaptures(debugItems);

      // Load sync stats
      const stats = await this.syncService.getSyncStats();
      useCaptureDebugStore.getState().setSyncStats({
        pending: stats.pendingCount,
        synced: stats.syncedCount,
        total: stats.totalCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load captures';
      useCaptureDebugStore.getState().setError(message);
    }
  }

  /**
   * Handle CaptureRecorded event
   */
  private async handleCaptureRecorded(event: CaptureRecordedEvent): Promise<void> {
    // Reload capture from repository to get full data
    try {
      const capture = await this.repository.findById(event.payload.captureId);
      if (capture) {
        const pendingSyncIds = this.getPendingSyncIds();
        const debugItem = this.mapToDebugItem(capture, pendingSyncIds);
        useCaptureDebugStore.getState().addCapture(debugItem);

        // Refresh sync stats
        const stats = await this.syncService.getSyncStats();
        useCaptureDebugStore.getState().setSyncStats({
          pending: stats.pendingCount,
          synced: stats.syncedCount,
          total: stats.totalCount,
        });
      }
    } catch (error) {
      console.error('[CaptureDebugStoreSync] Failed to handle CaptureRecorded:', error);
    }
  }

  /**
   * Handle CaptureDeleted event
   */
  private handleCaptureDeleted(event: CaptureDeletedEvent): void {
    useCaptureDebugStore.getState().removeCapture(event.payload.captureId);
  }

  /**
   * Get IDs of captures pending sync from sync_queue table
   */
  private getPendingSyncIds(): Set<string> {
    const db = database.getDatabase();
    const result = db.executeSync(
      `SELECT entity_id FROM sync_queue WHERE entity_type = 'capture'`
    );
    const ids = new Set<string>();
    if (result.rows) {
      for (const row of result.rows) {
        ids.add((row as any).entity_id);
      }
    }
    return ids;
  }

  /**
   * Map domain capture to debug display item
   */
  private mapToDebugItem(capture: any, pendingSyncIds: Set<string>): CaptureDebugItem {
    // Determine sync status: present in sync_queue = pending, absent = synced
    const syncStatus = pendingSyncIds.has(capture.id) ? 'pending' : 'synced';

    return {
      id: capture.id,
      type: capture.type,
      state: capture.state,
      rawContent: capture.rawContent,
      duration: capture.duration,
      createdAt: capture.createdAt,
      syncStatus,
    };
  }
}
