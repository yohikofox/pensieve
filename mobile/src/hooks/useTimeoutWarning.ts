/**
 * useTimeoutWarning Hook
 * Story 4.4: Notifications de Progression IA
 * Task 11, Subtasks 11.3-11.6: Timeout Handling & Warning
 *
 * AC9: Timeout Warning Notification
 * - Show timeout warning notification with "Keep waiting" / "Cancel" options
 * - Handle "Keep waiting" action (Subtask 11.4)
 * - Handle "Cancel" action (Subtask 11.5)
 * - Log slow processing metrics for monitoring (Subtask 11.6)
 */

import { useEffect, useRef } from 'react';
import { LocalNotificationService } from '../services/notifications/LocalNotificationService';
import * as Notifications from 'expo-notifications';

export interface UseTimeoutWarningOptions {
  /**
   * WebSocket connection instance
   */
  webSocket: any;

  /**
   * Whether timeout warning is enabled
   * Default: true
   */
  enabled?: boolean;

  /**
   * Callback when user presses "Keep Waiting"
   * If not provided, default behavior is to log and continue
   */
  onKeepWaiting?: (captureId: string) => void;

  /**
   * Callback when user presses "Cancel"
   * If not provided, emits cancel-job event to WebSocket
   */
  onCancel?: (captureId: string) => void;

  /**
   * Callback when user taps notification (no action button)
   * If not provided, does nothing
   */
  onTap?: (captureId: string) => void;
}

interface TimeoutWarningEvent {
  captureId: string;
  elapsed: number;
  threshold: number;
  timestamp: string;
}

/**
 * useTimeoutWarning
 *
 * Listens to WebSocket timeout warning events and shows notifications
 * with "Keep Waiting" and "Cancel" action buttons (AC9).
 *
 * Subtask 11.4: Handle "Keep Waiting" action (extend timeout, continue processing)
 * Subtask 11.5: Handle "Cancel" action (abort job, mark as failed)
 * Subtask 11.6: Log slow processing metrics for monitoring (ADR-015)
 *
 * Usage:
 * ```typescript
 * useTimeoutWarning({
 *   webSocket: socket,
 *   enabled: true,
 *   onKeepWaiting: (captureId) => console.log('Keep waiting:', captureId),
 *   onCancel: (captureId) => cancelJob(captureId),
 * });
 * ```
 */
export const useTimeoutWarning = (options: UseTimeoutWarningOptions): void => {
  const { webSocket, enabled = true, onKeepWaiting, onCancel, onTap } = options;

  const notificationService = useRef(new LocalNotificationService()).current;

  // Track which captures have shown timeout warnings
  const shownTimeoutWarnings = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !webSocket) {
      return;
    }

    // Setup notification categories for iOS action buttons
    const setupCategories = async () => {
      try {
        await notificationService.setupNotificationCategories();
      } catch (error) {
        console.error('[useTimeoutWarning] Failed to setup categories:', error);
      }
    };

    setupCategories();

    // Listen to WebSocket timeout warning events
    const handleTimeoutWarning = async (event: TimeoutWarningEvent) => {
      try {
        // Log metrics for monitoring (Subtask 11.6)
        console.warn('[useTimeoutWarning] Timeout warning:', {
          captureId: event.captureId,
          elapsed: event.elapsed,
          threshold: event.threshold,
          timestamp: event.timestamp,
        });

        // Only show one notification per captureId
        if (shownTimeoutWarnings.current.has(event.captureId)) {
          return;
        }

        // Show timeout warning notification (Subtask 11.3)
        await notificationService.showTimeoutWarningNotification(
          event.captureId,
          event.elapsed
        );

        shownTimeoutWarnings.current.add(event.captureId);
      } catch (error) {
        console.error('[useTimeoutWarning] Failed to show notification:', error);
      }
    };

    webSocket.on('progress.timeout-warning', handleTimeoutWarning);

    // Handle notification responses (action buttons)
    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse
    ) => {
      const { notification, actionIdentifier } = response;
      const data = notification.request.content.data as any;

      // Only handle timeout_warning notifications
      if (data?.type !== 'timeout_warning') {
        return;
      }

      const captureId = data.captureId;

      // Remove from shown set to allow new notification after user action
      shownTimeoutWarnings.current.delete(captureId);

      // Handle "Keep Waiting" action (Subtask 11.4)
      if (actionIdentifier === 'keep_waiting') {
        console.log('[useTimeoutWarning] Keep waiting:', captureId);

        if (onKeepWaiting) {
          onKeepWaiting(captureId);
        }
        // Default: do nothing, just acknowledge and continue processing
        return;
      }

      // Handle "Cancel" action (Subtask 11.5)
      if (actionIdentifier === 'cancel') {
        console.log('[useTimeoutWarning] Cancel job:', captureId);

        if (onCancel) {
          onCancel(captureId);
        } else {
          // Default: emit cancel-job event to WebSocket
          webSocket.emit('digestion:cancel-job', { captureId });
        }
        return;
      }

      // Handle default tap (no action button)
      if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        if (onTap) {
          onTap(captureId);
        }
        return;
      }
    };

    const subscription =
      notificationService.addNotificationResponseListener(handleNotificationResponse);

    // Cleanup
    return () => {
      webSocket.off('progress.timeout-warning', handleTimeoutWarning);
      subscription?.remove();
    };
  }, [webSocket, enabled, onKeepWaiting, onCancel, onTap, notificationService]);
};
