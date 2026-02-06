import { useEffect } from 'react';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ILogger } from '../../infrastructure/logging/ILogger';
import {
  requestNotificationPermissions,
  setupNotificationResponseHandler,
} from '../../shared/utils/notificationUtils';
import { deepLinkService } from '../../services/deep-linking/DeepLinkService';

// Lazy logger resolution - only resolve when hook is called, not at module load time
const getLogger = () => container.resolve<ILogger>(TOKENS.ILogger).createScope('NotificationSetup');

/**
 * Notification Setup
 *
 * Requests notification permissions and sets up handlers for
 * when user taps on notifications.
 *
 * Story: 2.5 - Transcription notifications
 */
export function useNotificationSetup() {
  useEffect(() => {
    const log = getLogger();
    setupNotifications(log);

    const cleanup = setupNotificationResponseHandler((captureId) => {
      log.debug("User tapped transcription notification for:", captureId);
      deepLinkService.navigateToCapture(captureId);
    });

    return cleanup;
  }, []);
}

async function setupNotifications(log: ReturnType<typeof getLogger>) {
  try {
    const granted = await requestNotificationPermissions();
    log.debug("Notification permissions:", granted ? "granted" : "denied");
  } catch (error) {
    log.error("Notification setup failed:", error);
  }
}
