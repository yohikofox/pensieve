/**
 * Notification Utilities - User Notifications
 *
 * Simple notification helpers using React Native Alert API
 * for MVP implementation (no external dependencies)
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC4: Crash Recovery - Notify user of recovered captures
 *
 * Note: Uses native Alert for MVP. Can be replaced with
 * Toast library (react-native-toast-message) in future iterations.
 */

import { Alert, Platform } from 'react-native';
import type { RecoveredCapture } from '../../contexts/capture/domain/ICrashRecoveryService';

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
