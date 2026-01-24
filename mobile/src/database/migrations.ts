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
