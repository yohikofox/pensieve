/**
 * useOfflineNotifications Hook
 * Story 4.4: Notifications de Progression IA
 * Task 10, Subtask 10.4: Emit notification when network returns and processing starts
 *
 * AC8: Offline Queue Notification
 * - Send notification when network goes offline
 * - Send notification when network returns and processing starts
 * - Integrate with LocalNotificationService
 */

import React, { useEffect, useRef } from 'react';
import { useOfflineQueueStatus } from './useOfflineQueueStatus';
import { LocalNotificationService } from '../services/notifications/LocalNotificationService';

export interface UseOfflineNotificationsOptions {
  /**
   * Whether to enable notifications
   * Default: true
   */
  enabled?: boolean;

  /**
   * Number of captures currently queued
   * Used to show accurate count in notifications
   */
  queuedCaptureCount?: number;
}

/**
 * useOfflineNotifications
 *
 * Automatically sends notifications when network status changes (AC8).
 * Integrates useOfflineQueueStatus with LocalNotificationService.
 *
 * Usage:
 * ```typescript
 * useOfflineNotifications({
 *   enabled: true,
 *   queuedCaptureCount: captures.length,
 * });
 * ```
 */
export const useOfflineNotifications = (
  options: UseOfflineNotificationsOptions = {}
): void => {
  const { enabled = true, queuedCaptureCount = 0 } = options;

  const notificationService = useRef(new LocalNotificationService()).current;
  const hasShownOfflineNotification = useRef(false);

  // Subscribe to network status changes
  const { isOffline } = useOfflineQueueStatus({
    onOffline: async (captureIds) => {
      if (!enabled) return;

      try {
        // Show offline queue notification (AC8)
        const count = queuedCaptureCount > 0 ? queuedCaptureCount : captureIds.length;
        if (count > 0 && !hasShownOfflineNotification.current) {
          await notificationService.showOfflineQueueNotification(count);
          hasShownOfflineNotification.current = true;
        }
      } catch (error) {
        console.error('[useOfflineNotifications] Failed to show offline notification:', error);
      }
    },

    onOnline: async () => {
      if (!enabled) return;

      try {
        // Show network restored notification (AC8)
        // "Processing started" when network returns
        const count = queuedCaptureCount;
        if (count > 0 && hasShownOfflineNotification.current) {
          await notificationService.showNetworkRestoredNotification(count);
          hasShownOfflineNotification.current = false;
        }
      } catch (error) {
        console.error('[useOfflineNotifications] Failed to show online notification:', error);
      }
    },
  });

  // Reset notification flag when enabled changes
  useEffect(() => {
    if (!enabled) {
      hasShownOfflineNotification.current = false;
    }
  }, [enabled]);
};

/**
 * OfflineNotificationsProvider Component (optional wrapper)
 *
 * Alternative usage pattern for app-level setup
 */
export interface OfflineNotificationsProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
  queuedCaptureCount?: number;
}

export const OfflineNotificationsProvider: React.FC<
  OfflineNotificationsProviderProps
> = ({ children, enabled = true, queuedCaptureCount = 0 }) => {
  useOfflineNotifications({ enabled, queuedCaptureCount });

  return <>{children}</>;
};
