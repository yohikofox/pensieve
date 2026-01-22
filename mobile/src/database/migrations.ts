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
 * Migration History
 *
 * Each migration has a unique version number and is idempotent.
 */
export const migrations: Migration[] = [
  {
    version: 1,
    name: 'Initial schema - captures table',
    up: (db: DB) => {
      // Create initial schema
      SCHEMA_DDL.forEach((ddl) => {
        db.execute(ddl);
      });

      console.log('[DB] ✅ Migration v1: Initial schema created');
    },
    down: (db: DB) => {
      db.execute('DROP TABLE IF EXISTS sync_queue');
      db.execute('DROP TABLE IF NOT EXISTS captures');
    },
  },
  // Future migrations will be added here
  // Example:
  // {
  //   version: 2,
  //   name: 'Add users table',
  //   up: (db: DB) => {
  //     db.execute(`
  //       CREATE TABLE users (
  //         id TEXT PRIMARY KEY,
  //         email TEXT NOT NULL,
  //         created_at INTEGER NOT NULL
  //       );
  //     `);
  //   }
  // }
];

/**
 * Get current database version
 */
function getCurrentVersion(db: DB): number {
  try {
    const result = db.execute('PRAGMA user_version');
    return result.rows?._array?.[0]?.user_version ?? 0;
  } catch (error) {
    console.error('[DB] Failed to get current version:', error);
    return 0;
  }
}

/**
 * Set database version
 */
function setVersion(db: DB, version: number): void {
  db.execute(`PRAGMA user_version = ${version}`);
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
