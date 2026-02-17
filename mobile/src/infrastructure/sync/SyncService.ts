/**
 * SyncService
 * Main synchronization orchestrator for mobile ↔ backend sync
 *
 * Story 6.1 - Task 3: Mobile Sync Service with OP-SQLite
 * Implements ADR-009 sync protocol with manual implementation
 * Story 6.2 - Task 9.5: UI status updates integration
 */

import { DatabaseConnection } from '../../database';
import type { DB } from '@op-engineering/op-sqlite';
import { fetchWithRetry } from '../http/fetchWithRetry';
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
import { getConflictHandler } from './ConflictHandler';
import type { EventBus } from '@/contexts/shared/events/EventBus';
import type { SyncCompletedEvent } from './events/SyncEvents';
import { useSyncStatusStore } from '@/stores/SyncStatusStore';
import { injectable } from 'tsyringe';

// Sync configuration
const CHUNK_SIZE = 100; // Task 3.7: Max records per sync batch
const SYNC_TIMEOUT_MS = 30000; // 30 seconds

// Security: Entity whitelist to prevent SQL injection
const VALID_ENTITIES = ['captures', 'thoughts', 'ideas', 'todos'] as const;

/**
 * Validate entity name to prevent SQL injection
 */
function validateEntity(entity: string): entity is typeof VALID_ENTITIES[number] {
  return VALID_ENTITIES.includes(entity as any);
}

/**
 * SyncService
 * Handles bidirectional sync between mobile and backend
 */
@injectable()
export class SyncService {
  private db: DB;
  private baseUrl: string;
  private authToken: string | null = null;
  private eventBus: EventBus | null = null;

  constructor(baseUrl: string, eventBus?: EventBus) {
    this.baseUrl = baseUrl;
    this.db = DatabaseConnection.getInstance().getDatabase();
    this.eventBus = eventBus || null;
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Main sync method - orchestrates pull and push
   * Task 3.2: Implement sync(options) method
   * Task 9.5: Update UI status during sync
   */
  async sync(options?: SyncOptions): Promise<SyncResponse> {
    console.log('[Sync] 🔄 Starting sync...', options);

    // Task 9.5: Update UI status to syncing
    useSyncStatusStore.getState().setSyncing();

    // Validate auth token
    if (!this.authToken) {
      const errorMessage = 'No authentication token';
      useSyncStatusStore.getState().setError(errorMessage);

      return {
        result: SyncResult.AUTH_ERROR,
        error: errorMessage,
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

      // Step 3: Apply conflict resolutions (Task 4)
      // Note: Backend processPush already returns latest server changes,
      // so no need for additional PULL here (backend calls processPull internally)
      if (pushResult.conflicts && pushResult.conflicts.length > 0) {
        const conflictHandler = getConflictHandler();
        await conflictHandler.applyConflicts(pushResult.conflicts);
      }

      // Mark sync as success
      await this.updateAllEntitiesStatus('success');

      console.log('[Sync] ✅ Sync completed successfully');

      // Task 9.5: Update UI status to synced with current timestamp
      const syncCompletionTime = Date.now();
      useSyncStatusStore.getState().setSynced(syncCompletionTime);

      // Publish SyncSuccess event for UploadOrchestrator (Task 6.6)
      if (this.eventBus && pushResult.syncedCaptureIds) {
        this.eventBus.publish({
          type: 'SyncSuccess',
          timestamp: syncCompletionTime,
          payload: {
            syncedCaptureIds: pushResult.syncedCaptureIds,
          },
        });
      }

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: pushResult.timestamp,
        conflicts: pushResult.conflicts,
      };
    } catch (error) {
      console.error('[Sync] ❌ Sync failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark sync as error
      await this.updateAllEntitiesStatus('error', errorMessage);

      // Task 9.5: Update UI status to error
      useSyncStatusStore.getState().setError(errorMessage);

      // Determine if error is retryable
      const retryable = isRetryableError(error);

      return {
        result: this.categorizeError(error),
        error: errorMessage,
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

      // Use oldest timestamp for full consistency (or 0 if no history)
      const lastPulledAt = lastPulledTimes.length > 0
        ? Math.min(...lastPulledTimes)
        : 0;

      // Story 6.3 - Task 4.4: Batching for large datasets (100 records max per batch)
      let batchNumber = 1;
      let offset = 0;
      let totalChangesCount = 0;
      let hasMoreBatches = true;
      let finalTimestamp = Date.now();
      let allConflicts: any[] = []; // Story 6.3 - Task 7.3: Collect conflicts from all batches

      while (hasMoreBatches) {
        // Call backend /api/sync/pull with limit/offset for batching
        const queryParams = new URLSearchParams({
          lastPulledAt: String(options?.forceFull ? 0 : lastPulledAt),
          limit: String(CHUNK_SIZE), // 100 records max per batch
          offset: String(offset),
        });
        const pullUrl = `${this.baseUrl}/api/sync/pull?${queryParams}`;
        console.log(`[Sync] 📦 Pulling batch ${batchNumber} (offset: ${offset})...`);

        const response = await retryWithFibonacci(
          async () => {
            const httpResponse = await fetchWithRetry(pullUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`,
              },
              timeout: SYNC_TIMEOUT_MS,
              retries: 3,
            });

            if (!httpResponse.ok) {
              throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
            }

            return httpResponse.json();
          },
          10,
          (attempt, delay) => {
            console.log(
              `[Sync] PULL batch ${batchNumber} retry attempt ${attempt}, waiting ${delay / 1000}s...`,
            );
          },
        );

        // Apply server changes to local database
        const changesCount = await this.applyServerChanges(response.changes);
        totalChangesCount += changesCount;

        // Story 6.3 - Task 7.3: Collect conflicts from this batch
        if (response.conflicts && response.conflicts.length > 0) {
          allConflicts = [...allConflicts, ...response.conflicts];
          console.log(`[Sync] 📦 Batch ${batchNumber}: ${response.conflicts.length} conflict(s) detected`);
        }

        // Story 6.3 - Task 4.5: Update lastPulledAt after each batch success
        if (changesCount > 0) {
          for (const entity of entities) {
            await updateLastPulledAt(entity, response.timestamp);
          }
        }

        finalTimestamp = response.timestamp;

        // Check if there are more batches
        // If current batch returned fewer records than CHUNK_SIZE, it's the last batch
        hasMoreBatches = changesCount >= CHUNK_SIZE;

        console.log(
          `[Sync] ✅ Batch ${batchNumber} completed (${changesCount} changes)`,
        );

        if (hasMoreBatches) {
          offset += CHUNK_SIZE;
          batchNumber++;
        }
      }

      // Story 6.3 - Task 7.3: Apply conflict resolutions from all batches
      if (allConflicts.length > 0) {
        console.log(`[Sync] 🔀 Resolving ${allConflicts.length} conflict(s) from PULL...`);
        try {
          const conflictHandler = getConflictHandler();
          await conflictHandler.applyConflicts(allConflicts);
        } catch (conflictError) {
          // Log error but continue sync (conflicts are not critical to core sync)
          console.error('[Sync] ⚠️ Conflict resolution failed:', conflictError);
        }
      }

      // Story 6.3 - Task 3.4: Emit SyncCompleted event for reactive UI updates
      if (this.eventBus && totalChangesCount > 0) {
        const event: SyncCompletedEvent = {
          type: 'SyncCompleted',
          timestamp: Date.now(),
          payload: {
            entities,
            direction: 'pull',
            changesCount: totalChangesCount,
            source: options?.source || 'manual',
          },
        };
        this.eventBus.publish(event);
        console.log(`[Sync] 📢 Emitted SyncCompleted event (${totalChangesCount} total changes)`);
      }

      console.log(`[Sync] ✅ PULL phase completed (${batchNumber} batch(es), ${totalChangesCount} total changes)`);

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        timestamp: finalTimestamp,
        data: {}, // Note: data is empty in batched mode (changes already applied)
        conflicts: allConflicts, // Return conflicts for testing/logging
      };
    } catch (error: any) {
      const url = `${this.baseUrl}/api/sync/pull`;
      const status = this.extractStatusFromError(error);
      console.error(`[Sync] ❌ PULL failed (${status}): ${url}`, error?.message);
      throw error;
    }
  }

  /**
   * PUSH phase - Send local changes to server
   * Story 6.2 - Task 2.5: Implements batching loop for > 100 records
   */
  private async performPush(options?: SyncOptions): Promise<SyncResponse> {
    console.log('[Sync] 📤 Starting PUSH phase...');

    try {
      const entities = options?.entity
        ? [options.entity]
        : ['captures', 'thoughts', 'ideas', 'todos'];

      // Get lastPulledAt for conflict detection
      const lastPulledTimes = await Promise.all(
        entities.map((entity) => getLastPulledAt(entity)),
      );
      const lastPulledAt = Math.min(...lastPulledTimes);

      // Task 2.5: Batching loop - send changes in batches of CHUNK_SIZE
      let batchNumber = 1;
      let allConflicts: any[] = [];
      let syncedCaptureIds: string[] = []; // Task 6.6: Collect synced capture IDs
      let hasMoreChanges = true;

      while (hasMoreChanges) {
        // Detect local changes for current batch (LIMIT 100 per batch)
        const changes = await this.detectLocalChanges(entities);

        // Skip if no changes in this batch
        if (this.isEmptyChanges(changes)) {
          console.log(
            batchNumber === 1
              ? '[Sync] ℹ️ No local changes to push'
              : `[Sync] ✅ Batch ${batchNumber - 1} was the last batch`,
          );
          hasMoreChanges = false;
          break;
        }

        console.log(`[Sync] 📦 Pushing batch ${batchNumber}...`);

        // Call backend /api/sync/push for this batch
        const pushUrl = `${this.baseUrl}/api/sync/push`;
        const response = await retryWithFibonacci(
          async () => {
            const payload: PushRequest = {
              lastPulledAt: lastPulledAt,
              changes,
            };

            const httpResponse = await fetchWithRetry(pushUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`,
              },
              body: JSON.stringify(payload),
              timeout: SYNC_TIMEOUT_MS,
              retries: 3,
            });

            if (!httpResponse.ok) {
              throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
            }

            return httpResponse.json();
          },
          10,
          (attempt, delay) => {
            console.log(
              `[Sync] PUSH batch ${batchNumber} retry attempt ${attempt}, waiting ${delay / 1000}s...`,
            );
          },
        );

        // Mark pushed records as synced (_changed = 0)
        await this.markRecordsAsSynced(changes);

        // Collect capture IDs for SyncSuccess event (Task 6.6)
        if (changes.captures) {
          const captureIds = [
            ...(changes.captures.updated?.map((c) => c.id) || []),
            ...(changes.captures.deleted?.map((c) => c.id) || []),
          ];
          syncedCaptureIds = [...syncedCaptureIds, ...captureIds];
        }

        // Collect conflicts from this batch
        if (response.conflicts && response.conflicts.length > 0) {
          allConflicts = [...allConflicts, ...response.conflicts];
        }

        // Check if there are more changes (if current batch was full, likely more exist)
        const totalRecordsInBatch = this.countRecordsInChanges(changes);
        hasMoreChanges = totalRecordsInBatch >= CHUNK_SIZE;

        console.log(
          `[Sync] ✅ Batch ${batchNumber} pushed (${totalRecordsInBatch} records)`,
        );

        batchNumber++;
      }

      // Update lastPushedAt for all entities
      for (const entity of entities) {
        await updateLastPushedAt(entity, Date.now());
      }

      console.log(
        `[Sync] ✅ PUSH phase completed (${batchNumber - 1} batch${batchNumber > 2 ? 'es' : ''})`,
      );

      return {
        result: SyncResult.SUCCESS,
        retryable: false,
        conflicts: allConflicts.length > 0 ? allConflicts : undefined,
        syncedCaptureIds: syncedCaptureIds.length > 0 ? syncedCaptureIds : undefined,
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
        // Security: Validate entity to prevent SQL injection
        if (!validateEntity(entity)) {
          console.error(`[Sync] Invalid entity: ${entity} (SQL injection prevented)`);
          continue;
        }

        // Query for changed records (entity validated - safe to interpolate)
        const result = this.db.executeSync(
          `SELECT * FROM ${entity} WHERE _changed = 1 LIMIT ${CHUNK_SIZE}`,
        );

        if (result.rows && result.rows.length > 0) {
          // OP-SQLite returns rows in _array property
          const records = (result.rows as any)._array || result.rows;

          // Group by status
          const updated = records.filter((r: any) => r._status === 'active');
          const deleted = records.filter((r: any) => r._status === 'deleted');

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
  private async applyServerChanges(changes: ChangesPayload): Promise<number> {
    console.log('[Sync] 📝 Applying server changes...');

    let changesCount = 0;

    for (const [entity, entityChanges] of Object.entries(changes)) {
      if (!entityChanges) continue;

      // Apply updated records
      if (entityChanges.updated) {
        for (const record of entityChanges.updated) {
          await this.upsertRecord(entity, record);
          changesCount++;
        }
      }

      // Apply deleted records
      if (entityChanges.deleted) {
        for (const record of entityChanges.deleted) {
          await this.markRecordDeleted(entity, record.id);
          changesCount++;
        }
      }
    }

    console.log(`[Sync] ✅ Server changes applied (${changesCount} changes)`);
    return changesCount;
  }

  /**
   * Upsert record into local database
   */
  private async upsertRecord(entity: string, record: any): Promise<void> {
    try {
      // Security: Validate entity to prevent SQL injection
      // ADR-023 Fix: Log error instead of throw (private method, error logged)
      if (!validateEntity(entity)) {
        console.error(`[Sync] Invalid entity: ${entity} (SQL injection prevented)`);
        return; // Skip this record instead of throwing
      }

      // Check if record exists
      const existing = this.db.executeSync(
        `SELECT id FROM ${entity} WHERE id = ?`,
        [record.id],
      );

      if (existing.rows && existing.rows.length > 0) {
        // Update existing record
        // Security: Filter column names to prevent SQL injection
        const columns = Object.keys(record).filter((col) =>
          /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col) // Only valid SQL identifiers
        );
        const setClause = columns.map((col) => `${col} = ?`).join(', ');
        const values = columns.map((col) => record[col]);

        this.db.executeSync(
          `UPDATE ${entity} SET ${setClause}, _changed = 0 WHERE id = ?`,
          [...values, record.id],
        );
      } else {
        // Insert new record
        // Security: Filter column names to prevent SQL injection
        const columns = Object.keys(record).filter((col) =>
          /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col) // Only valid SQL identifiers
        );
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
      // Security: Validate entity to prevent SQL injection
      // ADR-023 Fix: Log error instead of throw (private method, error logged)
      if (!validateEntity(entity)) {
        console.error(`[Sync] Invalid entity: ${entity} (SQL injection prevented)`);
        return; // Skip this record instead of throwing
      }

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

      // Security: Validate entity to prevent SQL injection
      if (!validateEntity(entity)) {
        console.error(`[Sync] Invalid entity: ${entity} (SQL injection prevented)`);
        continue;
      }

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
   * Count total records in changes payload
   * Task 2.5: Used to determine if more batches are needed
   */
  private countRecordsInChanges(changes: ChangesPayload): number {
    let count = 0;

    for (const entityChanges of Object.values(changes)) {
      if (entityChanges) {
        count += (entityChanges.updated?.length || 0) + (entityChanges.deleted?.length || 0);
      }
    }

    return count;
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
   * Extract HTTP status code from error (fetch-compatible)
   */
  private extractStatusFromError(error: any): number | string {
    // Extract from "HTTP 500: ..." error message
    const match = error?.message?.match(/HTTP (\d+):/);
    if (match) {
      return parseInt(match[1], 10);
    }

    return 'unknown';
  }

  /**
   * Categorize error into SyncResult enum (fetch-compatible)
   * ADR-025: Updated for fetch errors (no error.response.status)
   */
  private categorizeError(error: any): SyncResult {
    const status = this.extractStatusFromError(error);

    // Auth errors (401, 403)
    if (status === 401 || status === 403) {
      return SyncResult.AUTH_ERROR;
    }

    // Conflict error (409)
    if (status === 409) {
      return SyncResult.CONFLICT;
    }

    // Server errors (5xx)
    if (typeof status === 'number' && status >= 500) {
      return SyncResult.SERVER_ERROR;
    }

    // Timeout errors
    if (
      error?.name === 'AbortError' ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('aborted')
    ) {
      return SyncResult.TIMEOUT;
    }

    // Network errors (fetch TypeError)
    if (
      error instanceof TypeError ||
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('Failed to fetch')
    ) {
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
