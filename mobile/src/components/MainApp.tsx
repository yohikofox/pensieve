/**
 * Main App Component
 *
 * Contains application initialization logic and navigation.
 * Separated from App.tsx to keep App.tsx focused on providers only.
 */

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { useAuthListener } from '../contexts/identity/hooks/useAuthListener';
import { useDeepLinkAuth } from '../contexts/identity/hooks/useDeepLinkAuth';
import { useLLMSettingsListener } from '../hooks/useLLMSettingsListener';
import { useNavigationTheme } from '../hooks/useNavigationTheme';
import { useThemeContext } from '../contexts/theme/ThemeProvider';
import { AuthNavigator } from '../navigation/AuthNavigator';
import { MainNavigator } from '../navigation/MainNavigator';
import { LoadingView } from '../design-system/components';
import { DevPanelProvider } from './dev/DevPanelContext';
import { DevPanel } from './dev/DevPanel';
import { CalibrationGridWrapper } from './debug';

// Initialization hooks
import { useDeepLinkInitialization } from '../hooks/initialization/useDeepLinkInitialization';
import { useCrashRecovery } from '../hooks/initialization/useCrashRecovery';
import { useLLMDownloadRecovery } from '../hooks/initialization/useLLMDownloadRecovery';
import { useNotificationSetup } from '../hooks/initialization/useNotificationSetup';
import { useTranscriptionInitialization } from '../hooks/initialization/useTranscriptionInitialization';
import { useSyncInitialization } from '../hooks/initialization/useSyncInitialization';

/**
 * Main App Content with initialization hooks
 */
function AppContent() {
  const { user, loading } = useAuthListener();
  const navigationRef = useNavigationContainerRef();
  const navigationTheme = useNavigationTheme();

  // Application hooks
  useDeepLinkAuth();
  useLLMSettingsListener();

  // Initialization hooks
  useDeepLinkInitialization(navigationRef);
  useCrashRecovery();
  useLLMDownloadRecovery();
  useNotificationSetup();
  useTranscriptionInitialization();
  useSyncInitialization(); // Sets token THEN starts AutoSyncOrchestrator

  if (loading) {
    return <LoadingView fullScreen />;
  }

  return (
    <DevPanelProvider>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {user ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <DevPanel />
      <CalibrationGridWrapper />
    </DevPanelProvider>
  );
}

/**
 * MainApp with StatusBar
 */
export function MainApp() {
  const { isDark } = useThemeContext();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppContent />
    </>
  );
}
