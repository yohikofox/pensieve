/**
 * Sync Initialization Hook
 *
 * Story 6.2 - Cloud-Local Audio Sync
 * Story 6.3 - Task 8: Background Sync (PeriodicSyncService integration)
 * Architecture: Inject auth token into SyncService via IAuthService abstraction
 *
 * Benefits:
 * - No direct auth provider dependency (easy to swap)
 * - Single point of change when upgrading auth provider
 * - Easy to test (mock IAuthService)
 */

import { useEffect } from "react";
import { container } from "../../infrastructure/di/container";
import { SyncService } from "../../infrastructure/sync/SyncService";
import { AutoSyncOrchestrator } from "../../infrastructure/sync/AutoSyncOrchestrator";
import { PeriodicSyncService } from "../../infrastructure/sync/PeriodicSyncService";
import { NetworkMonitor } from "../../infrastructure/network/NetworkMonitor";
import { useSyncStatusStore } from "../../stores/SyncStatusStore";
import { useToast } from "../../design-system/components";
import type { IAuthService } from "../../contexts/identity/domain/IAuthService";

/**
 * Initialize SyncService with authentication token
 *
 * - Listens to auth state changes via IAuthService (provider-agnostic)
 * - Injects access_token into SyncService when user logs in
 * - Clears token when user logs out
 * - Story 6.3 Task 8: Starts PeriodicSyncService for 15-min polling (ADR-009.1)
 */
export function useSyncInitialization() {
  const toast = useToast();

  // AC9 Task 9.4: Toast "Synced" (2s) lors de la transition syncing → synced
  useEffect(() => {
    const unsubscribe = useSyncStatusStore.subscribe((state, prevState) => {
      if (prevState.status === "syncing" && state.status === "synced") {
        toast.success("Synced");
      }
    });
    return unsubscribe;
  }, [toast]);

  useEffect(() => {
    let orchestrator: AutoSyncOrchestrator | null = null;
    let periodicSync: PeriodicSyncService | null = null;

    (async () => {
      try {
        const authService = container.resolve<IAuthService>("IAuthService");
        const syncService = container.resolve(SyncService);

        // CRITICAL: Await auth token BEFORE starting orchestrator
        const session = await authService.getSession();

        if (session?.accessToken) {
          console.log("[SyncInit] ✅ Auth token set");
          console.log(`[SyncInit] Auth token: ${session.accessToken}`);
          syncService.setAuthToken(session.accessToken);
        } else {
          console.log("[SyncInit] ⚠️ No session - sync will fail until login");
        }

        // NOW start orchestrator (token is set if user logged in)
        orchestrator = container.resolve(AutoSyncOrchestrator);
        orchestrator.start();
        console.log("[SyncInit] ✅ AutoSyncOrchestrator started");

        // Story 6.3 Task 8.4: Start PeriodicSyncService for 15-min background polling
        // ADR-009.1: launch + post-action + polling 15min
        const networkMonitor = container.resolve(NetworkMonitor);
        periodicSync = new PeriodicSyncService(syncService, networkMonitor);
        periodicSync.start();
        console.log("[SyncInit] ✅ PeriodicSyncService started (15min polling)");

        // Listen for future auth changes
        authService.onAuthStateChange((session) => {
          if (session?.accessToken) {
            syncService.setAuthToken(session.accessToken);
          }
        });
      } catch (error) {
        console.error("[SyncInit] ❌ Failed:", error);
      }
    })();

    return () => {
      if (orchestrator) {
        orchestrator.stop();
      }
      // Story 6.3 Task 8: Stop periodic sync when component unmounts (app backgrounded)
      if (periodicSync) {
        periodicSync.stop();
        console.log("[SyncInit] ❌ PeriodicSyncService stopped");
      }
    };
  }, []);
}
