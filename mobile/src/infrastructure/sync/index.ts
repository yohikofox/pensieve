/**
 * Sync Module - Mobile Synchronization Infrastructure
 * Story 6.1 - Task 3: Mobile Sync Service with OP-SQLite
 *
 * Exports all sync-related types and services
 */

// Main service
export { SyncService, getSyncService } from './SyncService';

// Storage
export {
  getSyncMetadata,
  setSyncMetadata,
  getLastPulledAt,
  updateLastPulledAt,
  updateLastPushedAt,
  updateSyncStatus,
  clearAllSyncMetadata,
} from './SyncStorage';

// Types
export {
  SyncResult,
  type SyncResponse,
  type SyncConflict,
  type EntityChanges,
  type ChangesPayload,
  type PullRequest,
  type PushRequest,
  type SyncOptions,
  type SyncMetadata,
} from './types';

// Retry logic
export {
  getRetryDelay,
  sleep,
  retryWithFibonacci,
  isRetryableError,
} from './retry-logic';
