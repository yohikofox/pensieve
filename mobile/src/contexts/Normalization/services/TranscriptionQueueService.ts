import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { database, type DB } from "../../../database";
import type { EventBus } from "../../shared/events/EventBus";
import { useSettingsStore } from "../../../stores/settingsStore";
import type {
  QueueItemAddedEvent,
  QueueItemStartedEvent,
  QueueItemCompletedEvent,
  QueueItemFailedEvent,
  QueueItemRemovedEvent,
} from "../events/QueueEvents";

export interface QueuedCapture {
  id: string;
  captureId: string;
  audioPath: string;
  audioDuration?: number;
  status: "pending" | "processing" | "failed";
  retryCount: number;
  lastError?: string;
  createdAt: Date;
  startedAt?: Date;
}

interface QueueRow {
  id: string;
  capture_id: string;
  audio_path: string;
  audio_duration: number | null;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  started_at: number | null;
}

/**
 * Map database row to QueuedCapture domain object
 */
function mapRowToQueuedCapture(row: QueueRow): QueuedCapture {
  return {
    id: row.id,
    captureId: row.capture_id,
    audioPath: row.audio_path,
    audioDuration: row.audio_duration || undefined,
    status: row.status as "pending" | "processing" | "failed",
    retryCount: row.retry_count,
    lastError: row.last_error || undefined,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
  };
}

/**
 * Generate unique ID for queue entries
 */
function generateId(): string {
  return `tq_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Service to manage FIFO queue of pending transcriptions
 *
 * Responsibilities:
 * - Maintain queue of captures awaiting transcription (OP-SQLite persistence)
 * - Process captures in FIFO order (first in, first out)
 * - Support pause/resume for app backgrounding (DB flags)
 * - Prevent duplicate queue entries (UNIQUE constraint)
 * - Crash-proof: All state persisted in DB (ADR-022)
 * - Publish domain events after DB operations (event-driven architecture)
 */
@injectable()
export class TranscriptionQueueService {
  private db: DB;

  constructor(@inject("EventBus") private eventBus: EventBus) {
    this.db = database.getDatabase();
  }

  /**
   * Add a capture to the transcription queue (DB insert)
   *
   * Prevents duplicates (UNIQUE constraint on capture_id)
   *
   * @param capture - Capture to queue for transcription
   */
  async enqueue(capture: {
    captureId: string;
    audioPath: string;
    audioDuration?: number;
  }): Promise<void> {
    // Check for existing entry (idempotent)
    const existing = this.db.executeSync(
      "SELECT id FROM transcription_queue WHERE capture_id = ?",
      [capture.captureId],
    );

    if (existing.rows && existing.rows.length > 0) {
      // Already queued, skip
      return;
    }

    const queueId = generateId();
    const timestamp = Date.now();

    // Insert into DB
    this.db.executeSync(
      `INSERT INTO transcription_queue (
        id, capture_id, audio_path, audio_duration, status, retry_count, created_at
      ) VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      [
        queueId,
        capture.captureId,
        capture.audioPath,
        capture.audioDuration || null,
        timestamp,
      ],
    );

    console.log(`[TranscriptionQueueService] ✅ Enqueued capture ${capture.captureId} (queueId: ${queueId})`);

    // Publish event (event-driven architecture)
    const event: QueueItemAddedEvent = {
      type: "QueueItemAdded",
      payload: {
        captureId: capture.captureId,
        audioPath: capture.audioPath,
        audioDuration: capture.audioDuration || null,
        queueId,
        timestamp,
      },
    };
    this.eventBus.publish(event);
  }

  /**
   * Get next capture from queue (FIFO from DB)
   *
   * Marks as 'processing' and returns the first pending capture.
   *
   * @returns Next capture or null if queue empty
   */
  async getNextCapture(): Promise<QueuedCapture | null> {
    // Debug: Check queue state (only in debug mode)
    if (useSettingsStore.getState().debugMode) {
      const countResult = this.db.executeSync(
        `SELECT status, COUNT(*) as count FROM transcription_queue GROUP BY status`
      );
      if (countResult.rows && countResult.rows.length > 0) {
        const statuses = countResult.rows.map((r: any) => `${r.status}: ${r.count}`).join(', ');
        console.log(`[TranscriptionQueueService] Queue state: ${statuses}`);
      }
    }

    // Get first pending capture (FIFO order)
    const result = this.db.executeSync(
      `SELECT * FROM transcription_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as QueueRow;
    const timestamp = Date.now();

    // Mark as processing (UPDATE instead of DELETE)
    this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'processing', updated_at = ?
       WHERE id = ?`,
      [timestamp, row.id],
    );

    console.log(
      "[TranscriptionQueueService] 📝 Marked capture as processing:",
      row.capture_id,
    );

    // Publish event
    const event: QueueItemStartedEvent = {
      type: "QueueItemStarted",
      payload: {
        captureId: row.capture_id,
        queueId: row.id,
        timestamp,
      },
    };
    this.eventBus.publish(event);

    return mapRowToQueuedCapture(row);
  }

  /**
   * Mark capture as completed
   *
   * @param captureId - ID of the capture to mark as completed
   */
  async markCompleted(captureId: string): Promise<void> {
    const timestamp = Date.now();

    // Get queue ID before update
    const result = this.db.executeSync(
      "SELECT id FROM transcription_queue WHERE capture_id = ?",
      [captureId],
    );
    const queueId = result.rows?.[0]?.id;

    this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'completed', updated_at = ?
       WHERE capture_id = ?`,
      [timestamp, captureId],
    );
    console.log(
      "[TranscriptionQueueService] ✅ Marked capture as completed:",
      captureId,
    );

    // Publish event
    if (queueId) {
      const event: QueueItemCompletedEvent = {
        type: "QueueItemCompleted",
        payload: {
          captureId,
          queueId,
          timestamp,
        },
      };
      this.eventBus.publish(event);
    }
  }

  /**
   * Mark capture as failed
   *
   * @param captureId - ID of the capture to mark as failed
   */
  async markFailed(
    captureId: string,
    error: string = "Unknown error",
  ): Promise<void> {
    const timestamp = Date.now();

    // Get queue ID and retry count before update
    const result = this.db.executeSync(
      "SELECT id, retry_count FROM transcription_queue WHERE capture_id = ?",
      [captureId],
    );
    const row = result.rows?.[0];
    const queueId = row?.id;
    const retryCount = (row?.retry_count || 0) + 1;

    this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'failed', retry_count = retry_count + 1, updated_at = ?, last_error = ?
       WHERE capture_id = ?`,
      [timestamp, error, captureId],
    );
    console.log(
      "[TranscriptionQueueService] ❌ Marked capture as failed:",
      captureId,
    );

    // Publish event
    if (queueId) {
      const event: QueueItemFailedEvent = {
        type: "QueueItemFailed",
        payload: {
          captureId,
          queueId,
          error,
          retryCount,
          timestamp,
        },
      };
      this.eventBus.publish(event);
    }
  }

  /**
   * Remove a specific capture from the queue (DB delete)
   *
   * @param captureId - ID of capture to remove
   */
  async remove(captureId: string): Promise<void> {
    this.db.executeSync(
      "DELETE FROM transcription_queue WHERE capture_id = ?",
      [captureId],
    );

    // Publish event
    const event: QueueItemRemovedEvent = {
      type: "QueueItemRemoved",
      payload: {
        captureId,
        timestamp: Date.now(),
      },
    };
    this.eventBus.publish(event);
  }

  /**
   * Retry failed capture (reset to pending)
   *
   * @param queueId - Queue entry ID
   */
  async retryFailed(queueId: string): Promise<void> {
    this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'pending',
           started_at = NULL
       WHERE id = ?`,
      [queueId],
    );
  }

  /**
   * Retry failed capture by captureId (reset to pending)
   *
   * @param captureId - Capture ID
   * @returns true if retry was successful, false if capture not found in queue
   */
  async retryFailedByCaptureId(captureId: string): Promise<boolean> {
    const result = this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'pending',
           started_at = NULL,
           retry_count = retry_count + 1
       WHERE capture_id = ? AND status = 'failed'`,
      [captureId],
    );

    const success = (result.rowsAffected ?? 0) > 0;

    if (success) {
      // Also reset capture state back to 'captured' for re-processing
      this.db.executeSync(
        `UPDATE captures SET state = 'captured' WHERE id = ?`,
        [captureId],
      );

      console.log(
        `[TranscriptionQueueService] 🔄 Retrying failed capture: ${captureId}`,
      );
    }

    return success;
  }

  /**
   * Reset stuck items on startup (crash recovery)
   *
   * Resets:
   * - 'processing' items back to 'pending' (orphaned from crash/restart)
   * - 'failed' items back to 'pending' if retry count < MAX_RETRIES
   *
   * Also resets corresponding capture states.
   *
   * @returns Number of items reset
   */
  async resetStuckItems(): Promise<number> {
    const MAX_RETRIES = 3;
    let resetCount = 0;

    // 1. Reset orphaned 'processing' items (from crash/restart)
    const processingResult = this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'pending', started_at = NULL
       WHERE status = 'processing'`,
    );
    const processingReset = processingResult.rowsAffected ?? 0;
    resetCount += processingReset;

    if (processingReset > 0) {
      console.log(`[TranscriptionQueueService] 🔄 Reset ${processingReset} orphaned 'processing' items`);

      // Reset corresponding capture states
      this.db.executeSync(
        `UPDATE captures SET state = 'captured'
         WHERE id IN (SELECT capture_id FROM transcription_queue WHERE status = 'pending')
         AND state = 'processing'`,
      );
    }

    // 2. Reset 'failed' items with low retry count
    const failedResult = this.db.executeSync(
      `UPDATE transcription_queue
       SET status = 'pending', started_at = NULL
       WHERE status = 'failed' AND retry_count < ?`,
      [MAX_RETRIES],
    );
    const failedReset = failedResult.rowsAffected ?? 0;
    resetCount += failedReset;

    if (failedReset > 0) {
      console.log(`[TranscriptionQueueService] 🔄 Reset ${failedReset} 'failed' items for retry`);

      // Reset corresponding capture states
      this.db.executeSync(
        `UPDATE captures SET state = 'captured'
         WHERE id IN (SELECT capture_id FROM transcription_queue WHERE status = 'pending')
         AND state = 'failed'`,
      );
    }

    // 3. Remove completed items (cleanup)
    const completedResult = this.db.executeSync(
      `DELETE FROM transcription_queue WHERE status = 'completed'`,
    );
    const completedRemoved = completedResult.rowsAffected ?? 0;

    if (completedRemoved > 0) {
      console.log(`[TranscriptionQueueService] 🧹 Cleaned up ${completedRemoved} completed items`);
    }

    return resetCount;
  }

  /**
   * Pause queue processing (DB flag)
   *
   * Call when app is backgrounding to suspend transcription.
   */
  async pause(): Promise<void> {
    this.db.executeSync(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
       VALUES ('transcription_queue_paused', '1', ?)`,
      [Date.now()],
    );
  }

  /**
   * Resume queue processing (DB flag)
   *
   * Call when app returns to foreground to resume transcription.
   */
  async resume(): Promise<void> {
    this.db.executeSync(
      `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
       VALUES ('transcription_queue_paused', '0', ?)`,
      [Date.now()],
    );
  }

  /**
   * Check if queue is paused (DB flag)
   *
   * @returns true if paused, false if active
   */
  async isPaused(): Promise<boolean> {
    const result = this.db.executeSync(
      "SELECT value FROM app_settings WHERE key = ?",
      ["transcription_queue_paused"],
    );

    if (!result.rows || result.rows.length === 0) {
      return false; // Default: not paused
    }

    return result.rows[0].value === "1";
  }

  /**
   * Get number of captures in queue (DB count)
   *
   * @returns Queue length
   */
  async getQueueLength(): Promise<number> {
    const result = this.db.executeSync(
      "SELECT COUNT(*) as count FROM transcription_queue WHERE status = 'pending'",
    );

    if (!result.rows || result.rows.length === 0) {
      return 0;
    }

    return Number(result.rows[0].count) || 0;
  }

  /**
   * Clear all captures from queue (DB delete)
   */
  async clear(): Promise<void> {
    this.db.executeSync("DELETE FROM transcription_queue");
  }
}
