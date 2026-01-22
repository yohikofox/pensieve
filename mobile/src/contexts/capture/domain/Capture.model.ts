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
   * Normalized text after transcription
   * Null until transcription completes
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
   * Sync status for offline-first
   * Values: 'pending' | 'synced' | 'conflict'
   */
  syncStatus: string;

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
   * Auto-managed timestamps
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
 */
export interface CaptureRow {
  id: string;
  type: string;
  state: string;
  raw_content: string;
  duration: number | null;
  file_size: number | null;
  created_at: number;
  updated_at: number;
  sync_status: string;
  sync_version: number;
  last_sync_at: number | null;
  server_id: string | null;
  conflict_data: string | null;
}

/**
 * Map database row to domain model
 */
export function mapRowToCapture(row: CaptureRow): Capture {
  return {
    id: row.id,
    type: row.type,
    state: row.state,
    rawContent: row.raw_content,
    duration: row.duration,
    fileSize: row.file_size,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    capturedAt: new Date(row.created_at), // Same as createdAt for now
    syncStatus: row.sync_status,
    syncVersion: row.sync_version,
    lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : null,
    serverId: row.server_id,
    conflictData: row.conflict_data,
  };
}
