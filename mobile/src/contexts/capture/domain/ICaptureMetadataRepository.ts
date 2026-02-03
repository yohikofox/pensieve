/**
 * Capture Metadata Repository Interface
 *
 * Defines data access operations for CaptureMetadata entities.
 */

import type { CaptureMetadata, MetadataKey, SetMetadataInput } from './CaptureMetadata.model';

export interface ICaptureMetadataRepository {
  /**
   * Get a single metadata value by capture ID and key
   */
  get(captureId: string, key: MetadataKey): Promise<string | null>;

  /**
   * Get all metadata for a capture
   */
  getAllForCapture(captureId: string): Promise<CaptureMetadata[]>;

  /**
   * Get all metadata for a capture as a key-value map
   */
  getAllAsMap(captureId: string): Promise<Record<string, CaptureMetadata>>;

  /**
   * Set a single metadata value (upsert)
   */
  set(captureId: string, key: MetadataKey, value: string | null): Promise<void>;

  /**
   * Set multiple metadata values at once (upsert)
   */
  setMany(captureId: string, metadata: SetMetadataInput[]): Promise<void>;

  /**
   * Delete a single metadata entry
   */
  delete(captureId: string, key: MetadataKey): Promise<void>;

  /**
   * Delete all metadata for a capture
   */
  deleteAllForCapture(captureId: string): Promise<void>;
}
