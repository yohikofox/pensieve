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

/**
 * Capture type enumeration
 */
export const CAPTURE_TYPES = {
  AUDIO: "audio",
  TEXT: "text",
  IMAGE: "image",
  URL: "url",
} as const;

export type CaptureType = (typeof CAPTURE_TYPES)[keyof typeof CAPTURE_TYPES];

/**
 * Capture state enumeration
 */
export const CAPTURE_STATES = {
  RECORDING: "recording",
  CAPTURED: "captured",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type CaptureState = (typeof CAPTURE_STATES)[keyof typeof CAPTURE_STATES];

export interface Capture {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Type of capture
   */
  type: CaptureType;

  /**
   * Current state of capture
   */
  state: CaptureState;

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
