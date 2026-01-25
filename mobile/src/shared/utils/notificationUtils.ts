/**
 * Notification Utilities - User Notifications
 *
 * Provides both in-app alerts (Alert API) and local push notifications
 * (expo-notifications) for background notifications.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC4: Crash Recovery - Notify user of recovered captures
 *
 * Story: 2.5 - Transcription On-Device
 * Task 5.3: Transcription completion notification
 */

import { Alert, Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RecoveredCapture } from '../../contexts/capture/domain/ICrashRecoveryService';

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Show notification when captures are recovered after crash
 *
 * AC4: "I receive a notification about the recovered capture"
 *
 * @param recoveredCaptures - Array of recovered captures from CrashRecoveryService
 *
 * @example
 * ```typescript
 * const recovered = await crashRecoveryService.recoverIncompleteRecordings();
 * if (recovered.length > 0) {
 *   showCrashRecoveryNotification(recovered);
 * }
 * ```
 */
export function showCrashRecoveryNotification(
  recoveredCaptures: RecoveredCapture[]
): void {
  if (recoveredCaptures.length === 0) {
    return;
  }

  const successCount = recoveredCaptures.filter((c) => c.state === 'recovered')
    .length;
  const failedCount = recoveredCaptures.filter((c) => c.state === 'failed')
    .length;

  // Build notification message
  let title: string;
  let message: string;

  if (successCount > 0 && failedCount === 0) {
    // All recovered successfully
    title = 'Enregistrements récupérés';
    message =
      successCount === 1
        ? 'Votre enregistrement interrompu a été récupéré avec succès.'
        : `${successCount} enregistrements interrompus ont été récupérés avec succès.`;
  } else if (successCount === 0 && failedCount > 0) {
    // All failed
    title = 'Récupération échouée';
    message =
      failedCount === 1
        ? "Impossible de récupérer l'enregistrement interrompu (fichier audio introuvable)."
        : `Impossible de récupérer ${failedCount} enregistrements interrompus (fichiers audio introuvables).`;
  } else {
    // Mixed results
    title = 'Récupération partielle';
    message = `${successCount} enregistrement(s) récupéré(s), ${failedCount} échoué(s).`;
  }

  // Show native alert
  // Note: Alert.alert is iOS-style on iOS, Material Design on Android
  Alert.alert(title, message, [
    {
      text: 'OK',
      style: 'default',
    },
  ]);
}

/**
 * Show generic error notification
 *
 * @param title - Notification title
 * @param message - Notification message
 *
 * @example
 * ```typescript
 * showErrorNotification('Erreur', 'Permission microphone refusée');
 * ```
 */
export function showErrorNotification(title: string, message: string): void {
  Alert.alert(title, message, [
    {
      text: 'OK',
      style: 'cancel',
    },
  ]);
}

/**
 * Show generic success notification
 *
 * @param title - Notification title
 * @param message - Notification message
 */
export function showSuccessNotification(title: string, message: string): void {
  Alert.alert(title, message, [
    {
      text: 'OK',
      style: 'default',
    },
  ]);
}

// ============================================
// Transcription Notifications (Story 2.5)
// ============================================

/**
 * Request notification permissions
 *
 * Should be called early in app lifecycle (e.g., App.tsx useEffect)
 *
 * @returns true if permissions granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();

    if (existingStatus === 'granted') {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('[Notifications] Permission request failed:', error);
    return false;
  }
}

/**
 * Show transcription completion notification
 *
 * Story 2.5 - Task 5.3: Send local notification when transcription completes
 *
 * @param captureId - ID of the transcribed capture
 * @param previewText - First few words of the transcription (optional)
 */
export async function showTranscriptionCompleteNotification(
  captureId: string,
  previewText?: string
): Promise<void> {
  // Only show push notification if app is backgrounded
  const appState = AppState.currentState;

  if (appState === 'active') {
    // App is in foreground - skip notification (user can see the list update)
    console.log('[Notifications] App active, skipping transcription notification');
    return;
  }

  try {
    const title = 'Transcription terminée';
    const body = previewText
      ? `"${previewText.substring(0, 50)}${previewText.length > 50 ? '...' : ''}"`
      : 'Votre pensée est prête à être lue';

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'transcription_complete',
          captureId,
        },
        sound: true,
      },
      trigger: null, // Show immediately
    });

    console.log('[Notifications] Transcription complete notification sent for:', captureId);
  } catch (error) {
    console.error('[Notifications] Failed to send transcription notification:', error);
  }
}

/**
 * Show transcription failed notification
 *
 * @param captureId - ID of the failed capture
 * @param errorMessage - Brief error description (optional)
 */
export async function showTranscriptionFailedNotification(
  captureId: string,
  errorMessage?: string
): Promise<void> {
  // Only show push notification if app is backgrounded
  const appState = AppState.currentState;

  if (appState === 'active') {
    // App is in foreground - skip notification
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Transcription échouée',
        body: errorMessage || 'La transcription a échoué. Appuyez pour réessayer.',
        data: {
          type: 'transcription_failed',
          captureId,
        },
        sound: true,
      },
      trigger: null,
    });

    console.log('[Notifications] Transcription failed notification sent for:', captureId);
  } catch (error) {
    console.error('[Notifications] Failed to send error notification:', error);
  }
}

/**
 * Setup notification response handler
 *
 * Call this in App.tsx to handle notification taps
 *
 * @param onTranscriptionTap - Callback when transcription notification is tapped
 */
export function setupNotificationResponseHandler(
  onTranscriptionTap?: (captureId: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    if (data?.type === 'transcription_complete' || data?.type === 'transcription_failed') {
      const captureId = data.captureId as string;
      console.log('[Notifications] User tapped transcription notification:', captureId);

      if (onTranscriptionTap && captureId) {
        onTranscriptionTap(captureId);
      }
    }
  });

  // Return cleanup function
  return () => {
    subscription.remove();
  };
}
