/**
 * ISyncQueueService - Domain Interface for Sync Queue Management
 *
 * Manages offline operations queue for later synchronization with backend.
 * Implements FIFO (First-In-First-Out) queue with retry logic.
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC1: Persist All Captures Locally with Sync Status
 *
 * NFR7: 100% offline availability - queue must persist across app restarts
 */

export type EntityType = 'capture' | 'user' | 'settings';
export type OperationType = 'create' | 'update' | 'delete' | 'conflict';

export interface SyncQueueItem {
  id: number; // Auto-increment primary key
  entityType: EntityType;
  entityId: string;
  operation: OperationType;
  payload: string; // JSON serialized entity data
  createdAt: Date;
  retryCount: number;
  lastError?: string;
  maxRetries: number;
}

export interface ISyncQueueService {
  /**
   * Add operation to sync queue
   *
   * @param entityType - Type of entity to sync
   * @param entityId - ID of entity
   * @param operation - Operation type (create/update/delete)
   * @param payload - Serialized entity data
   * @returns Queue item ID
   */
  enqueue(
    entityType: EntityType,
    entityId: string,
    operation: OperationType,
    payload: Record<string, any>
  ): Promise<number>;

  /**
   * Get pending operations in FIFO order
   *
   * @param limit - Max number of items to return (default: 50)
   * @returns Array of pending sync items
   */
  getPendingOperations(limit?: number): Promise<SyncQueueItem[]>;

  /**
   * Get pending operations for specific entity
   *
   * @param entityType - Entity type filter
   * @param entityId - Entity ID filter
   * @returns Array of pending sync items for entity
   */
  getPendingOperationsForEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<SyncQueueItem[]>;

  /**
   * Mark operation as successfully synced (remove from queue)
   *
   * @param queueItemId - Queue item ID to remove
   */
  markAsSynced(queueItemId: number): Promise<void>;

  /**
   * Mark operation as failed and increment retry count
   *
   * @param queueItemId - Queue item ID
   * @param error - Error message
   */
  markAsFailed(queueItemId: number, error: string): Promise<void>;

  /**
   * Get count of pending operations
   *
   * @returns Total count of items in queue
   */
  getQueueSize(): Promise<number>;

  /**
   * Get count of pending operations by entity type
   *
   * @param entityType - Entity type filter
   * @returns Count of items for entity type
   */
  getQueueSizeByType(entityType: EntityType): Promise<number>;

  /**
   * Remove operation that exceeded max retries
   *
   * Called after operation fails too many times
   * Logs error for manual intervention
   *
   * @param queueItemId - Queue item ID to remove
   */
  removeFailedOperation(queueItemId: number): Promise<void>;

  /**
   * Clear all queue items (for testing/debug only)
   */
  clearQueue(): Promise<void>;
}
