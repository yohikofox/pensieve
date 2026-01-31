/**
 * Capture Model - Plain TypeScript Interface
 *
 * Represents a polymorphic capture: audio | text | image | url
 * Part of Capture Context (Supporting Domain in DDD)
 *
 * @aggregate Capture
 * @events CaptureRecorded, CaptureNormalized
 *
 * Migration Note: Converted from WatermelonDB Model to plain interface for OP-SQLite
 */

export interface Capture {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Type of capture
   * Values: 'audio' | 'text' | 'image' | 'url'
   */
  type: string;

  /**
   * Current state of capture
   * Values: 'captured' | 'processing' | 'ready' | 'failed' | 'recording'
   */
  state: string;

  /**
   * Optional project association
   * Null for orphaned captures
   */
  projectId?: string | null;

  /**
   * Raw content reference
   * - Audio/Image: file path
   * - Text: string content
   * - URL: URL string
   */
  rawContent: string;

  /**
   * Normalized text after LLM post-processing
   * Falls back to rawTranscript if no post-processing applied
   * Null until transcription completes
   *
   * Note: Raw transcript is now stored in capture_metadata table (key: 'raw_transcript')
   */
  normalizedText?: string | null;

  /**
   * Timestamp when capture was created
   */
  capturedAt: Date;

  /**
   * Optional geolocation (stored as JSON string)
   * Format: { latitude: number, longitude: number }
   */
  location?: string | null;

  /**
   * Optional tags (stored as JSON array string)
   * Format: ["tag1", "tag2"]
   */
  tags?: string | null;

  /**
   * Audio duration in milliseconds
   * Null for non-audio captures
   */
  duration?: number | null;

  /**
   * File size in bytes
   * Null for text/URL captures
   */
  fileSize?: number | null;

  /**
   * Path to converted WAV file (debug mode only)
   * Null unless debug mode was enabled during transcription
   */
  wavPath?: string | null;

  /**
   * Retry tracking fields (Story 2.8 - Migration v14)
   * Used for transcription retry rate limiting (3 retries per 20-minute window)
   */
  retryCount?: number;
  retryWindowStartAt?: Date | null;
  lastRetryAt?: Date | null;
  transcriptionError?: string | null;

  /**
   * Auto-managed timestamps
   *
   * Note: Transcript prompt is now stored in capture_metadata table (key: 'transcript_prompt')
   */
  createdAt: Date;
  updatedAt: Date;

  /**
   * Sync metadata (optional, for custom sync)
   */
  syncVersion?: number;
  lastSyncAt?: Date | null;
  serverId?: string | null;
  conflictData?: string | null;
}

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
    type: row.type,
    state: row.state,
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
    retryWindowStartAt: row.retry_window_start_at ? new Date(row.retry_window_start_at) : null,
    lastRetryAt: row.last_retry_at ? new Date(row.last_retry_at) : null,
    transcriptionError: row.transcription_error,
  };
}
