import 'reflect-metadata';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthListener } from './src/contexts/identity/hooks/useAuthListener';
import { useDeepLinkAuth } from './src/contexts/identity/hooks/useDeepLinkAuth';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { MainNavigator } from './src/navigation/MainNavigator';
import { ActivityIndicator, View } from 'react-native';
import { registerServices } from './src/infrastructure/di/container';
import { container } from 'tsyringe';
import { TOKENS } from './src/infrastructure/di/tokens';
import { type ICrashRecoveryService } from './src/contexts/capture/domain/ICrashRecoveryService';
import { showCrashRecoveryNotification } from './src/shared/utils/notificationUtils';
import NetInfo from '@react-native-community/netinfo';
import { InAppLogger } from './src/components/dev/InAppLogger';

// Initialize IoC container with production services
registerServices();

// Configure NetInfo for real internet reachability detection
NetInfo.configure({
  reachabilityUrl: 'https://clients3.google.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityShortTimeout: 5 * 1000, // 5s
  reachabilityLongTimeout: 60 * 1000, // 60s
  reachabilityRequestTimeout: 15 * 1000, // 15s
});

export default function App() {
  const { user, loading } = useAuthListener();
  useDeepLinkAuth(); // Handle deep link authentication

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        {user ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
      <InAppLogger />
    </>
  );
}
