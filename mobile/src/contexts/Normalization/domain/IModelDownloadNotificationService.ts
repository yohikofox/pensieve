/**
 * Interface for model download notification service
 *
 * Handles local push notifications for LLM and Whisper model downloads.
 * Supports:
 * - Completion notifications (success / failure)
 * - Update available notifications (Story 8.9)
 * - Android persistent progress notifications
 * - Navigation data in notification payloads
 *
 * Story: 8.7 - Téléchargement de Modèles en Arrière-Plan
 * Story: 8.9 - Vérification Automatique des Mises à Jour des Modèles
 * Architecture: ADR-024 (SRP), ADR-023 (void acceptable pour fire-and-forget)
 */

export type ModelDownloadScreen = 'llm' | 'whisper';

export interface IModelDownloadNotificationService {
  /**
   * Initialize notification service (Android channel setup).
   * Must be called before any other method.
   */
  initialize(): Promise<void>;

  /**
   * Request notification permissions from the user.
   * Returns false without prompting if already denied.
   */
  requestPermissions(): Promise<boolean>;

  /**
   * Send a success notification when a model download completes.
   * @param modelId   - Unique identifier of the model
   * @param modelName - Display name of the model
   * @param screen    - Target screen for notification tap navigation
   */
  notifyDownloadSuccess(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void>;

  /**
   * Send a failure notification when a model download fails.
   * @param modelId   - Unique identifier of the model
   * @param modelName - Display name of the model
   * @param screen    - Target screen for notification tap navigation
   */
  notifyDownloadError(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void>;

  /**
   * Update or show the persistent progress notification (Android only).
   * Debounced: only updates on ~10 % progress increments.
   * @param modelId   - Unique identifier of the model
   * @param modelName - Display name of the model
   * @param progress  - Value between 0 and 1
   */
  updateProgressNotification(
    modelId: string,
    modelName: string,
    progress: number,
  ): Promise<void>;

  /**
   * Dismiss the persistent progress notification (Android only).
   * Also clears internal debounce state for this model.
   * @param modelId - Unique identifier of the model
   */
  dismissProgressNotification(modelId: string): Promise<void>;

  /**
   * Send a notification when a model update is available.
   * Only sent if notification permissions are granted.
   * Not sent again if the user has already been notified (caller's responsibility).
   * @param modelId   - Unique identifier of the model
   * @param modelName - Display name of the model
   * @param screen    - Target screen for notification tap navigation
   */
  notifyUpdateAvailable(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void>;

  /**
   * Send a notification when a model update download completes.
   * Title: "Modèle mis à jour" (AC6 — Story 8.9).
   * Called from screen handleUpdate() after recordUpdate().
   * @param modelId   - Unique identifier of the model
   * @param modelName - Display name of the model
   * @param screen    - Target screen for notification tap navigation
   */
  notifyUpdateSuccess(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void>;
}
