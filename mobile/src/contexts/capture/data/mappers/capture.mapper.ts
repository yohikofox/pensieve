/**
 * Capture Row Mapper - Data Access Layer
 *
 * Maps SQLite row (snake_case) to domain Capture interface (camelCase).
 * Extracted from domain layer to respect Clean Architecture dependency rule.
 */

import type { Capture, CaptureType, CaptureState } from "../../domain/Capture.model";

/**
 * Database row type (snake_case from SQLite)
 * Note: sync status is now managed via sync_queue table (v2 architecture)
 * Note: raw_transcript and transcript_prompt moved to capture_metadata table (v10)
 */
export interface CaptureRow {
  id: string;
  type: string;
  state: string;
  raw_content: string;
  normalized_text: string | null;
  duration: number | null;
  file_size: number | null;
  wav_path: string | null;
  created_at: number;
  updated_at: number;
  sync_version: number;
  last_sync_at: number | null;
  server_id: string | null;
  conflict_data: string | null;
  // Retry tracking columns (Migration v14)
  retry_count: number;
  retry_window_start_at: number | null;
  last_retry_at: number | null;
  transcription_error: string | null;
}

/**
 * Map database row to domain model
 * Note: syncStatus is now queried separately via sync_queue table
 * Note: raw_transcript and transcript_prompt are now in capture_metadata table
 */
export function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    type: row.type as CaptureType,
    state: row.state as CaptureState,
    rawContent: row.raw_content,
    normalizedText: row.normalized_text,
    duration: row.duration,
    fileSize: row.file_size,
    wavPath: row.wav_path,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    capturedAt: new Date(row.created_at), // Same as createdAt for now
    syncVersion: row.sync_version,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
    serverId: row.server_id,
    conflictData: row.conflict_data,
    // Retry tracking fields (Migration v14)
    retryCount: row.retry_count,
    retryWindowStartAt: row.retry_window_start_at
      ? new Date(row.retry_window_start_at)
      : null,
    lastRetryAt: row.last_retry_at ? new Date(row.last_retry_at) : null,
    transcriptionError: row.transcription_error,
  };
}
