import { injectable, inject } from 'tsyringe';
import { NetworkMonitor } from '../network/NetworkMonitor';
import { SyncService } from './SyncService';
import { SyncResult } from './types';

/**
 * AutoSyncOrchestrator
 *
 * Orchestre la synchronisation automatique en réaction aux événements réseau.
 * Implémente AC1: Auto-sync trigger quand réseau revient.
 *
 * Responsibilities:
 * - Démarre NetworkMonitor au boot
 * - Écoute transitions offline → online
 * - Trigger SyncService.sync() automatiquement
 * - Gère les retries via retry-logic (Fibonacci backoff)
 *
 * Usage:
 * ```typescript
 * // Dans bootstrap.ts
 * const orchestrator = container.resolve(AutoSyncOrchestrator);
 * orchestrator.start();
 * ```
 */
@injectable()
export class AutoSyncOrchestrator {
  private cleanupListener: (() => void) | null = null;
  private isStarted: boolean = false;

  constructor(
    private networkMonitor: NetworkMonitor,
    private syncService: SyncService,
  ) {}

  /**
   * Démarre l'orchestration auto-sync.
   * Subscribe aux changements réseau et trigger sync au retour online.
   */
  public start(): void {
    if (this.isStarted) {
      console.warn('[AutoSyncOrchestrator] Already started');
      return;
    }

    console.log('[AutoSyncOrchestrator] Starting auto-sync orchestration...');

    // Subscribe network changes
    this.cleanupListener = this.networkMonitor.addListener(
      this.handleNetworkChange,
    );

    // Start network monitoring
    this.networkMonitor.start();

    this.isStarted = true;

    console.log('[AutoSyncOrchestrator] ✅ Auto-sync orchestration started');
  }

  /**
   * Arrête l'orchestration auto-sync.
   */
  public stop(): void {
    if (!this.isStarted) {
      return;
    }

    console.log('[AutoSyncOrchestrator] Stopping auto-sync orchestration...');

    // Cleanup network listener
    if (this.cleanupListener) {
      this.cleanupListener();
      this.cleanupListener = null;
    }

    // Stop network monitoring
    this.networkMonitor.stop();

    this.isStarted = false;

    console.log('[AutoSyncOrchestrator] ❌ Auto-sync orchestration stopped');
  }

  /**
   * Handler appelé par NetworkMonitor lors des changements réseau.
   *
   * AC1: Trigger sync automatique quand réseau revient (offline → online).
   * ADR-023: Pas de try/catch - SyncService.sync() retourne Result Pattern.
   *
   * @param isConnected - true = online, false = offline
   */
  private handleNetworkChange = async (isConnected: boolean): Promise<void> => {
    if (!isConnected) {
      console.log(
        '[AutoSyncOrchestrator] 📴 Network offline, sync paused',
      );
      return;
    }

    console.log(
      '[AutoSyncOrchestrator] 📶 Network online, triggering sync...',
    );

    // AC1: Trigger sync automatique (NetworkMonitor a déjà fait le debounce 5s)
    // ADR-023 Fix: SyncService.sync() retourne Result Pattern, pas besoin de try/catch
    const response = await this.syncService.sync({
      priority: 'high', // Network restoration = high priority
    });

    if (response.result === SyncResult.SUCCESS) {
      console.log(
        '[AutoSyncOrchestrator] ✅ Auto-sync completed successfully',
      );

      if (response.conflicts && response.conflicts.length > 0) {
        console.warn(
          `[AutoSyncOrchestrator] ⚠️ Sync completed with ${response.conflicts.length} conflicts resolved`,
        );
      }
    } else {
      console.error(
        '[AutoSyncOrchestrator] ❌ Auto-sync failed:',
        response.error,
      );

      // Retry logic is already handled inside SyncService via retryWithFibonacci
      // No need to retry here (would cause duplicate retries)
      if (response.retryable) {
        console.log(
          '[AutoSyncOrchestrator] 🔁 Sync will be retried on next network event or manual trigger',
        );
      }
    }
  };
}
