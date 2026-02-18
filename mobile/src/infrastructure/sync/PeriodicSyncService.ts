/**
 * PeriodicSyncService - Real-Time Sync via Periodic Polling
 * Story 6.3 - Task 3: Real-Time Sync Between Devices
 *
 * Manages periodic background sync with 15-minute polling interval.
 * Only syncs when app is active and network is online.
 *
 * IMPORTANT:
 * - Uses priority "low" to avoid blocking user-initiated syncs
 * - Continues periodic sync even if individual syncs fail
 * - Safe to call start()/stop() multiple times
 */

import { SyncService } from './SyncService';
import { NetworkMonitor } from '../network/NetworkMonitor';

/**
 * Periodic Sync Service
 *
 * Polls backend every 15 minutes to pull changes.
 * Designed for real-time sync in the background.
 */
export class PeriodicSyncService {
  private readonly INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private intervalId: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly syncService: SyncService,
    private readonly networkMonitor: NetworkMonitor
  ) {}

  /**
   * Start periodic sync
   *
   * Safe to call multiple times - won't create duplicate intervals.
   */
  start(): void {
    if (this.running) {
      // Already running - do nothing
      return;
    }

    this.running = true;
    this.intervalId = setInterval(() => {
      this.performPeriodicSync();
    }, this.INTERVAL_MS);
  }

  /**
   * Stop periodic sync
   *
   * Safe to call multiple times.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  /**
   * Check if periodic sync is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Perform periodic sync (internal)
   *
   * Only syncs if network is online.
   * Uses priority "low" to avoid blocking user-initiated syncs.
   * Continues periodic sync even if individual sync fails.
   */
  private async performPeriodicSync(): Promise<void> {
    // Skip if offline
    const isOnline = await this.networkMonitor.getCurrentState();
    if (!isOnline) {
      return;
    }

    try {
      await this.syncService.sync({
        priority: 'low',
        source: 'periodic',
      });
    } catch (error) {
      // Log error but continue periodic sync
      console.error('[PeriodicSync] Sync failed, will retry at next interval:', error);
    }
  }
}
