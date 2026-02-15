/**
 * Sync Initialization Hook
 *
 * Story 6.2 - Cloud-Local Audio Sync
 * Architecture: Inject auth token into SyncService via IAuthService abstraction
 *
 * Benefits:
 * - No direct Supabase dependency (easy to swap providers)
 * - Single point of change when upgrading auth provider
 * - Easy to test (mock IAuthService)
 */

import { useEffect } from "react";
import { container } from "../../infrastructure/di/container";
import { SyncService } from "../../infrastructure/sync/SyncService";
import { AutoSyncOrchestrator } from "../../infrastructure/sync/AutoSyncOrchestrator";
import type { IAuthService } from "../../contexts/identity/domain/IAuthService";

/**
 * Initialize SyncService with authentication token
 *
 * - Listens to auth state changes via IAuthService (provider-agnostic)
 * - Injects access_token into SyncService when user logs in
 * - Clears token when user logs out
 */
export function useSyncInitialization() {
  useEffect(() => {
    let orchestrator: AutoSyncOrchestrator | null = null;

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
    };
  }, []);
}
