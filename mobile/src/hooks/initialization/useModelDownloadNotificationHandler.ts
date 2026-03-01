/**
 * useModelDownloadNotificationHandler
 *
 * Handles notification taps for model download events (success, error, update available).
 * On tap, navigates to the relevant settings screen (LLMSettings or WhisperSettings)
 * so the user can monitor the result, retry, or apply an update.
 *
 * Story: 8.7 - Téléchargement de Modèles en Arrière-Plan
 * Story: 8.9 - Vérification Automatique des Mises à Jour des Modèles
 * AC7: Tapping a notification navigates to the correct settings screen
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

// Lazy reference — navigationRef.current is null until NavigationContainer mounts
type NavigationRef = NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>;

/**
 * Register a notification response listener that navigates to the appropriate
 * settings screen when a model download notification is tapped.
 *
 * @param navigationRef - Navigation container ref from useNavigationContainerRef()
 */
export function useModelDownloadNotificationHandler(navigationRef: NavigationRef) {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;

      const isModelDownloadNotification =
        data?.type === 'model_download_success' ||
        data?.type === 'model_download_error' ||
        data?.type === 'model_update_available';

      if (!isModelDownloadNotification) return;

      const screen = data.screen as 'llm' | 'whisper' | undefined;

      if (!screen) return;

      const targetScreen = screen === 'llm' ? 'LLMSettings' : 'WhisperSettings';

      console.log(
        '[ModelDownloadNotification] User tapped notification, navigating to:',
        targetScreen
      );

      // Navigate to Settings tab → target screen
      // @ts-expect-error — nested navigator params are not fully typed on RootParamList
      navigationRef.current?.navigate('Settings', { screen: targetScreen });
    });

    return () => {
      subscription.remove();
    };
  }, [navigationRef]);
}
