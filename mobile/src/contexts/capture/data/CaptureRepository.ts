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

import { v4 as uuidv4 } from 'uuid';
import { database } from '../../../database';
import { type Capture, mapRowToCapture, type CaptureRow } from '../domain/Capture.model';
import { type RepositoryResult, success, databaseError } from '../domain/Result';

export interface CreateCaptureData {
  type: 'audio' | 'text' | 'image' | 'url';
  state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
  projectId?: string;
  rawContent: string;
  normalizedText?: string;
  capturedAt?: Date;
  location?: string; // JSON GeoPoint
  tags?: string; // JSON array
  syncStatus: 'pending' | 'synced';
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
  syncStatus?: 'pending' | 'synced';
  duration?: number; // Audio duration in milliseconds
  fileSize?: number; // File size in bytes
}

export class CaptureRepository {
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
          created_at, updated_at, sync_status, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.type,
          data.state,
          data.rawContent,
          data.duration ?? null,
          data.fileSize ?? null,
          now,
          now,
          data.syncStatus,
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
      if (updates.syncStatus !== undefined) {
        fields.push('sync_status = ?');
        values.push(updates.syncStatus);
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
   * Find Captures by syncStatus (pending, synced, failed)
   */
  async findBySyncStatus(syncStatus: string): Promise<Capture[]> {
    const result = database.execute(
      'SELECT * FROM captures WHERE sync_status = ? ORDER BY created_at DESC',
      [syncStatus]
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
    database.execute('DELETE FROM captures WHERE id = ?', [id]);
    return success(undefined);
  }

  /**
   * Permanently delete a Capture (bypass sync)
   *
   * Note: Same as delete() for now. Kept for API compatibility.
   */
  async destroyPermanently(id: string): Promise<RepositoryResult<void>> {
    return this.delete(id);
  }
}
