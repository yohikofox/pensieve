/**
 * SyncService
 * Main synchronization orchestrator for mobile ↔ backend sync
 *
 * Story 6.1 - Task 3: Mobile Sync Service with OP-SQLite
 * Implements ADR-009 sync protocol with manual implementation
 */

import { DatabaseConnection } from '../../database';
import type { DB } from '@op-engineering/op-sqlite';
import axios, { type AxiosInstance } from 'axios';
import {
  SyncResult,
  type SyncResponse,
  type SyncOptions,
  type ChangesPayload,
  type PullRequest,
  type PushRequest,
} from './types';
import {
  getLastPulledAt,
  updateLastPulledAt,
  updateLastPushedAt,
  updateSyncStatus,
} from './SyncStorage';
import { retryWithFibonacci, isRetryableError } from './retry-logic';

// Sync configuration
const CHUNK_SIZE = 100; // Task 3.7: Max records per sync batch
const SYNC_TIMEOUT_MS = 30000; // 30 seconds

/**
 * SyncService
 * Handles bidirectional sync between mobile and backend
 */
export class SyncService {
  private db: DB;
  private apiClient: AxiosInstance;
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.db = DatabaseConnection.getInstance().getDatabase();

    // Initialize HTTP client
    this.apiClient = axios.create({
      baseURL: baseUrl,
      timeout: SYNC_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Main sync method - orchestrates pull and push
   * Task 3.2: Implement sync(options) method
   */
  async sync(options?: SyncOptions): Promise<SyncResponse> {
    console.log('[Sync] 🔄 Starting sync...', options);

    // Validate auth token
    if (!this.authToken) {
      return {
        result: SyncResult.AUTH_ERROR,
        error: 'No authentication token',
        retryable: false,
      };
    }

    try {
      // Mark sync as in-progress
      await this.updateAllEntitiesStatus('in_progress');

      // Step 1: PULL - Get server changes
      const pullResult = await this.performPull(options);

      if (pullResult.result !== SyncResult.SUCCESS) {
        return pullResult;
      }

      // Step 2: PUSH - Send local changes
      const pushResult = await this.performPush(options);

      if (pushResult.result !== SyncResult.SUCCESS) {
        return pushResult;
      }

      // Step 3: PULL again to get any server changes from push conflicts
      const finalPullResult = await this.performPull(options);

      // Mark sync as success
      await this.updateAllEntitiesStatus('success');

      console.log('[Sync] ✅ Sync completed successfully');

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: finalPullResult.timestamp,
        conflicts: pushResult.conflicts,
      };
    } catch (error) {
      console.error('[Sync] ❌ Sync failed:', error);

      // Mark sync as error
      await this.updateAllEntitiesStatus(
        'error',
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Determine if error is retryable
      const retryable = isRetryableError(error);

      return {
        result: this.categorizeError(error),
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable,
      };
    }
  }

  /**
   * PULL phase - Get server changes since lastPulledAt
   */
  private async performPull(options?: SyncOptions): Promise<SyncResponse> {
    console.log('[Sync] 📥 Starting PULL phase...');

    try {
      const entities = options?.entity
        ? [options.entity]
        : ['captures', 'thoughts', 'ideas', 'todos'];

      // Get lastPulledAt for each entity
      const lastPulledTimes = await Promise.all(
        entities.map((entity) => getLastPulledAt(entity)),
      );

      // Use oldest timestamp for full consistency
      const lastPulledAt = Math.min(...lastPulledTimes, Date.now());

      // Call backend /api/sync/pull
      const response = await retryWithFibonacci(
        async () => {
          const { data } = await this.apiClient.get('/api/sync/pull', {
            params: { last_pulled_at: options?.forceFull ? 0 : lastPulledAt },
          });
          return data;
        },
        10,
        (attempt, delay) => {
          console.log(
            `[Sync] PULL retry attempt ${attempt}, waiting ${delay / 1000}s...`,
          );
        },
      );

      // Apply server changes to local database
      await this.applyServerChanges(response.changes);

      // Update lastPulledAt for all entities
      for (const entity of entities) {
        await updateLastPulledAt(entity, response.timestamp);
      }

      console.log('[Sync] ✅ PULL phase completed');

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: response.timestamp,
        data: response.changes,
      };
    } catch (error) {
      console.error('[Sync] ❌ PULL failed:', error);
      throw error;
    }
  }

  /**
   * PUSH phase - Send local changes to server
   */
  private async performPush(options?: SyncOptions): Promise<SyncResponse> {
    console.log('[Sync] 📤 Starting PUSH phase...');

    try {
      const entities = options?.entity
        ? [options.entity]
        : ['captures', 'thoughts', 'ideas', 'todos'];

      // Detect local changes (Task 3.4)
      const changes = await this.detectLocalChanges(entities);

      // Skip push if no changes
      if (this.isEmptyChanges(changes)) {
        console.log('[Sync] ℹ️ No local changes to push');
        return {
          result: SyncResult.SUCCESS,
          retryable: false,
        };
      }

      // Get lastPulledAt for conflict detection
      const lastPulledTimes = await Promise.all(
        entities.map((entity) => getLastPulledAt(entity)),
      );
      const lastPulledAt = Math.min(...lastPulledTimes);

      // Call backend /api/sync/push
      const response = await retryWithFibonacci(
        async () => {
          const payload: PushRequest = {
            last_pulled_at: lastPulledAt,
            changes,
          };

          const { data } = await this.apiClient.post('/api/sync/push', payload);
          return data;
        },
        10,
        (attempt, delay) => {
          console.log(
            `[Sync] PUSH retry attempt ${attempt}, waiting ${delay / 1000}s...`,
          );
        },
      );

      // Mark pushed records as synced (_changed = 0)
      await this.markRecordsAsSynced(changes);

      // Update lastPushedAt for all entities
      for (const entity of entities) {
        await updateLastPushedAt(entity, Date.now());
      }

      console.log('[Sync] ✅ PUSH phase completed');

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        conflicts: response.conflicts,
      };
    } catch (error) {
      console.error('[Sync] ❌ PUSH failed:', error);
      throw error;
    }
  }

  /**
   * Detect local changes from database
   * Task 3.4: Query OP-SQLite for _changed = 1
   */
  private async detectLocalChanges(
    entities: string[],
  ): Promise<ChangesPayload> {
    const changes: ChangesPayload = {};

    for (const entity of entities) {
      try {
        // Query for changed records
        const result = this.db.executeSync(
          `SELECT * FROM ${entity} WHERE _changed = 1 LIMIT ${CHUNK_SIZE}`,
        );

        if (result.rows && result.rows.length > 0) {
          // Convert rows to plain objects
          const records = [];
          for (let i = 0; i < result.rows.length; i++) {
            records.push(result.rows.item(i));
          }

          // Group by status
          const updated = records.filter((r) => r._status === 'active');
          const deleted = records.filter((r) => r._status === 'deleted');

          changes[entity as keyof ChangesPayload] = {
            updated: updated.length > 0 ? updated : undefined,
            deleted: deleted.length > 0 ? deleted : undefined,
          };
        }
      } catch (error) {
        console.error(`[Sync] Failed to detect changes for ${entity}:`, error);
      }
    }

    return changes;
  }

  /**
   * Apply server changes to local database
   */
  private async applyServerChanges(changes: ChangesPayload): Promise<void> {
    console.log('[Sync] 📝 Applying server changes...');

    for (const [entity, entityChanges] of Object.entries(changes)) {
      if (!entityChanges) continue;

      // Apply updated records
      if (entityChanges.updated) {
        for (const record of entityChanges.updated) {
          await this.upsertRecord(entity, record);
        }
      }

      // Apply deleted records
      if (entityChanges.deleted) {
        for (const record of entityChanges.deleted) {
          await this.markRecordDeleted(entity, record.id);
        }
      }
    }

    console.log('[Sync] ✅ Server changes applied');
  }

  /**
   * Upsert record into local database
   */
  private async upsertRecord(entity: string, record: any): Promise<void> {
    try {
      // Check if record exists
      const existing = this.db.executeSync(
        `SELECT id FROM ${entity} WHERE id = ?`,
        [record.id],
      );

      if (existing.rows && existing.rows.length > 0) {
        // Update existing record
        const columns = Object.keys(record);
        const setClause = columns.map((col) => `${col} = ?`).join(', ');
        const values = columns.map((col) => record[col]);

        this.db.executeSync(
          `UPDATE ${entity} SET ${setClause}, _changed = 0 WHERE id = ?`,
          [...values, record.id],
        );
      } else {
        // Insert new record
        const columns = Object.keys(record);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map((col) => record[col]);

        this.db.executeSync(
          `INSERT INTO ${entity} (${columns.join(', ')}, _changed) VALUES (${placeholders}, 0)`,
          values,
        );
      }
    } catch (error) {
      console.error(`[Sync] Failed to upsert record in ${entity}:`, error);
    }
  }

  /**
   * Mark record as deleted in local database
   */
  private async markRecordDeleted(entity: string, id: string): Promise<void> {
    try {
      this.db.executeSync(
        `UPDATE ${entity} SET _status = 'deleted', _changed = 0 WHERE id = ?`,
        [id],
      );
    } catch (error) {
      console.error(`[Sync] Failed to mark record deleted in ${entity}:`, error);
    }
  }

  /**
   * Mark pushed records as synced (_changed = 0)
   */
  private async markRecordsAsSynced(changes: ChangesPayload): Promise<void> {
    for (const [entity, entityChanges] of Object.entries(changes)) {
      if (!entityChanges) continue;

      const allRecords = [
        ...(entityChanges.updated || []),
        ...(entityChanges.deleted || []),
      ];

      for (const record of allRecords) {
        try {
          this.db.executeSync(
            `UPDATE ${entity} SET _changed = 0 WHERE id = ?`,
            [record.id],
          );
        } catch (error) {
          console.error(
            `[Sync] Failed to mark record synced in ${entity}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Check if changes payload is empty
   */
  private isEmptyChanges(changes: ChangesPayload): boolean {
    return (
      !changes.captures?.updated &&
      !changes.captures?.deleted &&
      !changes.thoughts?.updated &&
      !changes.thoughts?.deleted &&
      !changes.ideas?.updated &&
      !changes.ideas?.deleted &&
      !changes.todos?.updated &&
      !changes.todos?.deleted
    );
  }

  /**
   * Update sync status for all entities
   */
  private async updateAllEntitiesStatus(
    status: 'success' | 'error' | 'in_progress',
    error?: string,
  ): Promise<void> {
    const entities = ['captures', 'thoughts', 'ideas', 'todos'];

    await Promise.all(
      entities.map((entity) => updateSyncStatus(entity, status, error)),
    );
  }

  /**
   * Categorize error into SyncResult enum
   */
  private categorizeError(error: any): SyncResult {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return SyncResult.AUTH_ERROR;
    }

    if (error?.response?.status === 409) {
      return SyncResult.CONFLICT;
    }

    if (error?.response?.status >= 500) {
      return SyncResult.SERVER_ERROR;
    }

    if (
      error?.code === 'ETIMEDOUT' ||
      error?.message?.includes('timeout')
    ) {
      return SyncResult.TIMEOUT;
    }

    if (error?.message?.includes('Network request failed')) {
      return SyncResult.NETWORK_ERROR;
    }

    return SyncResult.SERVER_ERROR;
  }
}

/**
 * Singleton instance (optional - can use DI instead)
 */
let syncServiceInstance: SyncService | null = null;

export function getSyncService(baseUrl?: string): SyncService {
  if (!syncServiceInstance) {
    if (!baseUrl) {
      throw new Error('baseUrl required for first initialization');
    }
    syncServiceInstance = new SyncService(baseUrl);
  }
  return syncServiceInstance;
}
