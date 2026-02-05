/**
 * Local Notification Service
 * Handles local notifications using expo-notifications
 *
 * Story 4.4: Notifications de Progression IA
 * Task 4: Local Notification Service (AC1, AC2, AC3, AC5, AC9 - Mobile)
 *
 * Covers:
 * - Subtask 4.1: Create LocalNotificationService (expo-notifications)
 * - Subtask 4.2: Implement showQueuedNotification (AC1)
 * - Subtask 4.3: Implement showProcessingNotification (AC2)
 * - Subtask 4.4: Implement showCompletionNotification with insights preview (AC3)
 * - Subtask 4.5: Implement showErrorNotification with retry action (AC5)
 * - Subtask 4.6: Implement showTimeoutWarningNotification with options (AC9)
 * - Subtask 4.7: Schedule periodic "Still processing..." if exceeds 10s (AC2)
 * - Subtask 4.8: Add notification action handlers (retry, cancel, view details)
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  captureId: string;
  type: string;
  action?: string;
  deepLink?: string;
}

export class LocalNotificationService {
  private stillProcessingIntervals = new Map<string, NodeJS.Timeout>();

  /**
   * Request notification permissions
   * Must be called before sending any notifications
   */
  async requestPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  /**
   * Show queued notification
   * AC1: Queue Status Notification
   *
   * @param captureId - Capture ID
   * @param queuePosition - Position in queue (optional)
   */
  async showQueuedNotification(
    captureId: string,
    queuePosition?: number,
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Processing your thought...',
          body: queuePosition
            ? `Position in queue: ${queuePosition}`
            : 'Starting soon',
          data: {
            captureId,
            type: 'queued',
          } as NotificationData,
          sound: true,
        },
        trigger: null, // Immediate
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show queued notification:', error);
      return null;
    }
  }

  /**
   * Show processing notification
   * AC2: Active Processing Indicator
   *
   * @param captureId - Capture ID
   * @param elapsed - Elapsed time in milliseconds
   */
  async showProcessingNotification(
    captureId: string,
    elapsed: number,
  ): Promise<string | null> {
    // Only show "Still processing..." if elapsed > 10s
    if (elapsed < 10000) {
      return null;
    }

    try {
      const elapsedSeconds = Math.round(elapsed / 1000);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Still processing...',
          body: `Taking longer than usual (${elapsedSeconds}s)`,
          data: {
            captureId,
            type: 'still_processing',
          } as NotificationData,
          sound: false, // No sound for progress updates
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show processing notification:', error);
      return null;
    }
  }

  /**
   * Start periodic "Still processing..." notifications
   * Subtask 4.7: Schedule periodic "Still processing..." if exceeds 10s (AC2)
   *
   * @param captureId - Capture ID
   * @param startedAt - Timestamp when processing started
   */
  startPeriodicProcessingNotifications(captureId: string, startedAt: number): void {
    // Clear any existing interval for this capture
    this.stopPeriodicProcessingNotifications(captureId);

    // Schedule notification every 10 seconds after initial 10s
    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      await this.showProcessingNotification(captureId, elapsed);
    }, 10000);

    this.stillProcessingIntervals.set(captureId, interval);
  }

  /**
   * Stop periodic "Still processing..." notifications
   *
   * @param captureId - Capture ID
   */
  stopPeriodicProcessingNotifications(captureId: string): void {
    const interval = this.stillProcessingIntervals.get(captureId);
    if (interval) {
      clearInterval(interval);
      this.stillProcessingIntervals.delete(captureId);
    }
  }

  /**
   * Show completion notification with insights preview
   * AC3: Completion Notification with Preview
   *
   * @param captureId - Capture ID
   * @param summary - Thought summary (truncated preview)
   * @param ideasCount - Number of ideas extracted
   * @param todosCount - Number of todos extracted
   */
  async showCompletionNotification(
    captureId: string,
    summary: string,
    ideasCount: number,
    todosCount: number,
  ): Promise<string | null> {
    try {
      // Truncate summary for notification preview (NFR12: no sensitive content)
      const summaryPreview = summary.substring(0, 50) + (summary.length > 50 ? '...' : '');

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '✨ New insights from your thought!',
          body: `${ideasCount} ideas, ${todosCount} actions. "${summaryPreview}"`,
          data: {
            captureId,
            type: 'completed',
            deepLink: `pensieve://capture/${captureId}`,
          } as NotificationData,
          sound: true,
        },
        trigger: null,
      });

      // Stop periodic notifications for this capture
      this.stopPeriodicProcessingNotifications(captureId);

      return notificationId;
    } catch (error) {
      console.error('Failed to show completion notification:', error);
      return null;
    }
  }

  /**
   * Show error notification with retry action
   * AC5: Failure Notification with Retry
   *
   * @param captureId - Capture ID
   * @param retryCount - Number of retries attempted
   */
  async showErrorNotification(
    captureId: string,
    retryCount: number,
  ): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '❌ Unable to process thought',
          body: 'Tap to retry',
          data: {
            captureId,
            type: 'failed',
            action: 'retry',
          } as NotificationData,
          sound: true,
        },
        trigger: null,
      });

      // Stop periodic notifications for this capture
      this.stopPeriodicProcessingNotifications(captureId);

      return notificationId;
    } catch (error) {
      console.error('Failed to show error notification:', error);
      return null;
    }
  }

  /**
   * Show timeout warning notification with options
   * AC9: Timeout Warning Notification
   *
   * @param captureId - Capture ID
   * @param elapsed - Elapsed time in milliseconds
   */
  async showTimeoutWarningNotification(
    captureId: string,
    elapsed: number,
  ): Promise<string | null> {
    try {
      const elapsedSeconds = Math.round(elapsed / 1000);

      // On iOS, we can use notification categories for action buttons
      // On Android, actions need to be handled differently
      const categoryIdentifier = Platform.OS === 'ios' ? 'timeout_warning' : undefined;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ This is taking longer than usual...',
          body: `Processing for ${elapsedSeconds}s. Keep waiting?`,
          data: {
            captureId,
            type: 'timeout_warning',
          } as NotificationData,
          sound: true,
          categoryIdentifier,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show timeout warning notification:', error);
      return null;
    }
  }

  /**
   * Show offline queue notification
   * AC8: Offline Queue Notification
   *
   * @param queuedCount - Number of captures queued for when online
   */
  async showOfflineQueueNotification(queuedCount: number): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Queued for when online',
          body: `${queuedCount} thought${queuedCount > 1 ? 's' : ''} will process when connected`,
          data: {
            captureId: '', // Not specific to one capture
            type: 'offline_queue',
          } as NotificationData,
          sound: false,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show offline queue notification:', error);
      return null;
    }
  }

  /**
   * Show network restored notification
   * AC8: Network Restored - Processing Started
   *
   * @param queuedCount - Number of captures starting to process
   */
  async showNetworkRestoredNotification(queuedCount: number): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌐 Back online!',
          body: `Processing ${queuedCount} queued thought${queuedCount > 1 ? 's' : ''}...`,
          data: {
            captureId: '',
            type: 'network_restored',
          } as NotificationData,
          sound: true,
        },
        trigger: null,
      });

      return notificationId;
    } catch (error) {
      console.error('Failed to show network restored notification:', error);
      return null;
    }
  }

  /**
   * Cancel all notifications for a specific capture
   *
   * @param captureId - Capture ID
   */
  async cancelNotificationsForCapture(captureId: string): Promise<void> {
    try {
      // Stop periodic notifications
      this.stopPeriodicProcessingNotifications(captureId);

      // Get all scheduled notifications
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

      // Cancel notifications for this capture
      for (const notification of scheduledNotifications) {
        const data = notification.content.data as NotificationData;
        if (data?.captureId === captureId) {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
      }
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      // Stop all periodic intervals
      this.stillProcessingIntervals.forEach((interval) => clearInterval(interval));
      this.stillProcessingIntervals.clear();

      // Cancel all scheduled notifications
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  /**
   * Setup notification categories (iOS only)
   * Subtask 4.8: Add notification action handlers
   */
  async setupNotificationCategories(): Promise<void> {
    if (Platform.OS !== 'ios') {
      return;
    }

    try {
      await Notifications.setNotificationCategoryAsync('timeout_warning', [
        {
          identifier: 'keep_waiting',
          buttonTitle: 'Keep Waiting',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'cancel',
          buttonTitle: 'Cancel',
          options: {
            opensAppToForeground: false,
            isDestructive: true,
          },
        },
      ]);
    } catch (error) {
      console.error('Failed to setup notification categories:', error);
    }
  }

  /**
   * Add notification response listener
   * Subtask 4.8: Handle notification actions (retry, cancel, view details)
   *
   * @param handler - Callback function to handle notification responses
   * @returns Subscription object
   */
  addNotificationResponseListener(
    handler: (response: Notifications.NotificationResponse) => void,
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }

  /**
   * Add notification received listener (foreground)
   *
   * @param handler - Callback function to handle received notifications
   * @returns Subscription object
   */
  addNotificationReceivedListener(
    handler: (notification: Notifications.Notification) => void,
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(handler);
  }
}

// Export singleton instance
export const localNotificationService = new LocalNotificationService();
