/**
 * AbstractRepository - Base class for all repositories
 *
 * Centralizes database access and ensures single source of truth.
 * All repositories should extend this class to:
 * - Use the same DB connection with migrations
 * - Avoid creating multiple DB connections
 * - Ensure consistent error handling
 */

import { database, type DB } from '../../database';

/**
 * Base class for all repositories
 *
 * Usage:
 * ```typescript
 * @injectable()
 * export class MyRepository extends AbstractRepository implements IMyRepository {
 *   async findById(id: string): Promise<MyEntity | null> {
 *     const { rows } = this.executeQuery<MyEntityRow>(
 *       'SELECT * FROM my_table WHERE id = ?',
 *       [id]
 *     );
 *     return rows.length > 0 ? this.mapRowToEntity(rows[0]) : null;
 *   }
 * }
 * ```
 */
export abstract class AbstractRepository {
  /**
   * Database instance with all migrations applied
   * Shared across all repositories for consistency
   */
  protected readonly db: DB;

  constructor() {
    // Get initialized database (migrations already applied via auto-init)
    this.db = database.getDatabase();
  }

  /**
   * Execute SQL query with standardized error handling
   *
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Result with rows array and rowsAffected count
   * @throws Error if query fails
   */
  protected executeQuery<T = any>(
    query: string,
    params?: any[]
  ): { rows: T[]; rowsAffected: number } {
    try {
      const result = this.db.executeSync(query, params);
      return {
        rows: (result.rows || []) as T[],
        rowsAffected: result.rowsAffected ?? 0,
      };
    } catch (error) {
      console.error('[AbstractRepository] Query failed:', query, error);
      throw error;
    }
  }

  /**
   * Execute query and return first row or null
   *
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns First row or null if no results
   */
  protected executeQueryOne<T = any>(
    query: string,
    params?: any[]
  ): T | null {
    const { rows } = this.executeQuery<T>(query, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute transaction with automatic rollback on error
   *
   * @param callback - Transaction callback
   * @returns Transaction result
   * @throws Error if transaction fails
   */
  protected async executeTransaction<T>(
    callback: (db: DB) => Promise<T>
  ): Promise<T> {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      console.error('[AbstractRepository] Transaction failed:', error);
      throw error;
    }
  }
}
