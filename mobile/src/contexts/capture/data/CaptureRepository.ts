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

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../../../database';
import { type Capture, mapRowToCapture, type CaptureRow } from '../domain/Capture.model';
import { type RepositoryResult, success, databaseError } from '../domain/Result';
import { type ICaptureRepository } from '../domain/ICaptureRepository';
import { type ISyncQueueService } from '../domain/ISyncQueueService';
import { TOKENS } from '../../../infrastructure/di/tokens';

export interface CreateCaptureData {
  type: 'audio' | 'text' | 'image' | 'url';
  state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
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
  state?: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
  projectId?: string;
  rawContent?: string;
  normalizedText?: string;
  location?: string;
  tags?: string;
  duration?: number; // Audio duration in milliseconds
  fileSize?: number; // File size in bytes
}

@injectable()
export class CaptureRepository implements ICaptureRepository {
  constructor(
    @inject(TOKENS.ISyncQueueService) private syncQueueService: ISyncQueueService
  ) {}

  /**
   * Create a new Capture entity
   */
  async create(data: CreateCaptureData): Promise<RepositoryResult<Capture>> {
    const id = uuidv4();
    const now = Date.now();

    try {
      // Execute INSERT directly (SQLite has implicit transactions per statement)
      database.execute(
        `INSERT INTO captures (
          id, type, state, raw_content, duration, file_size,
          created_at, updated_at, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ]
      );

      // Select the created record
      const selectResult = database.execute('SELECT * FROM captures WHERE id = ?', [id]);
      const row = selectResult.rows?.[0] as CaptureRow;

      if (!row) {
        console.error('[CaptureRepository] Failed to create capture: record not found after INSERT');
        return databaseError('Failed to create capture');
      }

      const capture = mapRowToCapture(row);

      // Story 2.4 AC4: Add to sync queue automatically (all new captures need sync)
      try {
        await this.syncQueueService.enqueue(
          'capture',
          capture.id,
          'create',
          {
            type: capture.type,
            state: capture.state,
            rawContent: capture.rawContent,
            duration: capture.duration,
            fileSize: capture.fileSize,
          }
        );
        console.log('[CaptureRepository] Added to sync queue:', capture.id);
      } catch (queueError) {
        console.error('[CaptureRepository] Failed to add to sync queue:', queueError);
        // Don't fail the capture creation if queue fails
      }

      return success(capture);
    } catch (error) {
      console.error('[CaptureRepository] Database error during create:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return databaseError(`Failed to create capture: ${errorMessage}`);
    }
  }

  /**
   * Update an existing Capture entity
   */
  async update(id: string, updates: UpdateCaptureData): Promise<RepositoryResult<Capture>> {
    try {
      const now = Date.now();

      const fields: string[] = [];
      const values: any[] = [];

      if (updates.state !== undefined) {
        fields.push('state = ?');
        values.push(updates.state);
      }
      if (updates.rawContent !== undefined) {
        fields.push('raw_content = ?');
        values.push(updates.rawContent);
      }
      if (updates.duration !== undefined) {
        fields.push('duration = ?');
        values.push(updates.duration);
      }
      if (updates.fileSize !== undefined) {
        fields.push('file_size = ?');
        values.push(updates.fileSize);
      }

      fields.push('updated_at = ?');
      values.push(now);

      fields.push('sync_version = sync_version + 1');

      values.push(id);

      // Execute UPDATE directly (SQLite has implicit transactions per statement)
      database.execute(
        `UPDATE captures SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // Select the updated record
      const selectResult = database.execute('SELECT * FROM captures WHERE id = ?', [id]);
      const row = selectResult.rows?.[0] as CaptureRow;

      if (!row) {
        console.error('[CaptureRepository] Failed to update capture: not found after UPDATE', id);
        return databaseError(`Capture not found: ${id}`);
      }

      const capture = mapRowToCapture(row);
      return success(capture);
    } catch (error) {
      console.error('[CaptureRepository] Database error during update:', id, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      return databaseError(`Failed to update capture: ${errorMessage}`);
    }
  }

  /**
   * Find Capture by ID
   */
  async findById(id: string): Promise<Capture | null> {
    const result = database.execute('SELECT * FROM captures WHERE id = ?', [id]);

    const row = result.rows?.[0] as CaptureRow | undefined;
    return row ? mapRowToCapture(row) : null;
  }

  /**
   * Find all Captures
   */
  async findAll(): Promise<Capture[]> {
    const result = database.execute('SELECT * FROM captures ORDER BY created_at DESC');

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find Captures by state (RECORDING, CAPTURED, RECOVERED)
   */
  async findByState(state: string): Promise<Capture[]> {
    const result = database.execute(
      'SELECT * FROM captures WHERE state = ? ORDER BY created_at DESC',
      [state]
    );

    const rows = (result.rows ?? []) as CaptureRow[];
    return rows.map(mapRowToCapture);
  }

  /**
   * Find Captures by type (audio, text, image, url)
   */
  async findByType(type: string): Promise<Capture[]> {
    const result = database.execute(
      'SELECT * FROM captures WHERE type = ? ORDER BY created_at DESC',
      [type]
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
      database.execute('DELETE FROM captures WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      console.error('[CaptureRepository] Database error during delete:', id, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
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
       ORDER BY c.created_at DESC`
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
       ORDER BY c.created_at DESC`
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
       ORDER BY c.created_at DESC`
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
      [captureId]
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
      [captureId]
    );
    return (result.rows?.length ?? 0) > 0;
  }
}
