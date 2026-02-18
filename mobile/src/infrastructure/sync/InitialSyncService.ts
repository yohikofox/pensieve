/**
 * InitialSyncService
 * Story 6.3 - Task 1: Initial Full Sync on First Login
 *
 * Handles first-time sync with progress tracking
 */

// ADR-022: sync metadata must use OP-SQLite (via SyncStorage), NOT AsyncStorage
import { getLastPulledAt, updateLastPulledAt } from './SyncStorage';
import type { SyncService } from './SyncService';
import { SyncResult } from './types';

/**
 * Progress callback type
 */
export type ProgressCallback = (percentage: number) => void;

/**
 * InitialSyncService
 * Detects first login and performs full sync with progress tracking
 */
export class InitialSyncService {
  private baseUrl: string;
  private syncService: SyncService;

  // Entities to sync (Task 1.5)
  private readonly ENTITIES = ['captures', 'thoughts', 'ideas', 'todos'];

  constructor(baseUrl: string, syncService: SyncService) {
    this.baseUrl = baseUrl;
    this.syncService = syncService;
  }

  /**
   * Task 1.1: Detect first login (no lastPulledAt in OP-SQLite sync_metadata)
   * Checks if captures entity has been synced before
   */
  async isFirstSync(): Promise<boolean> {
    const lastPulled = await getLastPulledAt('captures');
    return lastPulled === 0; // 0 = never synced (default value)
  }

  /**
   * Task 1.2 & 1.3: Perform initial full sync with progress tracking
   * Task 1.4: Progress indicator (percentage-based)
   * Task 1.5: Download ALL entities
   * Task 1.6: Populate local OP-SQLite database
   * Task 1.7: Set lastPulledAt after success
   */
  async performInitialSync(
    authToken: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    console.log('[InitialSync] Starting first-time sync...');

    // Task 1.4: Initialize progress at 0%
    onProgress?.(0);

    // Task 1.2: Set auth token before syncing
    this.syncService.setAuthToken(authToken);

    // Task 1.2: Trigger full sync (forceFull = true ignores lastPulledAt)
    const syncResult = await this.syncService.sync({ forceFull: true });

    // Report progress during sync (simplified: assume sync completes = 50%)
    onProgress?.(50);

    // Task 1.7: Set lastPulledAt ONLY if sync succeeds
    if (syncResult.result === SyncResult.SUCCESS && syncResult.timestamp) {
      console.log('[InitialSync] Sync successful, updating lastPulledAt...');

      // Update lastPulledAt for all entities via OP-SQLite (ADR-022)
      for (const entity of this.ENTITIES) {
        await updateLastPulledAt(entity, syncResult.timestamp);
      }

      // Task 1.4: Report 100% completion
      onProgress?.(100);

      console.log('[InitialSync] ✅ Initial sync completed successfully');
    } else {
      console.error('[InitialSync] ❌ Sync failed:', syncResult.error);
      // Do NOT set lastPulledAt on failure (Task 1.7)
      throw new Error(`Initial sync failed: ${syncResult.error || 'Unknown error'}`);
    }
  }
}
