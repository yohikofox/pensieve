/**
 * Database Schema - SQLite DDL Statements
 *
 * Defines all tables and indexes for the Pensieve local database.
 * Using direct SQL for clarity, performance, and maintainability.
 *
 * Migration Strategy: Versioned migrations (see migrations.ts)
 */

export const SCHEMA_VERSION = 14;

/**
 * Captures Table - Audio and Text Captures
 *
 * Stores all user captures with offline-first architecture.
 * Sync fields enable custom synchronization with backend.
 */
export const CREATE_CAPTURES_TABLE = `
  CREATE TABLE IF NOT EXISTS captures (
    -- Primary identifiers
    id TEXT PRIMARY KEY NOT NULL,

    -- Capture metadata
    type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
    state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'failed')),

    -- Content
    raw_content TEXT,              -- File path (audio) or text content
    normalized_text TEXT,          -- Transcription result (audio) or normalized text
    duration INTEGER,              -- Milliseconds (audio only)
    file_size INTEGER,             -- Bytes (audio only)

    -- Timestamps (Unix milliseconds)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    -- Sync fields (for custom backend sync)
    -- Note: sync status is managed via sync_queue table (presence = pending, absence = synced)
    sync_version INTEGER NOT NULL DEFAULT 0,
    last_sync_at INTEGER,
    server_id TEXT,                -- Backend ID if different from local ID
    conflict_data TEXT             -- JSON of conflicting server data
  );
`;

/**
 * Sync Queue Table - Offline Operations Queue
 *
 * Stores pending operations to be synced with backend when online.
 * Enables reliable offline-first architecture with retry logic.
 *
 * FK Constraint: entity_id references captures(id) for referential integrity
 * Operation types: 'create'/'update'/'delete' for sync, 'conflict' for conflicts
 */
export const CREATE_SYNC_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Entity reference
    entity_type TEXT NOT NULL,     -- 'capture' | 'user' | 'settings'
    entity_id TEXT NOT NULL,

    -- Operation
    operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
    payload TEXT NOT NULL,         -- JSON serialized entity data

    -- Retry management
    created_at INTEGER NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- Foreign key for referential integrity
    FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
  );
`;

/**
 * Performance Indexes
 * Note: Each index must be a separate statement for OP-SQLite
 * Note: sync_status index removed in v2 (status is now managed via sync_queue table)
 */
export const CREATE_INDEX_CAPTURES_CREATED_AT = `
  CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)
`;

export const CREATE_INDEX_CAPTURES_STATE = `
  CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)
`;

export const CREATE_INDEX_SYNC_QUEUE_ENTITY = `
  CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)
`;

export const CREATE_INDEX_SYNC_QUEUE_CREATED_AT = `
  CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)
`;

/**
 * Capture Metadata Table - Key-Value Store for Capture Metadata
 *
 * Stores flexible metadata for captures (transcription details, models used, etc.)
 * Each row represents a single key-value pair associated with a capture.
 */
export const CREATE_CAPTURE_METADATA_TABLE = `
  CREATE TABLE IF NOT EXISTS capture_metadata (
    id TEXT PRIMARY KEY NOT NULL,
    capture_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_CAPTURE_METADATA_CAPTURE_ID = `
  CREATE INDEX IF NOT EXISTS idx_capture_metadata_capture_id ON capture_metadata(capture_id)
`;

export const CREATE_INDEX_CAPTURE_METADATA_CAPTURE_KEY = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_metadata_capture_key ON capture_metadata(capture_id, key)
`;

/**
 * Capture Analysis Table - LLM Analysis Results
 *
 * Stores analysis results for captures (summary, highlights, action_items).
 * Each capture can have multiple analysis entries, one per type.
 */
export const CREATE_CAPTURE_ANALYSIS_TABLE = `
  CREATE TABLE IF NOT EXISTS capture_analysis (
    id TEXT PRIMARY KEY NOT NULL,
    capture_id TEXT NOT NULL,
    analysis_type TEXT NOT NULL CHECK(analysis_type IN ('summary', 'highlights', 'action_items', 'ideas')),
    content TEXT NOT NULL,
    model_id TEXT,
    processing_duration_ms INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_CAPTURE_ANALYSIS_CAPTURE_ID = `
  CREATE INDEX IF NOT EXISTS idx_capture_analysis_capture_id ON capture_analysis(capture_id)
`;

export const CREATE_INDEX_CAPTURE_ANALYSIS_CAPTURE_TYPE = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_analysis_capture_type ON capture_analysis(capture_id, analysis_type)
`;

/**
 * All schema DDL statements in execution order
 */
export const SCHEMA_DDL = [
  CREATE_CAPTURES_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_INDEX_CAPTURES_CREATED_AT,
  CREATE_INDEX_CAPTURES_STATE,
  CREATE_INDEX_SYNC_QUEUE_ENTITY,
  CREATE_INDEX_SYNC_QUEUE_CREATED_AT,
];
