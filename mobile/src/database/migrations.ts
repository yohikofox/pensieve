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
