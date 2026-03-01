/**
 * ModelDownloadNotificationService — expo-notifications implementation
 *
 * Provides local push notifications for model downloads (LLM + Whisper).
 * Implements AC3 (success), AC4 (error), AC5 (Android progress), AC6 (permissions).
 *
 * Story: 8.7 - Téléchargement de Modèles en Arrière-Plan
 * Architecture: ADR-021 (Singleton — tracks debounce state per active download),
 *               ADR-024 (SRP — notifications only)
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type {
  IModelDownloadNotificationService,
  ModelDownloadScreen,
} from '../domain/IModelDownloadNotificationService';

@injectable()
export class ModelDownloadNotificationService implements IModelDownloadNotificationService {
  /** Track the last 10 %-step sent per model for debouncing */
  private readonly lastProgressStep = new Map<string, number>();

  async initialize(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('model-downloads', {
        name: 'Téléchargements de modèles',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      });
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus === 'granted') return true;
      // Don't prompt again if user previously denied
      if (existingStatus === 'denied') return false;
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  async notifyDownloadSuccess(
    _modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Modèle téléchargé',
          body: `${modelName} est prêt à l'emploi`,
          data: { type: 'model_download_success', screen },
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[ModelDownloadNotificationService] Failed to send success notification:', error);
    }
  }

  async notifyDownloadError(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Échec du téléchargement',
          body: `${modelName} — Appuyer pour réessayer`,
          data: { type: 'model_download_error', screen, retry: modelId },
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[ModelDownloadNotificationService] Failed to send error notification:', error);
    }
  }

  async updateProgressNotification(
    modelId: string,
    modelName: string,
    progress: number,
  ): Promise<void> {
    // Android only: iOS handles background downloads via NSURLSession natively
    if (Platform.OS !== 'android') return;

    // Debounce: only update every 10 % step
    const step = Math.floor(progress * 10);
    const lastStep = this.lastProgressStep.get(modelId) ?? -1;
    if (step <= lastStep) return;

    this.lastProgressStep.set(modelId, step);
    const percent = step * 10;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `model-download-progress-${modelId}`,
        content: {
          title: 'Téléchargement en cours...',
          body: `${modelName} — ${percent}%`,
          data: { type: 'model_download_progress', modelId },
        },
        trigger: null,
      });
    } catch (error) {
      console.error(
        '[ModelDownloadNotificationService] Failed to update progress notification:',
        error,
      );
    }
  }

  async dismissProgressNotification(modelId: string): Promise<void> {
    this.lastProgressStep.delete(modelId);

    if (Platform.OS !== 'android') return;

    try {
      await Notifications.dismissNotificationAsync(`model-download-progress-${modelId}`);
    } catch (error) {
      console.error(
        '[ModelDownloadNotificationService] Failed to dismiss progress notification:',
        error,
      );
    }
  }

  async notifyUpdateAvailable(
    modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Mise à jour disponible',
          body: `${modelName} — Appuyer pour mettre à jour`,
          data: { type: 'model_update_available', screen, action: 'update', modelId },
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[ModelDownloadNotificationService] Failed to send update notification:', error);
    }
  }

  async notifyUpdateSuccess(
    _modelId: string,
    modelName: string,
    screen: ModelDownloadScreen,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Modèle mis à jour',
          body: `${modelName} est prêt à l'emploi`,
          data: { type: 'model_update_success', screen },
          sound: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[ModelDownloadNotificationService] Failed to send update success notification:', error);
    }
  }
}
