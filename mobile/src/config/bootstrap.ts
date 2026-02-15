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

  // 4-5. Auth + AutoSync moved to useSyncInitialization hook
  // (starts after React renders to avoid race condition)
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
