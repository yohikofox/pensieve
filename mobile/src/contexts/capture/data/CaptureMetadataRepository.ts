/**
 * Capture Metadata Repository - Data Access Layer
 *
 * OP-SQLite-based implementation for CaptureMetadata storage.
 *
 * Handles:
 * - CRUD operations on CaptureMetadata entities
 * - Bulk set/get operations
 * - Key-value storage for flexible capture metadata
 */

import "reflect-metadata";
import { injectable } from "tsyringe";
import { v4 as uuidv4 } from "uuid";
import { database } from "../../../database";
import {
  type CaptureMetadata,
  type MetadataKey,
  type SetMetadataInput,
} from "../domain/CaptureMetadata.model";
import {
  type CaptureMetadataRow,
  mapRowToCaptureMetadata,
} from "./mappers/captureMetadata.mapper";
import type { ICaptureMetadataRepository } from "../domain/ICaptureMetadataRepository";

@injectable()
export class CaptureMetadataRepository implements ICaptureMetadataRepository {
  /**
   * Get a single metadata value by capture ID and key
   */
  async get(captureId: string, key: MetadataKey): Promise<string | null> {
    const result = database.execute(
      "SELECT value FROM capture_metadata WHERE capture_id = ? AND key = ?",
      [captureId, key],
    );

    const row = result.rows?.[0] as { value: string | null } | undefined;
    return row?.value ?? null;
  }

  /**
   * Get all metadata for a capture
   */
  async getAllForCapture(captureId: string): Promise<CaptureMetadata[]> {
    const result = database.execute(
      "SELECT * FROM capture_metadata WHERE capture_id = ? ORDER BY key ASC",
      [captureId],
    );

    const rows = (result.rows ?? []) as CaptureMetadataRow[];
    return rows.map(mapRowToCaptureMetadata);
  }

  /**
   * Get all metadata for a capture as a key-value map
   */
  async getAllAsMap(
    captureId: string,
  ): Promise<Record<string, CaptureMetadata>> {
    const metadata = await this.getAllForCapture(captureId);
    const map: Record<string, CaptureMetadata> = {};

    for (const item of metadata) {
      map[item.key] = item;
    }

    return map;
  }

  /**
   * Set a single metadata value (upsert)
   */
  async set(
    captureId: string,
    key: MetadataKey,
    value: string | null,
  ): Promise<void> {
    const now = Date.now();

    // Check if entry exists
    const existing = database.execute(
      "SELECT id FROM capture_metadata WHERE capture_id = ? AND key = ?",
      [captureId, key],
    );

    if (existing.rows && existing.rows.length > 0) {
      // Update existing
      database.execute(
        "UPDATE capture_metadata SET value = ?, updated_at = ? WHERE capture_id = ? AND key = ?",
        [value, now, captureId, key],
      );
    } else {
      // Insert new
      const id = uuidv4();
      database.execute(
        `INSERT INTO capture_metadata (id, capture_id, key, value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, captureId, key, value, now, now],
      );
    }
  }

  /**
   * Set multiple metadata values at once (upsert)
   */
  async setMany(
    captureId: string,
    metadata: SetMetadataInput[],
  ): Promise<void> {
    for (const item of metadata) {
      await this.set(captureId, item.key, item.value);
    }
  }

  /**
   * Delete a single metadata entry
   */
  async delete(captureId: string, key: MetadataKey): Promise<void> {
    database.execute(
      "DELETE FROM capture_metadata WHERE capture_id = ? AND key = ?",
      [captureId, key],
    );
  }

  /**
   * Delete all metadata for a capture
   */
  async deleteAllForCapture(captureId: string): Promise<void> {
    database.execute("DELETE FROM capture_metadata WHERE capture_id = ?", [
      captureId,
    ]);
  }
}
