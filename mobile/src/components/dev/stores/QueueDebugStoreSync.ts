/**
 * QueueDebugStoreSync - Synchronizes EventBus events to QueueDebugStore
 *
 * Responsibility: Listen to queue domain events and update Zustand store
 * Lifecycle: Created/destroyed with TranscriptionQueueDebug component
 * Architecture: Single Responsibility = EventBus → Store sync
 *
 * Usage:
 * ```typescript
 * useEffect(() => {
 *   const sync = new QueueDebugStoreSync(eventBus, database);
 *   sync.start();
 *   return () => sync.stop();
 * }, []);
 * ```
 */

import type { Subscription } from 'rxjs';
import type { EventBus } from '../../../contexts/shared/events/EventBus';
import type { Database } from '../../../database';
import {
  QueueItemAddedEvent,
  QueueItemStartedEvent,
  QueueItemCompletedEvent,
  QueueItemFailedEvent,
  QueueItemRemovedEvent,
  QueuePausedChangedEvent,
} from '../../../contexts/Normalization/events/QueueEvents';
import { useQueueDebugStore, type QueueItem, type QueueStats } from './queueDebugStore';

export class QueueDebugStoreSync {
  private subscriptions: Subscription[] = [];
  private isRunning = false;

  constructor(
    private eventBus: EventBus,
    private database: Database
  ) {}

  /**
   * Start listening to queue events and sync to store
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[QueueDebugStoreSync] Already running');
      return;
    }

    // Initial load from DB
    this.loadInitialState();

    // Subscribe to domain events
    this.subscriptions = [
      this.eventBus.subscribe<QueueItemAddedEvent>('QueueItemAdded', (event) =>
        this.handleItemAdded(event)
      ),
      this.eventBus.subscribe<QueueItemStartedEvent>('QueueItemStarted', (event) =>
        this.handleItemStarted(event)
      ),
      this.eventBus.subscribe<QueueItemCompletedEvent>('QueueItemCompleted', (event) =>
        this.handleItemCompleted(event)
      ),
      this.eventBus.subscribe<QueueItemFailedEvent>('QueueItemFailed', (event) =>
        this.handleItemFailed(event)
      ),
      this.eventBus.subscribe<QueueItemRemovedEvent>('QueueItemRemoved', (event) =>
        this.handleItemRemoved(event)
      ),
      this.eventBus.subscribe<QueuePausedChangedEvent>('QueuePausedChanged', (event) =>
        this.handlePausedChanged(event)
      ),
    ];

    this.isRunning = true;
    console.log('[QueueDebugStoreSync] ✅ Started syncing queue events to store');
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

    console.log('[QueueDebugStoreSync] 🛑 Stopped syncing');
  }

  /**
   * Load initial state from DB
   */
  private loadInitialState(): void {
    const db = this.database.getDatabase();

    // Load items
    const itemsResult = db.executeSync(
      'SELECT * FROM transcription_queue ORDER BY created_at ASC'
    );
    const items = (itemsResult.rows || []) as QueueItem[];
    useQueueDebugStore.getState().setItems(items);

    // Load stats
    const stats = this.calculateStats(db);
    useQueueDebugStore.getState().setStats(stats);
  }

  /**
   * Calculate queue statistics from DB
   */
  private calculateStats(db: any): QueueStats {
    const statsResult = db.executeSync(
      `SELECT
        COUNT(*) as total_in_db,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM transcription_queue`
    );
    const statsRow = statsResult.rows?.[0];

    const pauseResult = db.executeSync(
      `SELECT value FROM app_settings WHERE key = 'transcription_queue_paused'`
    );
    const pauseState = pauseResult.rows?.[0];
    const isPaused = pauseState?.value === '1';

    const currentPending = Number(statsRow?.pending || 0);
    const currentProcessing = Number(statsRow?.processing || 0);
    const currentCompleted = Number(statsRow?.completed || 0);
    const currentFailed = Number(statsRow?.failed || 0);

    const inQueue = currentPending + currentProcessing;
    const totalProcessed = currentCompleted + currentFailed;

    return {
      total: inQueue,
      pending: currentPending,
      processing: currentProcessing,
      completed: currentCompleted,
      failed: currentFailed,
      isPaused,
      totalProcessed,
    };
  }

  /**
   * Refresh stats from DB after any change
   */
  private refreshStats(): void {
    const db = this.database.getDatabase();
    const stats = this.calculateStats(db);
    useQueueDebugStore.getState().setStats(stats);
  }

  /**
   * Event Handlers
   */

  private handleItemAdded(event: QueueItemAddedEvent): void {
    // Reload from DB to get complete row data
    const db = this.database.getDatabase();
    const result = db.executeSync(
      'SELECT * FROM transcription_queue WHERE capture_id = ?',
      [event.payload.captureId]
    );

    if (result.rows && result.rows.length > 0) {
      const item = result.rows[0] as QueueItem;
      useQueueDebugStore.getState().addItem(item);
      this.refreshStats();
    }
  }

  private handleItemStarted(event: QueueItemStartedEvent): void {
    useQueueDebugStore.getState().updateItem(event.payload.captureId, {
      status: 'processing',
      updated_at: event.payload.timestamp,
    });
    this.refreshStats();
  }

  private handleItemCompleted(event: QueueItemCompletedEvent): void {
    useQueueDebugStore.getState().updateItem(event.payload.captureId, {
      status: 'completed',
      updated_at: event.payload.timestamp,
    });
    this.refreshStats();
  }

  private handleItemFailed(event: QueueItemFailedEvent): void {
    useQueueDebugStore.getState().updateItem(event.payload.captureId, {
      status: 'failed',
      updated_at: event.payload.timestamp,
    });
    this.refreshStats();
  }

  private handleItemRemoved(event: QueueItemRemovedEvent): void {
    useQueueDebugStore.getState().removeItem(event.payload.captureId);
    this.refreshStats();
  }

  private handlePausedChanged(event: QueuePausedChangedEvent): void {
    this.refreshStats();
  }
}
