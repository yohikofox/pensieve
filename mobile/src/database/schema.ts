/**
 * Database Schema - SQLite DDL Statements
 *
 * Defines all tables and indexes for the Pensieve local database.
 * Using direct SQL for clarity, performance, and maintainability.
 *
 * Migration Strategy: Versioned migrations (see migrations.ts)
 */

export const SCHEMA_VERSION = 26;

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

export const CREATE_INDEX_CAPTURES_STATUS_CREATED_AT = `
  CREATE INDEX IF NOT EXISTS idx_captures_status_created_at
  ON captures(_status, created_at DESC)
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
 * Thoughts Table - AI-Generated Summaries (Knowledge Context)
 *
 * Story 5.1 - Subtask 1.1: thoughts table for Knowledge Context
 * Stores AI-generated summaries from captures
 */
export const CREATE_THOUGHTS_TABLE = `
  CREATE TABLE IF NOT EXISTS thoughts (
    id TEXT PRIMARY KEY NOT NULL,
    capture_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    confidence_score REAL,
    processing_time_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_THOUGHTS_CAPTURE_ID = `
  CREATE INDEX IF NOT EXISTS idx_thoughts_capture_id ON thoughts(capture_id)
`;

export const CREATE_INDEX_THOUGHTS_USER_ID = `
  CREATE INDEX IF NOT EXISTS idx_thoughts_user_id ON thoughts(user_id)
`;

/**
 * Ideas Table - Key Ideas Extracted from Thoughts (Knowledge Context)
 *
 * Story 5.1 - Subtask 1.1: ideas table for Knowledge Context
 * Stores individual key ideas extracted from thoughts
 */
export const CREATE_IDEAS_TABLE = `
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY NOT NULL,
    thought_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    order_index INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_IDEAS_THOUGHT_ID = `
  CREATE INDEX IF NOT EXISTS idx_ideas_thought_id ON ideas(thought_id)
`;

export const CREATE_INDEX_IDEAS_USER_ID = `
  CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id)
`;

/**
 * Todos Table - Actionable Tasks (Action Context)
 *
 * Story 5.1 - Subtask 1.1: Design Todo table schema for OP-SQLite
 * AC1, AC2, AC4: Todo entity with all required fields for inline display
 * Stores actionable tasks extracted from captures, linked to thoughts and ideas
 *
 * CRITICAL BUSINESS RULE (Issue #3 fix):
 * - idea_id CAN BE NULL for generic/orphan todos not linked to a specific idea
 * - Orphan todos (idea_id = NULL) are displayed at the THOUGHT level (not inline with ideas)
 * - When backend extracts todos from a capture, it MAY or MAY NOT link them to specific ideas
 * - Example: "Buy milk" (generic action) vs "Research competitor X" (linked to business idea)
 * - Queries MUST handle NULL idea_id appropriately (see TodoRepository)
 */
export const CREATE_TODOS_TABLE = `
  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY NOT NULL,
    thought_id TEXT NOT NULL,
    idea_id TEXT,                    -- NULLABLE: NULL = orphan todo (not linked to specific idea)
    capture_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('todo', 'completed', 'abandoned')) DEFAULT 'todo',
    description TEXT NOT NULL,
    deadline INTEGER,
    contact TEXT,
    priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE,
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE SET NULL,
    FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
  )
`;

/**
 * Performance Indexes for Todos
 * Subtask 1.4: Add indices on thoughtId, ideaId, status, priority
 */
export const CREATE_INDEX_TODOS_THOUGHT_ID = `
  CREATE INDEX IF NOT EXISTS idx_todos_thought_id ON todos(thought_id)
`;

export const CREATE_INDEX_TODOS_IDEA_ID = `
  CREATE INDEX IF NOT EXISTS idx_todos_idea_id ON todos(idea_id)
`;

export const CREATE_INDEX_TODOS_STATUS = `
  CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)
`;

export const CREATE_INDEX_TODOS_PRIORITY = `
  CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)
`;

export const CREATE_INDEX_TODOS_DEADLINE = `
  CREATE INDEX IF NOT EXISTS idx_todos_deadline ON todos(deadline)
`;

export const CREATE_INDEX_TODOS_USER_ID = `
  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
`;

/**
 * Analysis Todos Table - Association between capture_analysis and todos
 *
 * Links AI-generated action items (from capture_analysis) to their corresponding todos.
 * One table per source type pattern: analysis_todos links capture_analysis → todos.
 */
export const CREATE_ANALYSIS_TODOS_TABLE = `
  CREATE TABLE IF NOT EXISTS analysis_todos (
    todo_id TEXT NOT NULL,
    analysis_id TEXT NOT NULL,
    action_item_index INTEGER,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (todo_id, analysis_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (analysis_id) REFERENCES capture_analysis(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_ANALYSIS_TODOS_ANALYSIS_ID = `
  CREATE INDEX IF NOT EXISTS idx_analysis_todos_analysis_id ON analysis_todos(analysis_id)
`;

/**
 * Upload Queue Table - Audio File Upload Tracking
 *
 * Tracks audio file uploads to MinIO S3 storage with progress and retry logic.
 * Story 6.2 - Task 6.1: Large audio file upload queue
 */
export const CREATE_UPLOAD_QUEUE_TABLE = `
  CREATE TABLE IF NOT EXISTS upload_queue (
    id TEXT PRIMARY KEY NOT NULL,
    capture_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'uploading', 'completed', 'failed')),
    progress REAL DEFAULT 0.0,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
  )
`;

export const CREATE_INDEX_UPLOAD_QUEUE_STATUS = `
  CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status)
`;

export const CREATE_INDEX_UPLOAD_QUEUE_CAPTURE = `
  CREATE INDEX IF NOT EXISTS idx_upload_queue_capture ON upload_queue(capture_id)
`;

/**
 * Sync Metadata Table — ADR-022 compliance
 *
 * Replaces AsyncStorage usage in SyncStorage.ts (Story 14.2 — ADR-022 audit).
 * Stores per-entity sync timestamps and status for incremental sync protocol.
 */
export const CREATE_SYNC_METADATA_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_metadata (
    entity TEXT PRIMARY KEY NOT NULL,
    last_pulled_at INTEGER NOT NULL DEFAULT 0,
    last_pushed_at INTEGER NOT NULL DEFAULT 0,
    last_sync_status TEXT NOT NULL DEFAULT 'success'
      CHECK(last_sync_status IN ('success', 'error', 'in_progress')),
    last_sync_error TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  )
`;

export const CREATE_INDEX_SYNC_METADATA_ENTITY = `
  CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity ON sync_metadata(entity)
`;

/**
 * All schema DDL statements in execution order
 */
export const SCHEMA_DDL = [
  CREATE_CAPTURES_TABLE,
  CREATE_SYNC_QUEUE_TABLE,
  CREATE_INDEX_CAPTURES_CREATED_AT,
  CREATE_INDEX_CAPTURES_STATE,
  CREATE_INDEX_CAPTURES_STATUS_CREATED_AT,
  CREATE_INDEX_SYNC_QUEUE_ENTITY,
  CREATE_INDEX_SYNC_QUEUE_CREATED_AT,
  CREATE_SYNC_METADATA_TABLE,
  CREATE_INDEX_SYNC_METADATA_ENTITY,
];
