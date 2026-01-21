/**
 * Capture Repository - Data Access Layer
 *
 * WatermelonDB-based implementation for Capture aggregate
 *
 * Handles:
 * - CRUD operations on Capture entities
 * - Querying by state, syncStatus
 * - Offline-first persistence with WatermelonDB
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../../../database';
import { Capture } from '../domain/Capture.model';

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
  private collection = database.get<Capture>('captures');

  /**
   * Create a new Capture entity
   */
  async create(data: CreateCaptureData): Promise<Capture> {
    return await database.write(async () => {
      return await this.collection.create((capture) => {
        // Assign directly to _raw for reliable persistence
        capture._raw.type = data.type;
        capture._raw.state = data.state;
        capture._raw.project_id = data.projectId ?? null;
        capture._raw.raw_content = data.rawContent;
        capture._raw.normalized_text = data.normalizedText ?? null;
        capture._raw.captured_at = data.capturedAt ? data.capturedAt.getTime() : Date.now();
        capture._raw.location = data.location ?? null;
        capture._raw.tags = data.tags ?? null;
        capture._raw.sync_status = data.syncStatus;
        capture._raw.duration = data.duration ?? null;
        capture._raw.file_size = data.fileSize ?? null;
      });
    });
  }

  /**
   * Update an existing Capture entity
   */
  async update(id: string, updates: UpdateCaptureData): Promise<Capture> {
    return await database.write(async () => {
      const capture = await this.collection.find(id);

      return await capture.update((c) => {
        // Assign directly to _raw for reliable persistence
        if (updates.state !== undefined) c._raw.state = updates.state;
        if (updates.projectId !== undefined) c._raw.project_id = updates.projectId;
        if (updates.rawContent !== undefined) c._raw.raw_content = updates.rawContent;
        if (updates.normalizedText !== undefined) c._raw.normalized_text = updates.normalizedText;
        if (updates.location !== undefined) c._raw.location = updates.location;
        if (updates.tags !== undefined) c._raw.tags = updates.tags;
        if (updates.syncStatus !== undefined) c._raw.sync_status = updates.syncStatus;
        if (updates.duration !== undefined) c._raw.duration = updates.duration;
        if (updates.fileSize !== undefined) c._raw.file_size = updates.fileSize;
      });
    });
  }

  /**
   * Find Capture by ID
   */
  async findById(id: string): Promise<Capture | null> {
    try {
      return await this.collection.find(id);
    } catch (error) {
      // WatermelonDB throws if record not found
      return null;
    }
  }

  /**
   * Find all Captures
   */
  async findAll(): Promise<Capture[]> {
    return await this.collection.query().fetch();
  }

  /**
   * Find Captures by state (RECORDING, CAPTURED, RECOVERED)
   */
  async findByState(state: string): Promise<Capture[]> {
    return await this.collection
      .query(Q.where('state', state))
      .fetch();
  }

  /**
   * Find Captures by syncStatus (pending, synced, failed)
   */
  async findBySyncStatus(syncStatus: string): Promise<Capture[]> {
    return await this.collection
      .query(Q.where('sync_status', syncStatus))
      .fetch();
  }

  /**
   * Find Captures by type (audio, text, image, url)
   */
  async findByType(type: string): Promise<Capture[]> {
    return await this.collection
      .query(Q.where('type', type))
      .fetch();
  }

  /**
   * Delete a Capture
   */
  async delete(id: string): Promise<void> {
    await database.write(async () => {
      const capture = await this.collection.find(id);
      await capture.markAsDeleted(); // Soft delete for sync
    });
  }

  /**
   * Permanently delete a Capture (bypass sync)
   */
  async destroyPermanently(id: string): Promise<void> {
    await database.write(async () => {
      const capture = await this.collection.find(id);
      await capture.destroyPermanently();
    });
  }
}
