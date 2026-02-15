import { injectable } from "tsyringe";
import { SyncService } from "./SyncService";
import { SyncResult } from "./types";
import {
  type RepositoryResult,
  RepositoryResultType,
  success,
} from "../../contexts/shared/domain/Result";

/**
 * SyncTrigger
 *
 * Helper qui déclenche des syncs automatiques après des modifications locales.
 * Implémente AC3: Real-Time Sync Trigger avec debounce 3 secondes.
 *
 * Différence avec AutoSyncOrchestrator:
 * - AutoSyncOrchestrator = Trigger sur network change (offline → online)
 * - SyncTrigger = Trigger sur data change (save/update local)
 *
 * Features:
 * - Debounce 3 secondes pour éviter spam API
 * - Non-blocking (sync en background)
 * - Coalesce multiple changes (1 seul sync pour N modifications rapides)
 * - Result Pattern (ADR-023): Retourne Result<void> au lieu de throw
 *
 * Usage:
 * ```typescript
 * // Dans repository.save()
 * await repository.save(capture);
 * const result = syncTrigger.queueSync(); // Trigger auto sync (debounced)
 * if (result.type !== RepositoryResultType.SUCCESS) {
 *   console.error('Failed to queue sync:', result.error);
 * }
 * ```
 */
@injectable()
export class SyncTrigger {
  private syncTimeout: NodeJS.Timeout | null = null;
  private readonly debounceDelayMs: number = 3000; // AC3: 3s debounce
  private isEnabled: boolean = true;

  /**
   * @param syncService - Service de synchronisation (injected via tsyringe)
   */
  constructor(private syncService: SyncService) {
    // Debounce delay is hardcoded to avoid DI primitive injection issues
  }

  /**
   * Queue une synchronisation (debounced).
   * Si appelé plusieurs fois rapidement, seul le dernier appel déclenche un sync.
   *
   * AC3: Debounce 3 secondes pour éviter spam API.
   * ADR-023: Retourne Result<void> au lieu de throw.
   */
  public queueSync(options?: {
    priority?: string;
    entity?: string;
  }): RepositoryResult<void> {
    if (!this.isEnabled) {
      console.log("[SyncTrigger] Sync trigger disabled, skipping");
      return success(void 0);
    }

    // Clear previous timeout (debounce)
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Schedule new sync
    this.syncTimeout = setTimeout(() => {
      this.executeSync(options);
      this.syncTimeout = null;
    }, this.debounceDelayMs);

    console.log(
      `[SyncTrigger] Sync queued (debounce ${this.debounceDelayMs}ms)${options?.entity ? ` for entity: ${options.entity}` : ""}`,
    );

    return success(void 0);
  }

  /**
   * Exécute la synchronisation immédiatement (skip debounce).
   * Utilisé pour les cas critiques qui nécessitent sync immédiat.
   * ADR-023: Retourne Result<void> au lieu de throw.
   */
  public async syncNow(options?: {
    priority?: string;
    entity?: string;
  }): Promise<RepositoryResult<void>> {
    if (!this.isEnabled) {
      console.log("[SyncTrigger] Sync trigger disabled, skipping");
      return success(void 0);
    }

    // Cancel pending debounced sync
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    await this.executeSync(options);
    return success(void 0);
  }

  /**
   * Enable/disable sync trigger.
   * Utile pour désactiver temporairement (ex: pendant import bulk).
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled && this.syncTimeout) {
      // Cancel pending sync when disabling
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }

    console.log(
      `[SyncTrigger] Sync trigger ${enabled ? "enabled" : "disabled"}`,
    );
  }

  /**
   * Exécute le sync (non-blocking, en background).
   * AC3: Background sync sans bloquer UI.
   * ADR-023: SyncService.sync() retourne Result Pattern - vérifier result.type au lieu de catch.
   *
   * @param options - Options de sync (priority, entity)
   */
  private async executeSync(options?: {
    priority?: "low" | "normal" | "high" | string;
    entity?: "captures" | "thoughts" | "ideas" | "todos";
  }): Promise<void> {
    console.log("[SyncTrigger] ⏰ Executing queued sync...");

    // AC3: Non-blocking background sync
    // Note: On ne await PAS ici pour ne pas bloquer le caller
    // Le sync se fait en background (fire and forget)
    // ADR-023 Fix: Utiliser Result Pattern au lieu de .catch()
    this.syncService
      .sync({
        priority: options?.priority || "normal",
        entity: options?.entity,
      })
      .then((result) => {
        if (result.result === SyncResult.SUCCESS) {
          console.log(
            "[SyncTrigger] ✅ Background sync completed successfully",
          );
        } else {
          console.error(
            "[SyncTrigger] ❌ Background sync failed:",
            result.error,
            result.result,
          );
          // Note: Pas de throw - on ne veut pas crash l'app pour un échec de sync
        }
      });
  }

  /**
   * Cleanup - annule tous les syncs en attente.
   */
  public cleanup(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }
}
