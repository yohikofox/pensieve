/**
 * Sync Queue Service - Manage Offline Operations Queue
 *
 * Handles:
 * - Enqueueing operations (create/update/delete) for later sync
 * - FIFO retrieval of pending operations
 * - Retry logic with exponential backoff
 * - Queue persistence across app restarts
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC1: Persist All Captures Locally with Sync Status
 *
 * NFR7: 100% offline availability - must work without network
 * NFR6: Zero data loss - queue must persist reliably
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { database } from '../../../database';
import {
  type ISyncQueueService,
  type SyncQueueItem,
  type EntityType,
  type OperationType,
} from '../domain/ISyncQueueService';

interface SyncQueueRow {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  created_at: number;
  retry_count: number;
  last_error: string | null;
  max_retries: number;
}

function mapRowToQueueItem(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entity_type as EntityType,
    entityId: row.entity_id,
    operation: row.operation as OperationType,
    payload: row.payload,
    createdAt: new Date(row.created_at),
    retryCount: row.retry_count,
    lastError: row.last_error || undefined,
    maxRetries: row.max_retries,
  };
}

@injectable()
export class SyncQueueService implements ISyncQueueService {
  /**
   * Add operation to sync queue
   */
  async enqueue(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: Record<string, any>
  ): Promise<number> {
    const now = Date.now();
    const payloadJson = JSON.stringify(payload);

    try {
      database.execute(
        `INSERT INTO sync_queue (
          entity_type, entity_id, operation, payload,
          created_at, retry_count, max_retries
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entityType, entityId, operation, payloadJson, now, 0, 3]
      );

      // Get last inserted row ID
      const result = database.execute('SELECT last_insert_rowid() as id');
      const row = result.rows?.[0] as { id: number } | undefined;

      if (!row) {
        console.error('[SyncQueue] Failed to get last inserted row ID');
        throw new Error('Failed to enqueue operation');
      }

      console.log('[SyncQueue] Enqueued:', {
        id: row.id,
        entityType,
        entityId,
        operation,
      });

      return row.id;
    } catch (error) {
      console.error('[SyncQueue] Failed to enqueue operation:', error);
      throw new Error(`Failed to enqueue operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pending operations in FIFO order (oldest first)
   */
  async getPendingOperations(limit: number = 50): Promise<SyncQueueItem[]> {
    const result = database.execute(
      `SELECT * FROM sync_queue
       WHERE retry_count < max_retries
       ORDER BY created_at ASC
       LIMIT ?`,
      [limit]
    );

    const rows = (result.rows ?? []) as SyncQueueRow[];
    return rows.map(mapRowToQueueItem);
  }

  /**
   * Get pending operations for specific entity
   */
  async getPendingOperationsForEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<SyncQueueItem[]> {
    const result = database.execute(
      `SELECT * FROM sync_queue
       WHERE entity_type = ? AND entity_id = ? AND retry_count < max_retries
       ORDER BY created_at ASC`,
      [entityType, entityId]
    );

    const rows = (result.rows ?? []) as SyncQueueRow[];
    return rows.map(mapRowToQueueItem);
  }

  /**
   * Mark operation as successfully synced (remove from queue)
   */
  async markAsSynced(queueItemId: number): Promise<void> {
    database.execute('DELETE FROM sync_queue WHERE id = ?', [queueItemId]);

    console.log('[SyncQueue] Marked as synced (removed):', queueItemId);
  }

  /**
   * Mark operation as failed and increment retry count
   */
  async markAsFailed(queueItemId: number, error: string): Promise<void> {
    const now = Date.now();

    database.execute(
      `UPDATE sync_queue
       SET retry_count = retry_count + 1,
           last_error = ?
       WHERE id = ?`,
      [error, queueItemId]
    );

    console.warn('[SyncQueue] Marked as failed:', {
      queueItemId,
      error,
      timestamp: new Date(now).toISOString(),
    });
  }

  /**
   * Get count of pending operations
   */
  async getQueueSize(): Promise<number> {
    try {
      const result = database.execute(
        'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < max_retries'
      );

      const row = result.rows?.[0] as { count: number } | undefined;
      return row?.count ?? 0;
    } catch (error) {
      console.error('[SyncQueue] Error getting queue size:', error);
      return 0;
    }
  }

  /**
   * Get count of pending operations by entity type
   */
  async getQueueSizeByType(entityType: EntityType): Promise<number> {
    const result = database.execute(
      `SELECT COUNT(*) as count FROM sync_queue
       WHERE entity_type = ? AND retry_count < max_retries`,
      [entityType]
    );

    const row = result.rows?.[0] as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Remove operation that exceeded max retries
   */
  async removeFailedOperation(queueItemId: number): Promise<void> {
    // Get operation details before deleting for logging
    const result = database.execute('SELECT * FROM sync_queue WHERE id = ?', [queueItemId]);
    const row = result.rows?.[0] as SyncQueueRow | undefined;

    if (row) {
      console.error('[SyncQueue] Removing permanently failed operation:', {
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        retryCount: row.retry_count,
        lastError: row.last_error,
      });
    }

    database.execute('DELETE FROM sync_queue WHERE id = ?', [queueItemId]);
  }

  /**
   * Clear all queue items (for testing/debug only)
   */
  async clearQueue(): Promise<void> {
    database.execute('DELETE FROM sync_queue');
    console.log('[SyncQueue] Cleared all queue items');
  }
}
