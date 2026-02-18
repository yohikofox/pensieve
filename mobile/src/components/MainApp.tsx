/**
 * Main App Component
 *
 * Contains application initialization logic and navigation.
 * Separated from App.tsx to keep App.tsx focused on providers only.
 */

import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuthListener } from '../contexts/identity/hooks/useAuthListener';
import { useDeepLinkAuth } from '../contexts/identity/hooks/useDeepLinkAuth';
import { useAuthRecoveryStore } from '../stores/authRecoveryStore';
import { supabase } from '../lib/supabase';
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
import { useSyncStatusBridge } from '../hooks/useSyncStatusBridge';
import { useLongOfflineReminder } from '../hooks/useLongOfflineReminder';

/**
 * Check the initial deep link URL for a password recovery token.
 * Must run BEFORE the navigation renders to avoid a flash of the main app.
 * Returns true when the check is complete (regardless of result).
 */
function useInitialUrlRecoveryCheck(): boolean {
  const [checked, setChecked] = useState(false);
  const setPasswordRecovery = useAuthRecoveryStore((s) => s.setPasswordRecovery);

  useEffect(() => {
    Linking.getInitialURL().then(async (url) => {
      if (url) {
        const parsed = Linking.parse(url);
        const isResetPath =
          parsed.path === 'reset-password' || parsed.hostname === 'reset-password';

        if (isResetPath) {
          const fragment = url.split('#')[1];
          if (fragment) {
            const params = new URLSearchParams(fragment);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            const type = params.get('type');

            if (access_token && refresh_token && type === 'recovery') {
              const { error } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              if (!error) {
                setPasswordRecovery(true);
              }
            }
          }
        }
      }
      setChecked(true);
    });
  }, [setPasswordRecovery]);

  return checked;
}

/**
 * Main App Content with initialization hooks
 */
function AppContent() {
  const { user, loading } = useAuthListener();
  const isPasswordRecovery = useAuthRecoveryStore((s) => s.isPasswordRecovery);
  const initialUrlChecked = useInitialUrlRecoveryCheck();
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
  useSyncInitialization();

  // Story 6.4: Connect EventBus sync events to SyncStatusStore
  useSyncStatusBridge();

  // Story 6.4: Remind user when offline for too long
  useLongOfflineReminder();

  // Wait for both auth session AND initial URL check to complete
  if (loading || !initialUrlChecked) {
    return <LoadingView fullScreen />;
  }

  return (
    <DevPanelProvider>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        {user && !isPasswordRecovery
          ? <MainNavigator />
          : <AuthNavigator initialRouteName={isPasswordRecovery ? 'ResetPassword' : 'Login'} />
        }
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
