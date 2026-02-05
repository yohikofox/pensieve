/**
 * DatabaseService - Core OP-SQLite database management
 *
 * Provides:
 * - Database initialization and migrations
 * - Connection management
 * - Query execution
 */

import { open, type DB } from '@op-engineering/op-sqlite';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: DB | null = null;
  private readonly dbName = 'pensieve.sqlite';

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    try {
      this.db = open({ name: this.dbName });
      await this.runMigrations();
    } catch (error) {
      console.error('[DatabaseService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get database instance (throws if not initialized)
   */
  getDB(): DB {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    // Create migrations table if not exists
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
    `);

    // Run migrations in order
    await this.runMigration('001_create_notification_preferences', () => {
      this.db!.execute(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          push_notifications_enabled INTEGER NOT NULL DEFAULT 0,
          local_notifications_enabled INTEGER NOT NULL DEFAULT 1,
          haptic_feedback_enabled INTEGER NOT NULL DEFAULT 1,
          synced_at TEXT,
          updated_at TEXT NOT NULL
        );
      `);

      // Insert default row if not exists
      this.db!.execute(`
        INSERT OR IGNORE INTO notification_preferences (id, push_notifications_enabled, local_notifications_enabled, haptic_feedback_enabled, updated_at)
        VALUES (1, 0, 1, 1, datetime('now'));
      `);
    });
  }

  /**
   * Execute a migration if not already applied
   */
  private async runMigration(name: string, migration: () => void): Promise<void> {
    if (!this.db) return;

    // Check if migration already applied
    const result = this.db.execute(
      'SELECT 1 FROM migrations WHERE name = ?',
      [name]
    );

    if (result.rows && result.rows.length > 0) {
      return; // Migration already applied
    }

    try {
      // Run migration
      migration();

      // Record migration
      this.db.execute(
        'INSERT INTO migrations (name, applied_at) VALUES (?, datetime(\'now\'))',
        [name]
      );

      console.log(`[DatabaseService] Migration applied: ${name}`);
    } catch (error) {
      console.error(`[DatabaseService] Migration failed: ${name}`, error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const databaseService = DatabaseService.getInstance();
