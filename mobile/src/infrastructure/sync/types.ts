/**
 * Sync Types & Interfaces
 * Story 6.1 - Task 3: Mobile Sync Service
 *
 * Implements ADR-009.5: Result Pattern for error handling
 */

/**
 * Sync result enum (Task 3.6: Result Pattern)
 */
export enum SyncResult {
  SUCCESS = 'success',
  NETWORK_ERROR = 'network_error',
  AUTH_ERROR = 'auth_error',
  CONFLICT = 'conflict',
  SERVER_ERROR = 'server_error',
  TIMEOUT = 'timeout',
}

/**
 * Sync response structure
 */
export interface SyncResponse {
  result: SyncResult;
  data?: any;
  error?: string;
  retryable: boolean;
  timestamp?: number; // New server timestamp from response
  conflicts?: SyncConflict[];
  syncedCaptureIds?: string[]; // Capture IDs that were synced (for SyncSuccess event - Task 6.6)
}

/**
 * Conflict information from server
 */
export interface SyncConflict {
  entity: string;
  record_id: string;
  conflict_type: string;
  resolution: 'client_wins' | 'server_wins' | 'merged';
}

/**
 * Entity change payload for push
 */
export interface EntityChanges {
  updated?: any[];
  deleted?: any[];
}

/**
 * Changes payload grouping all entities
 */
export interface ChangesPayload {
  captures?: EntityChanges;
  thoughts?: EntityChanges;
  ideas?: EntityChanges;
  todos?: EntityChanges;
}

/**
 * Pull request parameters
 */
export interface PullRequest {
  lastPulledAt: number; // Milliseconds timestamp (camelCase for backend DTO compatibility)
}

/**
 * Push request parameters
 */
export interface PushRequest {
  lastPulledAt: number; // camelCase for backend DTO compatibility
  changes: ChangesPayload;
}

/**
 * Sync options for controlling sync behavior
 */
export interface SyncOptions {
  /**
   * Entity priority: higher priority entities sync first
   * Default: undefined (sync all)
   */
  entity?: 'captures' | 'thoughts' | 'ideas' | 'todos';

  /**
   * Priority level for queue ordering
   * Default: undefined (normal priority)
   */
  priority?: number;

  /**
   * Force full sync (ignore lastPulledAt)
   * Default: false
   */
  forceFull?: boolean;
}

/**
 * Sync metadata stored in AsyncStorage
 */
export interface SyncMetadata {
  entity: string;
  last_pulled_at: number;
  last_pushed_at: number;
  last_sync_status: 'success' | 'error' | 'in_progress';
  last_sync_error?: string;
  updated_at: number;
}
