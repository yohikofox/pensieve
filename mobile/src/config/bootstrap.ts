/**
 * Application Bootstrap
 *
 * Global configuration that must run BEFORE React renders.
 * Called once from index.ts before registerRootComponent.
 */

import { Appearance } from "react-native";
import { colorScheme as nwColorScheme } from "nativewind";
import NetInfo from "@react-native-community/netinfo";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ILogger } from "../infrastructure/logging/ILogger";
import { registerServices } from "../infrastructure/di/container";
import { useSettingsStore } from "../stores/settingsStore";
import { AutoSyncOrchestrator } from "../infrastructure/sync/AutoSyncOrchestrator";

/**
 * Bootstrap the application
 * Must be called synchronously before React render
 */
export function bootstrap() {
  // 1. Initialize IoC container
  registerServices();

  // 2. Initialize theme synchronously
  initializeTheme();

  // 3. Configure network detection
  configureNetInfo();

  // 4. Start Auto-Sync Orchestrator (Story 6.2 - Task 1)
  // Enables automatic sync when network becomes available
  startAutoSyncOrchestrator();
}

/**
 * Initialize theme BEFORE first render
 * Ensures NativeWind's dark: classes are set correctly from the start
 */
function initializeTheme() {
  const storedPreference = useSettingsStore.getState().themePreference;
  const systemScheme = Appearance.getColorScheme() ?? "light";
  const targetScheme =
    storedPreference === "system" ? systemScheme : storedPreference;

  // Resolve logger AFTER registerServices() has been called
  const log = container
    .resolve<ILogger>(TOKENS.ILogger)
    .createScope("Bootstrap");
  log.debug(
    "Theme init:",
    targetScheme,
    "(preference:",
    storedPreference,
    ", system:",
    systemScheme,
    ")",
  );

  nwColorScheme.set(targetScheme);
}

/**
 * Configure NetInfo for real internet reachability detection
 */
function configureNetInfo() {
  NetInfo.configure({
    reachabilityUrl: "https://clients3.google.com/generate_204",
    reachabilityTest: async (response) => response.status === 204,
    reachabilityShortTimeout: 5 * 1000, // 5s
    reachabilityLongTimeout: 60 * 1000, // 60s
    reachabilityRequestTimeout: 15 * 1000, // 15s
  });
}

/**
 * Start Auto-Sync Orchestrator (Story 6.2 - AC1)
 * Monitors network changes and triggers sync when online
 */
function startAutoSyncOrchestrator() {
  const log = container
    .resolve<ILogger>(TOKENS.ILogger)
    .createScope("Bootstrap");

  try {
    const orchestrator = container.resolve(AutoSyncOrchestrator);
    orchestrator.start();
    log.info("✅ AutoSyncOrchestrator started - network monitoring active");
  } catch (error) {
    log.error("❌ Failed to start AutoSyncOrchestrator:", error);
    // Non-blocking: app can continue without auto-sync
  }
}
