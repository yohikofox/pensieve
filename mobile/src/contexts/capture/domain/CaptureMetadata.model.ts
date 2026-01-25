/**
 * Capture Metadata Model
 *
 * Represents a key-value metadata entry associated with a Capture.
 * Used for storing transcription details, model information, prompts, etc.
 *
 * @aggregate Capture
 */

/**
 * Well-known metadata keys
 */
export const METADATA_KEYS = {
  // Transcription-related
  RAW_TRANSCRIPT: 'raw_transcript',
  TRANSCRIPT_PROMPT: 'transcript_prompt',
  WHISPER_MODEL: 'whisper_model',
  WHISPER_DURATION_MS: 'whisper_duration_ms',

  // LLM post-processing
  LLM_MODEL: 'llm_model',
  LLM_SYSTEM_PROMPT: 'llm_system_prompt',
  LLM_DURATION_MS: 'llm_duration_ms',

  // Processing info
  TOTAL_PROCESSING_DURATION_MS: 'total_processing_duration_ms',
} as const;

export type MetadataKey = (typeof METADATA_KEYS)[keyof typeof METADATA_KEYS] | string;

/**
 * Capture Metadata domain model
 */
export interface CaptureMetadata {
  id: string;
  captureId: string;
  key: MetadataKey;
  value: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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
export function mapRowToCaptureMetadata(row: CaptureMetadataRow): CaptureMetadata {
  return {
    id: row.id,
    captureId: row.capture_id,
    key: row.key,
    value: row.value,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Bulk set metadata input
 */
export interface SetMetadataInput {
  key: MetadataKey;
  value: string | null;
}
