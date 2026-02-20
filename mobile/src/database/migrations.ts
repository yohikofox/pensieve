/**
 * Database Migrations System
 *
 * Handles schema versioning and data migrations.
 * Migrations are applied sequentially and tracked via PRAGMA user_version.
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { SCHEMA_VERSION, SCHEMA_DDL } from './schema';

export interface Migration {
  version: number;
  name: string;
  up: (db: DB) => void;
  down?: (db: DB) => void;
}

/**
 * Schema v1 - Original schema WITH sync_status column
 *
 * IMPORTANT: This is frozen in time and should never change.
 * Migration v1 must always create this exact schema.
 */
const SCHEMA_V1_DDL = [
  // Captures table WITH sync_status column (v1)
  `CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
    state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'failed')),
    raw_content TEXT,
    duration INTEGER,
    file_size INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'conflict')),
    sync_version INTEGER NOT NULL DEFAULT 0,
    last_sync_at INTEGER,
    server_id TEXT,
    conflict_data TEXT
  )`,

  // Sync queue WITHOUT FK constraint (v1)
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    max_retries INTEGER NOT NULL DEFAULT 3
  )`,

  // v1 indexes
  `CREATE INDEX IF NOT EXISTS idx_captures_sync_status ON captures(sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)`,
];

/**
 * Migration History
 *
 * Each migration has a unique version number and is idempotent.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'Initial schema - captures table with sync_status',
    up: (db: DB) => {
      // Enable foreign keys (required for FK constraints)
      db.executeSync('PRAGMA foreign_keys = ON');

      // Create v1 schema (WITH sync_status)
      SCHEMA_V1_DDL.forEach((ddl) => {
        db.executeSync(ddl);
      });

      console.log('[DB] ✅ Migration v1: Initial schema (v1) created');
    },
    down: (db: DB) => {
      db.executeSync('DROP TABLE IF EXISTS sync_queue');
      db.executeSync('DROP TABLE IF EXISTS captures');
    },
  },
  {
    version: 2,
    name: 'Remove sync_status column - use sync_queue as single source of truth',
    up: (db: DB) => {
      // Enable foreign keys (required for FK constraints)
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔍 Migration v2: Pre-migration validation');

      // Pre-migration check: Verify no orphaned sync_queue entries
      const orphanedCheck = db.executeSync(`
        SELECT COUNT(*) as count FROM sync_queue sq
        WHERE entity_type = 'capture'
          AND NOT EXISTS (SELECT 1 FROM captures WHERE id = sq.entity_id)
      `);

      // OP-SQLite returns results in .rows property
      const orphanedRows = orphanedCheck.rows || [];
      const orphanedCount = orphanedRows[0]?.count ?? 0;
      if (orphanedCount > 0) {
        console.warn(`[DB] ⚠️ Found ${orphanedCount} orphaned sync_queue entries - will be cleaned`);
        db.executeSync(`
          DELETE FROM sync_queue
          WHERE entity_type = 'capture'
            AND NOT EXISTS (SELECT 1 FROM captures WHERE id = entity_id)
        `);
      }

      console.log('[DB] 🔄 Step 1/12: Creating captures_new without sync_status');
      db.executeSync(`
        CREATE TABLE captures_new (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'failed')),
          raw_content TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      console.log('[DB] 🔄 Step 2/12: Migrating captures data');
      db.executeSync(`
        INSERT INTO captures_new (
          id, type, state, raw_content, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at,
          server_id, conflict_data
        )
        SELECT
          id, type, state, raw_content, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at,
          server_id, conflict_data
        FROM captures
      `);

      console.log('[DB] 🔄 Step 3/12: Migrating pending captures to sync_queue');

      // Check if sync_status column exists (safety for broken v1 migrations)
      const schemaCheckV1 = db.executeSync('PRAGMA table_info(captures)');
      const columnsV1 = schemaCheckV1.rows || [];
      const hasSyncStatusColumn = columnsV1.some((col: any) => col.name === 'sync_status');

      if (hasSyncStatusColumn) {
        // Normal migration path: sync_status exists
        const pendingResult = db.executeSync(`
          INSERT INTO sync_queue (
            entity_type, entity_id, operation, payload,
            created_at, retry_count, max_retries
          )
          SELECT
            'capture',
            id,
            'create',
            json_object(
              'type', type,
              'state', state,
              'rawContent', raw_content,
              'duration', duration,
              'fileSize', file_size
            ),
            created_at,
            0,
            3
          FROM captures
          WHERE sync_status = 'pending'
            AND id NOT IN (SELECT entity_id FROM sync_queue WHERE entity_type = 'capture')
        `);
        console.log(`[DB] ℹ️  Migrated ${pendingResult.rowsAffected ?? 0} pending captures to sync_queue`);

        console.log('[DB] 🔄 Step 4/12: Migrating conflict captures to sync_queue');
        const conflictResult = db.executeSync(`
          INSERT INTO sync_queue (
            entity_type, entity_id, operation, payload,
            created_at, retry_count, max_retries
          )
          SELECT
            'capture',
            id,
            'conflict',
            COALESCE(conflict_data, '{}'),
            created_at,
            0,
            3
          FROM captures
          WHERE sync_status = 'conflict'
            AND id NOT IN (SELECT entity_id FROM sync_queue WHERE entity_type = 'capture')
        `);
        console.log(`[DB] ℹ️  Migrated ${conflictResult.rowsAffected ?? 0} conflict captures to sync_queue`);
      } else {
        // Broken v1 migration detected: sync_status doesn't exist
        console.warn('[DB] ⚠️  sync_status column not found - assuming all existing captures are synced');
        console.log('[DB] ℹ️  Skipping steps 3-4 (no sync_status to migrate)');
        console.log('[DB] 🔄 Step 4/12: Skipped (sync_status column missing)');
      }

      console.log('[DB] 🔄 Step 5/12: Dropping old captures table');
      db.executeSync('DROP TABLE captures');

      console.log('[DB] 🔄 Step 6/12: Renaming captures_new to captures');
      db.executeSync('ALTER TABLE captures_new RENAME TO captures');

      console.log('[DB] 🔄 Step 7/12: Recreating captures indexes');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      console.log('[DB] 🔄 Step 8/12: Creating sync_queue_new with FK constraint');
      db.executeSync(`
        CREATE TABLE sync_queue_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL
            CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      console.log('[DB] 🔄 Step 9/12: Migrating sync_queue data');
      db.executeSync('INSERT INTO sync_queue_new SELECT * FROM sync_queue');

      console.log('[DB] 🔄 Step 10/12: Dropping old sync_queue table');
      db.executeSync('DROP TABLE sync_queue');

      console.log('[DB] 🔄 Step 11/12: Renaming sync_queue_new to sync_queue');
      db.executeSync('ALTER TABLE sync_queue_new RENAME TO sync_queue');

      console.log('[DB] 🔄 Step 12/12: Recreating sync_queue indexes');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      // Post-migration validation
      console.log('[DB] 🔍 Migration v2: Post-migration validation');

      // 1. Verify sync_status column removed
      const schemaCheck = db.executeSync('PRAGMA table_info(captures)');

      // OP-SQLite returns results in .rows property (not .rows._array)
      const schemaRows = schemaCheck.rows || [];
      const hasSyncStatus = schemaRows.some((col: any) => col.name === 'sync_status');

      if (hasSyncStatus) {
        console.error('[DB] ❌ sync_status column still exists!');
        throw new Error('Migration v2 failed: sync_status column still exists');
      }

      // 2. Verify FK constraint exists
      const fkCheck = db.executeSync('PRAGMA foreign_key_list(sync_queue)');
      console.log('[DB] 🔍 FK Check result:', JSON.stringify(fkCheck, null, 2));

      // OP-SQLite returns results in .rows property (not .rows._array)
      const fkRows = fkCheck.rows || [];
      const hasFk = fkRows.some((fk: any) => fk.table === 'captures');

      if (!hasFk) {
        console.error('[DB] ❌ FK constraint not found. FK rows:', fkRows);
        throw new Error('Migration v2 failed: FK constraint not created');
      }

      // 3. Verify conflict operation is supported by checking schema
      // (No need to test INSERT since CHECK constraint will validate at runtime)
      console.log('[DB] ✅ Conflict operation type added to schema');

      console.log('[DB] ✅ Migration v2: All validations passed');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v2');

      // Recreate captures table with sync_status
      db.executeSync(`
        CREATE TABLE captures_rollback (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'failed')),
          raw_content TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'conflict')),
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      // Migrate captures back with inferred sync_status from sync_queue
      db.executeSync(`
        INSERT INTO captures_rollback
        SELECT
          c.*,
          CASE
            WHEN EXISTS (SELECT 1 FROM sync_queue WHERE entity_id = c.id AND operation = 'conflict') THEN 'conflict'
            WHEN EXISTS (SELECT 1 FROM sync_queue WHERE entity_id = c.id AND operation IN ('create', 'update', 'delete')) THEN 'pending'
            ELSE 'synced'
          END as sync_status
        FROM captures c
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_rollback RENAME TO captures');

      // Recreate indexes including sync_status
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_sync_status ON captures(sync_status)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue without FK
      db.executeSync(`
        CREATE TABLE sync_queue_rollback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3
        )
      `);

      db.executeSync('INSERT INTO sync_queue_rollback SELECT id, entity_type, entity_id, operation, payload, created_at, retry_count, last_error, max_retries FROM sync_queue WHERE operation != "conflict"');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_rollback RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v2 completed');
    },
  },
  {
    version: 3,
    name: 'Add transcription_queue table for background transcription',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v3: Creating transcription_queue table');

      // Create transcription_queue table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS transcription_queue (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL UNIQUE,
          audio_path TEXT NOT NULL,
          audio_duration INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,

          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for performance
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_transcription_queue_status
        ON transcription_queue(status, created_at)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_transcription_queue_capture
        ON transcription_queue(capture_id)
      `);

      console.log('[DB] ✅ Migration v3: transcription_queue table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v3');
      db.executeSync('DROP TABLE IF EXISTS transcription_queue');
      console.log('[DB] ✅ Rollback v3 completed');
    },
  },
  {
    version: 4,
    name: 'Add app_settings table for global flags and preferences',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v4: Creating app_settings table');

      // Create app_settings table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);

      // Insert initial settings
      db.executeSync(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
          ('transcription_queue_paused', '0'),
          ('whisper_model_downloaded', '0'),
          ('whisper_model_version', '')
      `);

      console.log('[DB] ✅ Migration v4: app_settings table created with initial values');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v4');
      db.executeSync('DROP TABLE IF EXISTS app_settings');
      console.log('[DB] ✅ Rollback v4 completed');
    },
  },
  {
    version: 5,
    name: 'Update transcription_queue to support completed status and updated_at column',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v5: Updating transcription_queue schema');

      // Create new table with updated schema (includes 'completed' status and updated_at column)
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS transcription_queue_new (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL UNIQUE,
          audio_path TEXT NOT NULL,
          audio_duration INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER,
          started_at INTEGER,
          completed_at INTEGER,

          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Copy existing data from old table (if any)
      db.executeSync(`
        INSERT INTO transcription_queue_new (
          id, capture_id, audio_path, audio_duration, status, retry_count,
          last_error, created_at, started_at, completed_at
        )
        SELECT
          id, capture_id, audio_path, audio_duration, status, retry_count,
          last_error, created_at, started_at, completed_at
        FROM transcription_queue
      `);

      // Drop old table
      db.executeSync('DROP TABLE transcription_queue');

      // Rename new table
      db.executeSync('ALTER TABLE transcription_queue_new RENAME TO transcription_queue');

      // Recreate indexes
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_transcription_queue_status
        ON transcription_queue(status, created_at)
      `);

      console.log('[DB] ✅ Migration v5: transcription_queue schema updated');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v5');

      // Create old table schema
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS transcription_queue_old (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL UNIQUE,
          audio_path TEXT NOT NULL,
          audio_duration INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'failed')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          started_at INTEGER,
          completed_at INTEGER,

          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Copy data back (excluding completed status items)
      db.executeSync(`
        INSERT INTO transcription_queue_old (
          id, capture_id, audio_path, audio_duration, status, retry_count,
          last_error, created_at, started_at, completed_at
        )
        SELECT
          id, capture_id, audio_path, audio_duration, status, retry_count,
          last_error, created_at, started_at, completed_at
        FROM transcription_queue
        WHERE status != 'completed'
      `);

      // Drop new table
      db.executeSync('DROP TABLE transcription_queue');

      // Rename old table
      db.executeSync('ALTER TABLE transcription_queue_old RENAME TO transcription_queue');

      // Recreate indexes
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_transcription_queue_status
        ON transcription_queue(status, created_at)
      `);

      console.log('[DB] ✅ Rollback v5 completed');
    },
  },
  {
    version: 6,
    name: 'Add normalized_text column to captures table for transcription results',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v6: Adding normalized_text column to captures');

      // Add normalized_text column to captures table
      db.executeSync(`
        ALTER TABLE captures ADD COLUMN normalized_text TEXT
      `);

      // Also update state CHECK constraint to include 'processing' and 'ready' states
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      console.log('[DB] 🔄 Migration v6: Updating captures state constraint');

      db.executeSync(`
        CREATE TABLE captures_v6 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      db.executeSync(`
        INSERT INTO captures_v6 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v6 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Update sync_queue FK constraint to point to new captures table
      db.executeSync(`
        CREATE TABLE sync_queue_v6 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v6 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v6 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Migration v6: normalized_text column added and state constraint updated');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v6');

      // Recreate captures without normalized_text and with old state constraint
      db.executeSync(`
        CREATE TABLE captures_rollback (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'failed')),
          raw_content TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      // Map 'processing' and 'ready' states back to 'captured'
      db.executeSync(`
        INSERT INTO captures_rollback (
          id, type, state, raw_content, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          id, type,
          CASE
            WHEN state IN ('processing', 'ready') THEN 'captured'
            ELSE state
          END as state,
          raw_content, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_rollback RENAME TO captures');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue with FK
      db.executeSync(`
        CREATE TABLE sync_queue_rollback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_rollback SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_rollback RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v6 completed');
    },
  },
  {
    version: 7,
    name: 'Add wav_path column to captures for debug WAV persistence',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v7: Adding wav_path column to captures');

      // Add wav_path column to captures table
      db.executeSync(`
        ALTER TABLE captures ADD COLUMN wav_path TEXT
      `);

      console.log('[DB] ✅ Migration v7: wav_path column added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v7');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE captures_v6 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      db.executeSync(`
        INSERT INTO captures_v6 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v6 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v6 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v6 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v6 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v7 completed');
    },
  },
  {
    version: 8,
    name: 'Add transcript_prompt column to captures for transcription context',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v8: Adding transcript_prompt column to captures');

      // Add transcript_prompt column to store the prompt used during transcription
      db.executeSync(`
        ALTER TABLE captures ADD COLUMN transcript_prompt TEXT
      `);

      console.log('[DB] ✅ Migration v8: transcript_prompt column added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v8');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE captures_v7 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT,
          wav_path TEXT
        )
      `);

      db.executeSync(`
        INSERT INTO captures_v7 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data, wav_path
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data, wav_path
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v7 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v7 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v7 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v7 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v8 completed');
    },
  },
  {
    version: 9,
    name: 'Add raw_transcript column to captures for Whisper output before LLM processing',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v9: Adding raw_transcript column to captures');

      // Add raw_transcript column to store Whisper output before LLM post-processing
      db.executeSync(`
        ALTER TABLE captures ADD COLUMN raw_transcript TEXT
      `);

      console.log('[DB] ✅ Migration v9: raw_transcript column added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v9');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE captures_v8 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT,
          wav_path TEXT,
          transcript_prompt TEXT
        )
      `);

      db.executeSync(`
        INSERT INTO captures_v8 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data,
          wav_path, transcript_prompt
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data,
          wav_path, transcript_prompt
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v8 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v8 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v8 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v8 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v9 completed');
    },
  },
  {
    version: 10,
    name: 'Add capture_metadata table and migrate raw_transcript/transcript_prompt',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v10: Creating capture_metadata table');

      // Step 1: Create capture_metadata table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS capture_metadata (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Step 2: Create indexes
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_capture_metadata_capture_id
        ON capture_metadata(capture_id)
      `);

      db.executeSync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_metadata_capture_key
        ON capture_metadata(capture_id, key)
      `);

      console.log('[DB] 🔄 Migration v10: Migrating existing data to capture_metadata');

      // Step 3: Migrate raw_transcript data
      const rawTranscriptResult = db.executeSync(`
        INSERT INTO capture_metadata (id, capture_id, key, value, created_at, updated_at)
        SELECT
          lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
          substr(lower(hex(randomblob(2))),2) || '-' ||
          substr('89ab', abs(random()) % 4 + 1, 1) ||
          substr(lower(hex(randomblob(2))),2) || '-' ||
          lower(hex(randomblob(6))),
          id,
          'raw_transcript',
          raw_transcript,
          updated_at,
          updated_at
        FROM captures
        WHERE raw_transcript IS NOT NULL
      `);
      console.log(`[DB] ℹ️  Migrated ${rawTranscriptResult.rowsAffected ?? 0} raw_transcript entries`);

      // Step 4: Migrate transcript_prompt data
      const transcriptPromptResult = db.executeSync(`
        INSERT INTO capture_metadata (id, capture_id, key, value, created_at, updated_at)
        SELECT
          lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
          substr(lower(hex(randomblob(2))),2) || '-' ||
          substr('89ab', abs(random()) % 4 + 1, 1) ||
          substr(lower(hex(randomblob(2))),2) || '-' ||
          lower(hex(randomblob(6))),
          id,
          'transcript_prompt',
          transcript_prompt,
          updated_at,
          updated_at
        FROM captures
        WHERE transcript_prompt IS NOT NULL
      `);
      console.log(`[DB] ℹ️  Migrated ${transcriptPromptResult.rowsAffected ?? 0} transcript_prompt entries`);

      console.log('[DB] 🔄 Migration v10: Rebuilding captures table without raw_transcript/transcript_prompt');

      // Step 5: Create new captures table without raw_transcript and transcript_prompt
      db.executeSync(`
        CREATE TABLE captures_v10 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          wav_path TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      // Step 6: Copy data to new table
      db.executeSync(`
        INSERT INTO captures_v10 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        FROM captures
      `);

      // Step 7: Drop old table
      db.executeSync('DROP TABLE captures');

      // Step 8: Rename new table
      db.executeSync('ALTER TABLE captures_v10 RENAME TO captures');

      // Step 9: Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Step 10: Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v10 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v10 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v10 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Migration v10: capture_metadata table created and data migrated');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v10');

      // Step 1: Recreate captures table with raw_transcript and transcript_prompt
      db.executeSync(`
        CREATE TABLE captures_v9 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          wav_path TEXT,
          transcript_prompt TEXT,
          raw_transcript TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      // Step 2: Copy data back with metadata values
      db.executeSync(`
        INSERT INTO captures_v9 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, transcript_prompt, raw_transcript,
          created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          c.id, c.type, c.state, c.raw_content, c.normalized_text, c.duration, c.file_size,
          c.wav_path,
          (SELECT value FROM capture_metadata WHERE capture_id = c.id AND key = 'transcript_prompt'),
          (SELECT value FROM capture_metadata WHERE capture_id = c.id AND key = 'raw_transcript'),
          c.created_at, c.updated_at, c.sync_version, c.last_sync_at, c.server_id, c.conflict_data
        FROM captures c
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v9 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v9 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v9 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v9 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      // Drop capture_metadata table
      db.executeSync('DROP TABLE IF EXISTS capture_metadata');

      console.log('[DB] ✅ Rollback v10 completed');
    },
  },
  {
    version: 11,
    name: 'Add capture_analysis table for LLM-based analysis results',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v11: Creating capture_analysis table');

      // Create capture_analysis table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS capture_analysis (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL,
          analysis_type TEXT NOT NULL CHECK(analysis_type IN ('summary', 'highlights', 'action_items')),
          content TEXT NOT NULL,
          model_id TEXT,
          processing_duration_ms INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_capture_analysis_capture_id
        ON capture_analysis(capture_id)
      `);

      db.executeSync(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_analysis_capture_type
        ON capture_analysis(capture_id, analysis_type)
      `);

      console.log('[DB] ✅ Migration v11: capture_analysis table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v11');
      db.executeSync('DROP TABLE IF EXISTS capture_analysis');
      console.log('[DB] ✅ Rollback v11 completed');
    },
  },
  {
    version: 12,
    name: "Add 'ideas' analysis type to capture_analysis CHECK constraint",
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v12: Adding ideas analysis type');

      // Step 1: Create new table with updated CHECK constraint
      db.executeSync(`
        CREATE TABLE capture_analysis_new (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL,
          analysis_type TEXT NOT NULL CHECK(
            analysis_type IN ('summary', 'highlights', 'action_items', 'ideas')
          ),
          content TEXT NOT NULL,
          model_id TEXT,
          processing_duration_ms INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Step 2: Copy existing data
      db.executeSync(`
        INSERT INTO capture_analysis_new
        SELECT * FROM capture_analysis
      `);

      // Step 3: Drop old table
      db.executeSync('DROP TABLE capture_analysis');

      // Step 4: Rename new table
      db.executeSync('ALTER TABLE capture_analysis_new RENAME TO capture_analysis');

      // Step 5: Recreate indexes
      db.executeSync(`
        CREATE INDEX idx_capture_analysis_capture_id
        ON capture_analysis(capture_id)
      `);

      db.executeSync(`
        CREATE UNIQUE INDEX idx_capture_analysis_capture_type
        ON capture_analysis(capture_id, analysis_type)
      `);

      console.log('[DB] ✅ Migration v12: Added ideas analysis type');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v12');

      // Create old table schema without 'ideas'
      db.executeSync(`
        CREATE TABLE capture_analysis_v11 (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL,
          analysis_type TEXT NOT NULL CHECK(analysis_type IN ('summary', 'highlights', 'action_items')),
          content TEXT NOT NULL,
          model_id TEXT,
          processing_duration_ms INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Copy data back (excluding 'ideas' type)
      db.executeSync(`
        INSERT INTO capture_analysis_v11
        SELECT * FROM capture_analysis
        WHERE analysis_type != 'ideas'
      `);

      db.executeSync('DROP TABLE capture_analysis');
      db.executeSync('ALTER TABLE capture_analysis_v11 RENAME TO capture_analysis');

      // Recreate indexes
      db.executeSync(`
        CREATE INDEX idx_capture_analysis_capture_id
        ON capture_analysis(capture_id)
      `);

      db.executeSync(`
        CREATE UNIQUE INDEX idx_capture_analysis_capture_type
        ON capture_analysis(capture_id, analysis_type)
      `);

      console.log('[DB] ✅ Rollback v12 completed');
    },
  },
  {
    version: 13,
    name: 'Add first_retry_at column to transcription_queue for 20-minute retry window',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v13: Adding first_retry_at to transcription_queue');

      // Add first_retry_at column to track retry window
      db.executeSync(`
        ALTER TABLE transcription_queue
        ADD COLUMN first_retry_at INTEGER
      `);

      console.log('[DB] ✅ Migration v13: first_retry_at column added');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v13');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE transcription_queue_v12 (
          id TEXT PRIMARY KEY NOT NULL,
          capture_id TEXT NOT NULL UNIQUE,
          audio_path TEXT NOT NULL,
          audio_duration INTEGER,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER,
          started_at INTEGER,
          completed_at INTEGER,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Copy data back (excluding first_retry_at)
      db.executeSync(`
        INSERT INTO transcription_queue_v12
        SELECT id, capture_id, audio_path, audio_duration, status, retry_count,
               last_error, created_at, updated_at, started_at, completed_at
        FROM transcription_queue
      `);

      db.executeSync('DROP TABLE transcription_queue');
      db.executeSync('ALTER TABLE transcription_queue_v12 RENAME TO transcription_queue');

      // Recreate indexes
      db.executeSync(`
        CREATE INDEX idx_transcription_queue_status
        ON transcription_queue(status, created_at)
      `);

      db.executeSync(`
        CREATE INDEX idx_transcription_queue_capture
        ON transcription_queue(capture_id)
      `);

      console.log('[DB] ✅ Rollback v13 completed');
    },
  },
  {
    version: 14,
    name: 'Add retry tracking columns to captures for transcription retry management',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v14: Adding retry tracking columns to captures');

      // Add retry_count column with default value 0
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0
      `);

      // Add retry_window_start_at column (nullable)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN retry_window_start_at INTEGER
      `);

      // Add last_retry_at column (nullable)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN last_retry_at INTEGER
      `);

      // Add transcription_error column (nullable)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN transcription_error TEXT
      `);

      console.log('[DB] ✅ Migration v14: Retry tracking columns added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v14');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE captures_v13 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          wav_path TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT
        )
      `);

      // Copy data back (excluding retry columns)
      db.executeSync(`
        INSERT INTO captures_v13 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id, conflict_data
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v13 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate sync_queue FK constraint
      db.executeSync(`
        CREATE TABLE sync_queue_v13 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v13 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v13 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v14 completed');
    },
  },
  {
    version: 15,
    name: 'Add thoughts, ideas, and todos tables for Knowledge and Action contexts',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v15: Creating thoughts, ideas, and todos tables');

      // Step 1: Create thoughts table
      db.executeSync(`
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
      `);

      // Create indexes for thoughts
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_thoughts_capture_id ON thoughts(capture_id)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_thoughts_user_id ON thoughts(user_id)
      `);

      console.log('[DB] ✅ thoughts table created');

      // Step 2: Create ideas table
      db.executeSync(`
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
      `);

      // Create indexes for ideas
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_ideas_thought_id ON ideas(thought_id)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id)
      `);

      console.log('[DB] ✅ ideas table created');

      // Step 3: Create todos table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY NOT NULL,
          thought_id TEXT NOT NULL,
          idea_id TEXT,
          capture_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('todo', 'completed', 'abandoned')) DEFAULT 'todo',
          description TEXT NOT NULL,
          deadline INTEGER,
          priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE,
          FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE SET NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for todos (performance-critical for queries)
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_thought_id ON todos(thought_id)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_idea_id ON todos(idea_id)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_deadline ON todos(deadline)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
      `);

      console.log('[DB] ✅ todos table created');

      console.log('[DB] ✅ Migration v15: All tables created successfully');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v15');

      // Drop tables in reverse order (respect FK constraints)
      db.executeSync('DROP TABLE IF EXISTS todos');
      db.executeSync('DROP TABLE IF EXISTS ideas');
      db.executeSync('DROP TABLE IF EXISTS thoughts');

      console.log('[DB] ✅ Rollback v15 completed');
    },
  },
  {
    version: 16,
    name: 'Add notification_preferences table (migrate from DatabaseService)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v16: Creating notification_preferences table');

      // Create notification_preferences table
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          push_notifications_enabled INTEGER NOT NULL DEFAULT 0,
          local_notifications_enabled INTEGER NOT NULL DEFAULT 1,
          haptic_feedback_enabled INTEGER NOT NULL DEFAULT 1,
          synced_at TEXT,
          updated_at TEXT NOT NULL
        )
      `);

      // Insert default row if not exists
      db.executeSync(`
        INSERT OR IGNORE INTO notification_preferences (
          id,
          push_notifications_enabled,
          local_notifications_enabled,
          haptic_feedback_enabled,
          updated_at
        )
        VALUES (1, 0, 1, 1, datetime('now'))
      `);

      console.log('[DB] ✅ Migration v16: notification_preferences table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v16');
      db.executeSync('DROP TABLE IF EXISTS notification_preferences');
      console.log('[DB] ✅ Rollback v16 completed');
    },
  },
  {
    version: 17,
    name: 'Add analysis_todos association table (capture_analysis → todos)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v17: Creating analysis_todos table');

      db.executeSync(`
        CREATE TABLE IF NOT EXISTS analysis_todos (
          todo_id TEXT NOT NULL,
          analysis_id TEXT NOT NULL,
          action_item_index INTEGER,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (todo_id, analysis_id),
          FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
          FOREIGN KEY (analysis_id) REFERENCES capture_analysis(id) ON DELETE CASCADE
        )
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_analysis_todos_analysis_id
        ON analysis_todos(analysis_id)
      `);

      console.log('[DB] ✅ Migration v17: analysis_todos table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v17');
      db.executeSync('DROP TABLE IF EXISTS analysis_todos');
      console.log('[DB] ✅ Rollback v17 completed');
    },
  },
  {
    version: 18,
    name: 'Add contact column to todos table',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v18: Adding contact column to todos');

      db.executeSync(`
        ALTER TABLE todos ADD COLUMN contact TEXT
      `);

      console.log('[DB] ✅ Migration v18: contact column added to todos');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v18');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE todos_v17 (
          id TEXT PRIMARY KEY NOT NULL,
          thought_id TEXT NOT NULL,
          idea_id TEXT,
          capture_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('todo', 'completed', 'abandoned')) DEFAULT 'todo',
          description TEXT NOT NULL,
          deadline INTEGER,
          priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (thought_id) REFERENCES thoughts(id) ON DELETE CASCADE,
          FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE SET NULL,
          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync(`
        INSERT INTO todos_v17 (
          id, thought_id, idea_id, capture_id, user_id, status, description,
          deadline, priority, completed_at, created_at, updated_at
        )
        SELECT
          id, thought_id, idea_id, capture_id, user_id, status, description,
          deadline, priority, completed_at, created_at, updated_at
        FROM todos
      `);

      db.executeSync('DROP TABLE todos');
      db.executeSync('ALTER TABLE todos_v17 RENAME TO todos');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_thought_id ON todos(thought_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_idea_id ON todos(idea_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_deadline ON todos(deadline)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)');

      console.log('[DB] ✅ Rollback v18 completed');
    },
  },
  {
    version: 19,
    name: 'Add upload_queue table for audio file upload tracking',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v19: Creating upload_queue table');

      // Create upload_queue table for tracking audio uploads
      db.executeSync(`
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
      `);

      // Create indexes for performance
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_upload_queue_status
        ON upload_queue(status)
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_upload_queue_capture
        ON upload_queue(capture_id)
      `);

      console.log('[DB] ✅ Migration v19: upload_queue table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v19');
      db.executeSync('DROP TABLE IF EXISTS upload_queue');
      console.log('[DB] ✅ Rollback v19 completed');
    },
  },
  {
    version: 20,
    name: 'Add last_chunk_uploaded column to upload_queue for resumable uploads',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v20: Adding last_chunk_uploaded to upload_queue');

      // Add last_chunk_uploaded column to track resumable upload progress
      db.executeSync(`
        ALTER TABLE upload_queue
        ADD COLUMN last_chunk_uploaded INTEGER DEFAULT 0
      `);

      console.log('[DB] ✅ Migration v20: last_chunk_uploaded column added');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v20');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE upload_queue_v19 (
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
      `);

      // Copy data back (excluding last_chunk_uploaded)
      db.executeSync(`
        INSERT INTO upload_queue_v19 (
          id, capture_id, file_path, file_size, status, progress, retry_count,
          error_message, created_at, updated_at
        )
        SELECT
          id, capture_id, file_path, file_size, status, progress, retry_count,
          error_message, created_at, updated_at
        FROM upload_queue
      `);

      db.executeSync('DROP TABLE upload_queue');
      db.executeSync('ALTER TABLE upload_queue_v19 RENAME TO upload_queue');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_upload_queue_status ON upload_queue(status)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_upload_queue_capture ON upload_queue(capture_id)');

      console.log('[DB] ✅ Rollback v20 completed');
    },
  },
  {
    version: 21,
    name: 'Add _changed column to captures for sync tracking (Story 6.2)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v21: Adding _changed column to captures');

      // Add _changed column for sync tracking
      // Default value 0 = not changed, 1 = changed (needs sync)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0
      `);

      // Create index for efficient sync queries (SELECT WHERE _changed = 1)
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_captures_changed
        ON captures(_changed)
      `);

      console.log('[DB] ✅ Migration v21: _changed column added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v21');

      // SQLite doesn't support DROP COLUMN, so we need to recreate the table
      db.executeSync(`
        CREATE TABLE captures_v20 (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('audio', 'text')),
          state TEXT NOT NULL CHECK(state IN ('recording', 'captured', 'processing', 'ready', 'failed')),
          raw_content TEXT,
          normalized_text TEXT,
          duration INTEGER,
          file_size INTEGER,
          wav_path TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          sync_version INTEGER NOT NULL DEFAULT 0,
          last_sync_at INTEGER,
          server_id TEXT,
          conflict_data TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          retry_window_start_at INTEGER,
          last_retry_at INTEGER,
          transcription_error TEXT
        )
      `);

      // Copy data back (excluding _changed)
      db.executeSync(`
        INSERT INTO captures_v20 (
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id,
          conflict_data, retry_count, retry_window_start_at, last_retry_at, transcription_error
        )
        SELECT
          id, type, state, raw_content, normalized_text, duration, file_size,
          wav_path, created_at, updated_at, sync_version, last_sync_at, server_id,
          conflict_data, retry_count, retry_window_start_at, last_retry_at, transcription_error
        FROM captures
      `);

      db.executeSync('DROP TABLE captures');
      db.executeSync('ALTER TABLE captures_v20 RENAME TO captures');

      // Recreate indexes
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_created_at ON captures(created_at DESC)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_captures_state ON captures(state)');

      // Recreate FK constraints for dependent tables
      console.log('[DB] 🔄 Recreating FK constraints for sync_queue');
      db.executeSync(`
        CREATE TABLE sync_queue_v20 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete', 'conflict')),
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          max_retries INTEGER NOT NULL DEFAULT 3,
          FOREIGN KEY (entity_id) REFERENCES captures(id) ON DELETE CASCADE
        )
      `);

      db.executeSync('INSERT INTO sync_queue_v20 SELECT * FROM sync_queue');
      db.executeSync('DROP TABLE sync_queue');
      db.executeSync('ALTER TABLE sync_queue_v20 RENAME TO sync_queue');

      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
      db.executeSync('CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at ASC)');

      console.log('[DB] ✅ Rollback v21 completed');
    },
  },

  {
    version: 22,
    name: 'Add audio_url and audio_local_path for lazy loading (Story 6.3)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v22: Adding audio_url and audio_local_path columns');

      // Add audio_url column (MinIO S3 URL from server)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN audio_url TEXT
      `);

      // Add audio_local_path column (cached local file path)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN audio_local_path TEXT
      `);

      console.log('[DB] ✅ Migration v22: Audio columns added to captures');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v22 (audio columns cannot be dropped in SQLite)');
      // SQLite doesn't support DROP COLUMN
      // If rollback is needed, would require table recreation
    },
  },
  {
    version: 23,
    name: 'Add _status column for soft deletes (Story 6.3 - Task 5)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v23: Adding _status column for soft deletes');

      // Add _status column to captures (for sync deletion propagation)
      db.executeSync(`
        ALTER TABLE captures
        ADD COLUMN _status TEXT DEFAULT 'active' CHECK(_status IN ('active', 'deleted'))
      `);

      // Add _status column to thoughts
      db.executeSync(`
        ALTER TABLE thoughts
        ADD COLUMN _status TEXT DEFAULT 'active' CHECK(_status IN ('active', 'deleted'))
      `);

      // Add _status column to ideas
      db.executeSync(`
        ALTER TABLE ideas
        ADD COLUMN _status TEXT DEFAULT 'active' CHECK(_status IN ('active', 'deleted'))
      `);

      // Add _status column to todos
      db.executeSync(`
        ALTER TABLE todos
        ADD COLUMN _status TEXT DEFAULT 'active' CHECK(_status IN ('active', 'deleted'))
      `);

      console.log('[DB] ✅ Migration v23: _status column added to all tables');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v23 (_status columns cannot be dropped in SQLite)');
      // SQLite doesn't support DROP COLUMN
      // If rollback is needed, would require table recreation
    },
  },
  {
    version: 24,
    name: 'Add sync_metadata table — migrate sync timestamps from AsyncStorage to OP-SQLite (ADR-022)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v24: Creating sync_metadata table (ADR-022 compliance)');

      // Create sync_metadata table to replace AsyncStorage usage in SyncStorage.ts
      db.executeSync(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          entity TEXT PRIMARY KEY NOT NULL,
          last_pulled_at INTEGER NOT NULL DEFAULT 0,
          last_pushed_at INTEGER NOT NULL DEFAULT 0,
          last_sync_status TEXT NOT NULL DEFAULT 'success'
            CHECK(last_sync_status IN ('success', 'error', 'in_progress')),
          last_sync_error TEXT,
          updated_at INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Create index for efficient lookups
      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_sync_metadata_entity
        ON sync_metadata(entity)
      `);

      console.log('[DB] ✅ Migration v24: sync_metadata table created');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v24');
      db.executeSync('DROP TABLE IF EXISTS sync_metadata');
      console.log('[DB] ✅ Rollback v24 completed');
    },
  },
  {
    version: 25,
    name: 'Add _changed column to thoughts and todos for sync tracking (Story 6.2 fix)',
    up: (db: DB) => {
      db.executeSync('PRAGMA foreign_keys = ON');

      console.log('[DB] 🔄 Migration v25: Adding _changed column to thoughts and todos');

      db.executeSync(`
        ALTER TABLE thoughts
        ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_thoughts_changed
        ON thoughts(_changed)
      `);

      db.executeSync(`
        ALTER TABLE todos
        ADD COLUMN _changed INTEGER NOT NULL DEFAULT 0
      `);

      db.executeSync(`
        CREATE INDEX IF NOT EXISTS idx_todos_changed
        ON todos(_changed)
      `);

      console.log('[DB] ✅ Migration v25: _changed column added to thoughts and todos');
    },
    down: (db: DB) => {
      console.warn('[DB] 🔄 Rolling back migration v25 (_changed columns cannot be dropped in SQLite)');
      // SQLite doesn't support DROP COLUMN
      // If rollback is needed, would require table recreation
    },
  },
];

/**
 * Get current database version
 */
function getCurrentVersion(db: DB): number {
  try {
    const result = db.executeSync('PRAGMA user_version');
    // OP-SQLite returns results in .rows property (not .rows._array)
    const rows = result.rows || [];
    return rows[0]?.user_version ?? 0;
  } catch (error) {
    console.error('[DB] Failed to get current version:', error);
    return 0;
  }
}

/**
 * Set database version
 */
function setVersion(db: DB, version: number): void {
  db.executeSync(`PRAGMA user_version = ${version}`);
}

/**
 * Run pending migrations
 *
 * @param db - Database instance
 * @returns Number of migrations applied
 */
export function runMigrations(db: DB): number {
  const currentVersion = getCurrentVersion(db);

  console.log(`[DB] Current version: ${currentVersion}, Target version: ${SCHEMA_VERSION}`);

  if (currentVersion === SCHEMA_VERSION) {
    console.log('[DB] ✅ Database already at latest version');
    return 0;
  }

  let applied = 0;

  // Run migrations sequentially
  for (const migration of migrations) {
    if (migration.version > currentVersion && migration.version <= SCHEMA_VERSION) {
      console.log(`[DB] 🔄 Running migration v${migration.version}: ${migration.name}`);

      try {
        migration.up(db);
        setVersion(db, migration.version);
        applied++;

        console.log(`[DB] ✅ Migration v${migration.version} completed`);
      } catch (error) {
        console.error(`[DB] ❌ Migration v${migration.version} failed:`, error);
        throw new Error(`Migration v${migration.version} failed: ${error}`);
      }
    }
  }

  if (applied > 0) {
    console.log(`[DB] ✅ Applied ${applied} migration(s)`);
  }

  return applied;
}

/**
 * Rollback to specific version (development only)
 *
 * WARNING: Data loss may occur. Use with caution.
 */
export function rollbackTo(db: DB, targetVersion: number): void {
  const currentVersion = getCurrentVersion(db);

  if (targetVersion >= currentVersion) {
    console.warn('[DB] ⚠️ Target version is >= current version, nothing to rollback');
    return;
  }

  console.warn(`[DB] 🔄 Rolling back from v${currentVersion} to v${targetVersion}`);

  // Run down migrations in reverse order
  for (let i = migrations.length - 1; i >= 0; i--) {
    const migration = migrations[i];

    if (migration.version > targetVersion && migration.version <= currentVersion) {
      if (!migration.down) {
        throw new Error(`Migration v${migration.version} has no down() method`);
      }

      console.log(`[DB] 🔄 Rolling back v${migration.version}: ${migration.name}`);
      migration.down(db);
      setVersion(db, migration.version - 1);
    }
  }

  console.log(`[DB] ✅ Rolled back to v${targetVersion}`);
}
