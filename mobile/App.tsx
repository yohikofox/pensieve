import 'reflect-metadata';
import './global.css';
import './src/i18n';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Appearance } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';
import { useAuthListener } from './src/contexts/identity/hooks/useAuthListener';
import { useDeepLinkAuth } from './src/contexts/identity/hooks/useDeepLinkAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MainNavigator } from './src/navigation/MainNavigator';
import { lightNavigationTheme, darkNavigationTheme } from './src/navigation/theme';
import { ThemeProvider, useThemeContext } from './src/contexts/theme/ThemeProvider';
import { useSettingsStore } from './src/stores/settingsStore';
import { AppState, type AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingView, ToastProvider } from './src/design-system/components';
import { registerServices } from './src/infrastructure/di/container';
import { container } from 'tsyringe';
import { TOKENS } from './src/infrastructure/di/tokens';
import { type ICrashRecoveryService } from './src/contexts/capture/domain/ICrashRecoveryService';
import {
  showCrashRecoveryNotification,
  requestNotificationPermissions,
  setupNotificationResponseHandler,
} from './src/shared/utils/notificationUtils';
import NetInfo from '@react-native-community/netinfo';
import { TranscriptionQueueProcessor } from './src/contexts/Normalization/processors/TranscriptionQueueProcessor';
import { TranscriptionWorker } from './src/contexts/Normalization/workers/TranscriptionWorker';
import { registerTranscriptionBackgroundTask } from './src/contexts/Normalization/tasks/transcriptionBackgroundTask';
import { LLMModelService } from './src/contexts/Normalization/services/LLMModelService';
import { NPUDetectionService } from './src/contexts/Normalization/services/NPUDetectionService';
import { DevPanelProvider } from './src/components/dev/DevPanelContext';
import { DevPanel } from './src/components/dev/DevPanel';

// Initialize IoC container with production services
registerServices();

// Synchronously initialize theme BEFORE first render
// This ensures NativeWind's dark: classes are set correctly from the start
(() => {
  const storedPreference = useSettingsStore.getState().themePreference;
  const systemScheme = Appearance.getColorScheme() ?? 'light';
  const targetScheme = storedPreference === 'system' ? systemScheme : storedPreference;
  console.log('[App] Sync theme init:', targetScheme, '(preference:', storedPreference, ', system:', systemScheme, ')');
  nwColorScheme.set(targetScheme);
})();

// Configure NetInfo for real internet reachability detection
NetInfo.configure({
  reachabilityUrl: 'https://clients3.google.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityShortTimeout: 5 * 1000, // 5s
  reachabilityLongTimeout: 60 * 1000, // 60s
  reachabilityRequestTimeout: 15 * 1000, // 15s
});

/**
 * AppContent - Inner component wrapped by ToastProvider and ThemeProvider
 * This allows hooks like useDeepLinkAuth to access the toast context
 */
function AppContent() {
  const { user, loading } = useAuthListener();
  const { colorScheme, isDark } = useThemeContext();
  useDeepLinkAuth(); // Handle deep link authentication (requires ToastProvider)

  // Select navigation theme based on current color scheme
  const navigationTheme = isDark ? darkNavigationTheme : lightNavigationTheme;

  // AC4: Check for crash-recovered recordings on app launch
  // Story 2.1 - Crash Recovery Notification
  useEffect(() => {
    const checkCrashRecovery = async () => {
      try {
        // Resolve by token as registered in container.ts
        const crashRecoveryService = container.resolve<ICrashRecoveryService>(TOKENS.ICrashRecoveryService);
        const recovered = await crashRecoveryService.recoverIncompleteRecordings();

        // Show notification if any recordings were recovered
        if (recovered.length > 0) {
          showCrashRecoveryNotification(recovered);
        }
      } catch (error) {
        // Silent fail - don't block app startup for crash recovery issues
        console.error('[App] Crash recovery check failed:', error);
      }
    };

    checkCrashRecovery();
  }, []); // Run once on mount

  // Recover interrupted LLM model downloads after app restart
  useEffect(() => {
    const recoverDownloads = async () => {
      try {
        // Resolve service from DI container (singleton)
        const modelService = container.resolve(LLMModelService);

        // Initialize service (auth + downloader config)
        await modelService.initialize();

        // Recover interrupted downloads
        const recoveredModels = await modelService.recoverInterruptedDownloads();

        if (recoveredModels.length > 0) {
          console.log('[App] Recovered interrupted downloads:', recoveredModels);
          // TODO: Show toast notification if we want to inform user
        }
      } catch (error) {
        // Silent fail - don't block app startup
        console.error('[App] Download recovery failed:', error);
      }
    };

    recoverDownloads();
  }, []); // Run once on mount

  // Story 2.5 - Request notification permissions for transcription notifications
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const granted = await requestNotificationPermissions();
        console.log('[App] Notification permissions:', granted ? 'granted' : 'denied');
      } catch (error) {
        console.error('[App] Notification setup failed:', error);
      }
    };

    setupNotifications();

    // Setup notification response handler (when user taps notification)
    const cleanup = setupNotificationResponseHandler((captureId) => {
      console.log('[App] User tapped transcription notification for:', captureId);
      // TODO: Navigate to capture detail when implemented
    });

    return cleanup;
  }, []);

  // Story 2.5 - Initialize Transcription Services
  useEffect(() => {
    // Resolve services from DI container (singletons)
    const queueProcessor = container.resolve(TranscriptionQueueProcessor);
    const worker = container.resolve(TranscriptionWorker);
    let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

    const initializeTranscription = async () => {
      try {
        console.log('[App] Initializing transcription services...');

        // Start event listener (auto-enqueue captures)
        queueProcessor.start();
        console.log('[App] ✅ TranscriptionQueueProcessor started');

        // Start foreground worker (process queue)
        await worker.start();
        console.log('[App] ✅ TranscriptionWorker started');

        // Register background task (15-min periodic checks)
        await registerTranscriptionBackgroundTask();
        console.log('[App] ✅ Background transcription task registered');

        // Handle app lifecycle (foreground/background)
        appStateListener = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
          if (nextAppState === 'background') {
            console.log('[App] App backgrounding - pausing transcription worker');
            await worker.pause();
          } else if (nextAppState === 'active') {
            console.log('[App] App foregrounding - resuming transcription worker');
            await worker.resume();
          }
        });
      } catch (error) {
        // Silent fail - don't block app startup
        console.error('[App] Transcription services initialization failed:', error);
      }
    };

    initializeTranscription();

    // Cleanup on unmount (called correctly by useEffect)
    return () => {
      console.log('[App] Cleaning up transcription services...');
      queueProcessor.stop();
      worker.stop();
      appStateListener?.remove();
    };
  }, []); // Run once on mount

  if (loading) {
    return <LoadingView fullScreen />;
  }

  return (
    <DevPanelProvider>
      <NavigationContainer theme={navigationTheme}>
        {user ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      {/* Global DevPanel - Floating button accessible from any screen */}
      <DevPanel />
    </DevPanelProvider>
  );
}

/**
 * AppWithStatusBar - Handles StatusBar styling based on theme
 */
function AppWithStatusBar() {
  const { isDark } = useThemeContext();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppContent />
    </>
  );
}

/**
 * Main App component
 *
 * Provider hierarchy:
 * 1. SafeAreaProvider - Safe area insets
 * 2. ThemeProvider - Theme context and CSS variables
 * 3. ToastProvider - Toast notifications
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AppWithStatusBar />
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
