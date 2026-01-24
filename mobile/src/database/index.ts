/**
 * Database Connection - OP-SQLite Singleton
 *
 * Provides thread-safe database access with automatic migrations.
 * Uses singleton pattern to ensure single instance across the app.
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { runMigrations } from './migrations';

/**
 * Database Singleton
 */
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: DB | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize database with migrations
   */
  initialize(): DB {
    if (this.initialized && this.db) {
      return this.db;
    }

    console.log('[DB] 🔄 Initializing database connection...');

    try {
      // Open database connection
      this.db = open({
        name: 'pensine.db',
        location: 'default', // Documents directory on iOS, data directory on Android
      });

      console.log('[DB] ✅ Database connection opened');

      // Enable foreign key constraints (disabled by default in SQLite)
      this.db.executeSync('PRAGMA foreign_keys = ON');
      console.log('[DB] ✅ Foreign key constraints enabled');

      // Run migrations
      const applied = runMigrations(this.db);

      if (applied > 0) {
        console.log(`[DB] ✅ Database initialized with ${applied} migration(s)`);
      } else {
        console.log('[DB] ✅ Database initialized (no migrations needed)');
      }

      this.initialized = true;
      return this.db;
    } catch (error) {
      console.error('[DB] ❌ Failed to initialize database:', error);
      // EXCEPTION ALLOWED: DB initialization failure at app startup.
      // If DB cannot initialize, app is unusable - fail fast.
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Get database instance
   *
   * @throws Error if database is not initialized
   *
   * EXCEPTION ALLOWED: This is a programming error, not a runtime error.
   * If DB is not initialized, the app cannot function - fail fast.
   */
  getDatabase(): DB {
    if (!this.initialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute raw SQL query (synchronous)
   *
   * For type-safe queries, use Repository classes instead.
   *
   * NOTE: Using executeSync instead of execute because:
   * - SQLite operations on local DB are already very fast
   * - Synchronous API is simpler and doesn't require async/await everywhere
   * - execute() returns a Promise which we weren't awaiting (was causing bugs)
   */
  execute(sql: string, params?: any[]): any {
    const db = this.getDatabase();
    return db.executeSync(sql, params);
  }

  /**
   * Execute transaction
   *
   * @param callback - Transaction callback
   * @returns Transaction result
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const db = this.getDatabase();
    return db.transaction(callback);
  }

  /**
   * Close database connection
   *
   * WARNING: Only use during app shutdown or testing.
   */
  close(): void {
    if (this.db) {
      console.log('[DB] 🔄 Closing database connection...');
      // OP-SQLite doesn't have explicit close method
      // Connection is managed by native side
      this.db = null;
      this.initialized = false;
      console.log('[DB] ✅ Database connection closed');
    }
  }

  /**
   * Reset database (development/testing only)
   *
   * WARNING: This will delete ALL data.
   */
  reset(): void {
    if (this.db) {
      console.warn('[DB] ⚠️ Resetting database (ALL DATA WILL BE LOST)');

      this.db.execute('DROP TABLE IF EXISTS sync_queue');
      this.db.execute('DROP TABLE IF EXISTS captures');
      this.db.execute('PRAGMA user_version = 0');

      console.log('[DB] ✅ Database reset complete');

      // Reinitialize
      this.initialized = false;
      this.initialize();
    }
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();

// Auto-initialize on import
database.initialize();

// Export types
export { type DB } from '@op-engineering/op-sqlite';
