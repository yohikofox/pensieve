/**
 * Mock for @op-engineering/op-sqlite
 *
 * Provides an in-memory SQLite implementation for Jest tests.
 * Uses better-sqlite3 for actual SQL execution in Node.js environment.
 */

import Database from 'better-sqlite3';

// In-memory database instance (shared across tests until reset)
let db: Database.Database | null = null;

/**
 * Mock DB interface compatible with OP-SQLite
 */
export interface DB {
  executeSync(query: string, params?: any[]): { rows?: any[]; rowsAffected?: number };
  execute(query: string, params?: any[]): Promise<{ rows?: any[]; rowsAffected?: number }>;
  transaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
}

/**
 * Get or create in-memory database
 */
function getDatabase(): Database.Database {
  if (!db) {
    // Create in-memory SQLite database using better-sqlite3
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON'); // Enable FK constraints like OP-SQLite
  }
  return db;
}

/**
 * Mock open() function
 *
 * Returns a mock DB instance compatible with OP-SQLite interface
 */
export function open(options: { name: string; location?: string }): DB {
  const sqlite = getDatabase();

  return {
    /**
     * Execute SQL synchronously (OP-SQLite compatible)
     */
    executeSync(query: string, params?: any[]) {
      try {
        const trimmedQuery = query.trim().toUpperCase();

        // Handle PRAGMA queries (special case - some return data, some don't)
        if (trimmedQuery.startsWith('PRAGMA')) {
          // PRAGMA foreign_keys = ON doesn't return data
          if (trimmedQuery.includes('=')) {
            sqlite.prepare(query).run();
            return { rowsAffected: 0 };
          }
          // PRAGMA user_version and others return data
          const result = sqlite.prepare(query).all();
          return { rows: result };
        }

        // Handle SELECT queries
        if (trimmedQuery.startsWith('SELECT')) {
          const stmt = sqlite.prepare(query);
          const rows = params ? stmt.all(...params) : stmt.all();
          return { rows };
        }

        // Handle INSERT/UPDATE/DELETE
        const stmt = sqlite.prepare(query);
        const info = params ? stmt.run(...params) : stmt.run();
        return { rowsAffected: info.changes };
      } catch (error: any) {
        // Re-throw with better error message
        throw new Error(`SQL Error: ${error.message}\nQuery: ${query}\nParams: ${JSON.stringify(params)}`);
      }
    },

    /**
     * Execute SQL asynchronously (OP-SQLite compatible)
     */
    async execute(query: string, params?: any[]) {
      return this.executeSync(query, params);
    },

    /**
     * Execute transaction
     */
    async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      // better-sqlite3 transactions are auto-commit, so we wrap with BEGIN/COMMIT
      sqlite.prepare('BEGIN').run();
      try {
        const result = await callback(this);
        sqlite.prepare('COMMIT').run();
        return result;
      } catch (error) {
        sqlite.prepare('ROLLBACK').run();
        throw error;
      }
    },
  };
}

/**
 * Reset database (for testing)
 */
export function __resetDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Export type for compatibility
export type { DB };
