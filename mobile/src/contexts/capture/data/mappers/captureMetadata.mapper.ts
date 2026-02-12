/**
 * Capture Metadata Row Mapper - Data Access Layer
 *
 * Maps SQLite row (snake_case) to domain CaptureMetadata interface (camelCase).
 * Extracted from domain layer to respect Clean Architecture dependency rule.
 */

import type { CaptureMetadata } from "../../domain/CaptureMetadata.model";

/**
 * Database row type (snake_case from SQLite)
 */
export interface CaptureMetadataRow {
  id: string;
  capture_id: string;
  key: string;
  value: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Map database row to domain model
 */
export function mapRowToCaptureMetadata(
  row: CaptureMetadataRow,
): CaptureMetadata {
  return {
    id: row.id,
    captureId: row.capture_id,
    key: row.key,
    value: row.value,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
