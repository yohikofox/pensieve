/**
 * Capture Repository - Data Access Layer
 *
 * OP-SQLite-based implementation for Capture aggregate
 *
 * Handles:
 * - CRUD operations on Capture entities
 * - Querying by state, syncStatus
 * - Offline-first persistence with OP-SQLite
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Migration: WatermelonDB → OP-SQLite
 */

import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { v4 as uuidv4 } from "uuid";
import { database } from "../../../database";
import {
  type Capture,
  type CaptureType,
  type CaptureState,
  CAPTURE_TYPES,
  CAPTURE_STATES,
} from "../domain/Capture.model";
import { mapRowToCapture, type CaptureRow } from "./mappers/capture.mapper";
import {
  type RepositoryResult,
  RepositoryResultType,
  success,
  databaseError,
} from "../domain/Result";
import { type ICaptureRepository } from "../domain/ICaptureRepository";
import { type ISyncQueueService } from "../domain/ISyncQueueService";
import { TOKENS } from "../../../infrastructure/di/tokens";
import type { EventBus } from "../../shared/events/EventBus";
import type {
  CaptureRecordedEvent,
  CaptureDeletedEvent,
} from "../events/CaptureEvents";
import { SyncTrigger } from "../../../infrastructure/sync/SyncTrigger";

export interface CreateCaptureData {
  type: CaptureType;
  state: CaptureState;
  projectId?: string;
  rawContent: string;
  normalizedText?: string;
  capturedAt?: Date;
  location?: string; // JSON GeoPoint
  tags?: string; // JSON array
  duration?: number; // Audio duration in milliseconds
  fileSize?: number; // File size in bytes
}

export interface UpdateCaptureData {
  state?: CaptureState;
  projectId?: string;
  rawContent?: string;
  normalizedText?: string;
  location?: string;
  tags?: string;
  duration?: number; // Audio duration in milliseconds
  fileSize?: number; // File size in bytes
  wavPath?: string | null; // Path to debug WAV file (debug mode only)
  // Note: rawTranscript and transcriptPrompt are now in capture_metadata table
}

@injectable()
export class CaptureRepository implements ICaptureRepository {
  constructor(
    @inject(TOKENS.ISyncQueueService)
    private syncQueueService: ISyncQueueService,
    @inject("EventBus") private eventBus: EventBus,
    @inject(SyncTrigger) private syncTrigger: SyncTrigger,
  ) {}

  /**
   * Create a new Capture entity
   */
  async create(data: CreateCaptureData): Promise<RepositoryResult<Capture>> {
    const id = uuidv4();
    const now = Date.now();

    try {
      // Execute INSERT directly (SQLite has implicit transactions per statement)
      // Story 6.2 Task 4.2: SET _changed = 1 for sync tracking
      database.execute(
        `INSERT INTO captures (
          id, type, state, raw_content, duration, file_size,
          created_at, updated_at, sync_version, _changed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          data.type,
          data.state,
          data.rawContent,
          data.duration ?? null,
          data.fileSize ?? null,
          now,
          now,
          0,
        ],
      );

      // Select the created record
      const selectResult = database.execute(
        "SELECT * FROM captures WHERE id = ?",
        [id],
      );
      const row = selectResult.rows?.[0] as CaptureRow;

      if (!row) {
        console.error(
          "[CaptureRepository] Failed to create capture: record not found after INSERT",
        );
        return databaseError("Failed to create capture");
      }

      const capture = mapRowToCapture(row);

      // Story 2.4 AC4: Add to sync queue automatically (all new captures need sync)
      // TODO ADR-023: syncQueueService should return Result<number> instead of throwing
      try {
        await this.syncQueueService.enqueue("capture", capture.id, "create", {
          type: capture.type,
          state: capture.state,
          rawContent: capture.rawContent,
          duration: capture.duration,
          fileSize: capture.fileSize,
        });
        console.log("[CaptureRepository] Added to sync queue:", capture.id);
      } catch (queueError) {
        console.error(
          "[CaptureRepository] Failed to add to sync queue:",
          queueError,
        );
        // Don't fail the capture creation if queue fails
      }

      // Story 6.2 Task 3.3: Trigger real-time sync after save (AC3)
      // ADR-023 Fix: SyncTrigger now returns Result<void>
      const syncResult = this.syncTrigger.queueSync({ entity: 'captures' });
      if (syncResult.type === RepositoryResultType.SUCCESS) {
        console.log("[CaptureRepository] Triggered auto-sync (debounced 3s)");
      } else {
        console.error(
          "[CaptureRepository] Failed to trigger sync:",
          syncResult.error,
        );
      }

      // Story 2.5: Publish CaptureRecorded event (ADR-019)
      // IMPORTANT: Only publish if state='captured' (not 'recording')
      // Audio captures start with state='recording' and transition to 'captured' on stopRecording()
      // We only want to trigger transcription when the capture is fully completed
      console.log(
        "[CaptureRepository] create() - Capture state:",
        capture.state,
        "type:",
        capture.type,
      );
      if (capture.state === CAPTURE_STATES.CAPTURED) {
        // TODO ADR-023: EventBus should return Result<void> instead of throwing
        // EventBus is a custom wrapper around RxJS Subject, should implement Result Pattern
        try {
          console.log(
            "[CaptureRepository] 🔔 Publishing CaptureRecorded event for capture:",
            capture.id,
          );
          const event: CaptureRecordedEvent = {
            type: "CaptureRecorded",
            timestamp: Date.now(),
            payload: {
              captureId: capture.id,
              captureType: capture.type,
              audioPath:
                capture.type === CAPTURE_TYPES.AUDIO ? capture.rawContent : undefined,
              audioDuration: capture.duration ?? undefined,
              textContent:
                capture.type === CAPTURE_TYPES.TEXT ? capture.rawContent : undefined,
              createdAt: capture.createdAt.getTime(),
            },
          };
          console.log(
            "[CaptureRepository] Event payload:",
            JSON.stringify(event.payload),
          );
          this.eventBus.publish(event);
          console.log(
            "[CaptureRepository] ✅ Published CaptureRecorded event:",
            capture.id,
          );
        } catch (eventError) {
          console.error(
            "[CaptureRepository] ❌ Failed to publish CaptureRecorded event:",
            eventError,
          );
          // Don't fail the capture creation if event publish fails
        }
      } else {
        console.log(
          '[CaptureRepository] ⏭️  Skipping event publish (state is not "captured")',
        );
      }

      return success(capture);
    } catch (error) {
      console.error("[CaptureRepository] Database error during create:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown database error";
      return databaseError(`Failed to create capture: ${errorMessage}`);
    }
  }

  /**
   * Update an existing Capture entity
   */
  async update(
    id: string,
    updates: UpdateCaptureData,
  ): Promise<RepositoryResult<Capture>> {
    try {
      const now = Date.now();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.state !== undefined) {
        fields.push("state = ?");
        values.push(updates.state);
      }
      if (updates.rawContent !== undefined) {
        fields.push("raw_content = ?");
        values.push(updates.rawContent);
      }
      if (updates.duration !== undefined) {
        fields.push("duration = ?");
        values.push(updates.duration);
      }
      if (updates.fileSize !== undefined) {
        fields.push("file_size = ?");
        values.push(updates.fileSize);
      }
      if (updates.normalizedText !== undefined) {
        fields.push("normalized_text = ?");
        values.push(updates.normalizedText);
      }
      if (updates.wavPath !== undefined) {
        fields.push("wav_path = ?");
        values.push(updates.wavPath);
      }

      fields.push("updated_at = ?");
      values.push(now);

      fields.push("sync_version = sync_version + 1");

      // Story 6.2 Task 4.2: SET _changed = 1 for sync tracking
      fields.push("_changed = 1");

      values.push(id);

      // Execute UPDATE directly (SQLite has implicit transactions per statement)
      database.execute(
        `UPDATE captures SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );

      // Select the updated record
      const selectResult = database.execute(
        "SELECT * FROM captures WHERE id = ?",
        [id],
      );
      const row = selectResult.rows?.[0] as CaptureRow;

      if (!row) {
        console.error(
          "[CaptureRepository] Failed to update capture: not found after UPDATE",
          id,
        );
        return databaseError(`Capture not found: ${id}`);
      }

      const capture = mapRowToCapture(row);

      // Story 2.5: Publish CaptureRecorded event when transitioning to 'captured' state
      // This happens when stopRecording() updates the capture from 'recording' to 'captured'
      console.log(
        "[CaptureRepository] update() - New state:",
        updates.state,
        "type:",
        capture.type,
      );
      if (updates.state === CAPTURE_STATES.CAPTURED) {
        try {
          console.log(
            "[CaptureRepository] 🔔 Publishing CaptureRecorded event for capture:",
            capture.id,
          );
          const event: CaptureRecordedEvent = {
            type: "CaptureRecorded",
            timestamp: Date.now(),
            payload: {
              captureId: capture.id,
              captureType: capture.type,
              audioPath:
                capture.type === CAPTURE_TYPES.AUDIO ? capture.rawContent : undefined,
              audioDuration: capture.duration ?? undefined,
              textContent:
                capture.type === CAPTURE_TYPES.TEXT ? capture.rawContent : undefined,
              createdAt: capture.createdAt.getTime(),
            },
          };
          console.log(
            "[CaptureRepository] Event payload:",
            JSON.stringify(event.payload),
          );
          this.eventBus.publish(event);
          console.log(
            "[CaptureRepository] ✅ Published CaptureRecorded event:",
            capture.id,
          );
        } catch (eventError) {
          console.error(
            "[CaptureRepository] ❌ Failed to publish CaptureRecorded event:",
            eventError,
          );
          // Don't fail the update if event publish fails
        }
      } else {
        console.log(
          '[CaptureRepository] ⏭️  Skipping event publish (state update is not "captured")',
        );
      }

      // Story 6.2 Task 3.3: Trigger real-time sync after update (AC3)
      try {
        this.syncTrigger.queueSync({ entity: 'captures' });
        console.log("[CaptureRepository] Triggered auto-sync (debounced 3s)");
      } catch (syncTriggerError) {
        console.error(
          "[CaptureRepository] Failed to trigger sync:",
          syncTriggerError,
        );
        // Don't fail the update if sync trigger fails
      }

      return success(capture);
    } catch (error) {
      console.error(
        "[CaptureRepository] Database error during update:",
        id,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown database error";
      return databaseError(`Failed to update capture: ${errorMessage}`);
    }
  }

  /**
   * Find Capture by ID
   */
  async findById(id: string): Promise<Capture | null> {
    const result = database.execute("SELECT * FROM captures WHERE id = ?", [
      id,
    ]);

    const row = result.rows?.[0] as CaptureRow | undefined;
    return row ? mapRowToCapture(row) : null;
  }

  /**
   * Find all Captures
   */
  async findAll(): Promise<Capture[]> {
    // Story 6.3 - Task 5.4: Filter deleted items from UI
    // Perf: uses composite index idx_captures_status_created_at (_status, created_at DESC)
    const result = database.execute(
      "SELECT * FROM captures WHERE _status = 'active' ORDER BY created_at DESC",
    );

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find all Captures with pagination (Story 3.1 - AC4)
   * @param limit - Number of captures to return
   * @param offset - Number of captures to skip
   */
  async findAllPaginated(limit: number, offset: number): Promise<Capture[]> {
    // Story 6.3 - Task 5.4: Filter deleted items from UI
    // Perf: uses composite index idx_captures_status_created_at (_status, created_at DESC)
    const result = database.execute(
      "SELECT * FROM captures WHERE _status = 'active' ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Get total count of captures (Story 3.1 - for pagination)
   */
  async count(): Promise<number> {
    // Story 6.3 - Task 5.4: Filter deleted items from count
    // Perf: uses composite index idx_captures_status_created_at (_status, created_at DESC)
    const result = database.execute("SELECT COUNT(*) as count FROM captures WHERE _status = 'active'");
    const row = result.rows?.[0] as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Find Captures by state (RECORDING, CAPTURED, RECOVERED)
   */
  async findByState(state: string): Promise<Capture[]> {
    const result = database.execute(
      "SELECT * FROM captures WHERE state = ? ORDER BY created_at DESC",
      [state],
    );

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find Captures by type (audio, text, image, url)
   */
  async findByType(type: string): Promise<Capture[]> {
    const result = database.execute(
      "SELECT * FROM captures WHERE type = ? ORDER BY created_at DESC",
      [type],
    );

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Delete a Capture
   *
   * Note: For now, this is a hard delete. In the future, we can implement
   * soft delete by adding a deleted_at column.
   */
  async delete(id: string): Promise<RepositoryResult<void>> {
    try {
      // Fetch capture before deleting (needed for CaptureDeleted event)
      const capture = await this.findById(id);

      database.execute("DELETE FROM captures WHERE id = ?", [id]);

      // Story 2.5: Publish CaptureDeleted event (ADR-019)
      if (capture) {
        try {
          const event: CaptureDeletedEvent = {
            type: "CaptureDeleted",
            timestamp: Date.now(),
            payload: {
              captureId: capture.id,
              captureType: capture.type,
              audioPath:
                capture.type === CAPTURE_TYPES.AUDIO ? capture.rawContent : undefined,
            },
          };
          this.eventBus.publish(event);
          console.log(
            "[CaptureRepository] Published CaptureDeleted event:",
            capture.id,
          );
        } catch (eventError) {
          console.error(
            "[CaptureRepository] Failed to publish CaptureDeleted event:",
            eventError,
          );
          // Don't fail the delete if event publish fails
        }
      }

      return success(undefined);
    } catch (error) {
      console.error(
        "[CaptureRepository] Database error during delete:",
        id,
        error,
      );
      const errorMessage =
        error instanceof Error ? error.message : "Unknown database error";
      return databaseError(`Failed to delete capture: ${errorMessage}`);
    }
  }

  /**
   * Permanently delete a Capture (bypass sync)
   *
   * Note: Same as delete() for now. Kept for API compatibility.
   */
  async destroyPermanently(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }

  /**
   * Find captures pending synchronization
   * Returns captures that exist in sync_queue with operation IN ('create', 'update', 'delete')
   */
  async findPendingSync(): Promise<Capture[]> {
    const result = database.execute(
      `SELECT c.* FROM captures c
       INNER JOIN sync_queue sq ON c.id = sq.entity_id
       WHERE sq.entity_type = 'capture'
         AND sq.operation IN ('create', 'update', 'delete')
       ORDER BY c.created_at DESC`,
    );
    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find captures that are already synchronized
   * Returns captures that do NOT exist in sync_queue
   */
  async findSynced(): Promise<Capture[]> {
    const result = database.execute(
      `SELECT c.* FROM captures c
       WHERE NOT EXISTS (
         SELECT 1 FROM sync_queue sq
         WHERE sq.entity_id = c.id
           AND sq.entity_type = 'capture'
           AND sq.operation IN ('create', 'update', 'delete')
       )
       ORDER BY c.created_at DESC`,
    );
    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find captures with synchronization conflicts
   * Returns captures that exist in sync_queue with operation = 'conflict'
   */
  async findConflicts(): Promise<Capture[]> {
    const result = database.execute(
      `SELECT c.* FROM captures c
       INNER JOIN sync_queue sq ON c.id = sq.entity_id
       WHERE sq.entity_type = 'capture'
         AND sq.operation = 'conflict'
       ORDER BY c.created_at DESC`,
    );
    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Check if a capture is pending synchronization
   */
  async isPendingSync(captureId: string): Promise<boolean> {
    const result = database.execute(
      `SELECT 1 FROM sync_queue
       WHERE entity_type = 'capture'
         AND entity_id = ?
         AND operation IN ('create', 'update', 'delete')
       LIMIT 1`,
      [captureId],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Check if a capture has a synchronization conflict
   */
  async hasConflict(captureId: string): Promise<boolean> {
    const result = database.execute(
      `SELECT 1 FROM sync_queue
       WHERE entity_type = 'capture'
         AND entity_id = ?
         AND operation = 'conflict'
       LIMIT 1`,
      [captureId],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Observe a Capture by ID - emits on state changes
   * Story 3.2 - AC5: Live Transcription Updates
   *
   * Simple polling-based Observable implementation for OP-SQLite
   * Polls database every 500ms for changes to the capture
   */
  observeById(id: string): {
    subscribe: (observer: (value: Capture | null) => void) => {
      unsubscribe: () => void;
    };
  } {
    return {
      subscribe: (observer: (value: Capture | null) => void) => {
        // Emit initial value immediately
        this.findById(id)
          .then(observer)
          .catch(() => observer(null));

        // Poll for updates every 500ms
        const interval = setInterval(async () => {
          try {
            const capture = await this.findById(id);
            observer(capture);
          } catch (error) {
            // Silently handle errors during polling
            observer(null);
          }
        }, 500);

        return {
          unsubscribe: () => {
            clearInterval(interval);
          },
        };
      },
    };
  }
}
