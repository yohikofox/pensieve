/**
 * Digestion Failed Event Listener
 * Listens to digestion.job.failed events and sends error notifications
 *
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.4: Check user preferences before sending notifications (AC7)
 *
 * AC5: Failure Notification with Retry
 * AC7: Notification Settings Respect
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PushNotificationService } from '../services/PushNotificationService';
import { UserRepository } from '../repositories/UserRepository';

interface DigestionJobFailedEvent {
  eventType: string;
  captureId: string;
  userId: string;
  errorMessage: string;
  stackTrace: string;
  retryCount: number;
  failedAt: string;
  jobPayload: any;
}

@Injectable()
export class DigestionFailedListener {
  private readonly logger = new Logger(DigestionFailedListener.name);

  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Handle digestion.job.failed event
   * AC5: Send error notification with retry action
   * AC7: Check user preferences before sending (pushNotificationsEnabled)
   *
   * @param event - Digestion job failed event
   */
  @OnEvent('digestion.job.failed')
  async handleDigestionFailed(event: DigestionJobFailedEvent): Promise<void> {
    const { captureId, userId, retryCount } = event;

    this.logger.log(
      `📬 Handling digestion.job.failed for capture ${captureId} (user: ${userId}, retries: ${retryCount})`,
    );

    try {
      // AC7: Check user notification preferences
      const userSettings =
        await this.userRepository.getUserNotificationSettings(userId);

      if (!userSettings) {
        this.logger.warn(`⚠️  User settings not found for userId: ${userId}`);
        return;
      }

      // AC7: Respect pushNotificationsEnabled setting
      if (!userSettings.pushNotificationsEnabled) {
        this.logger.debug(
          `⏭️  Push notifications disabled for user ${userId}, skipping notification`,
        );
        return;
      }

      // Check if user has push token
      if (!userSettings.pushToken) {
        this.logger.debug(
          `⏭️  No push token registered for user ${userId}, skipping push notification`,
        );
        return;
      }

      // AC5: Send error notification with retry action
      const result = await this.pushNotificationService.sendErrorNotification(
        userId,
        userSettings.pushToken,
        captureId,
        retryCount,
      );

      if (result.success) {
        this.logger.log(
          `✅ Error notification sent to user ${userId} (ticket: ${result.ticketId})`,
        );
      } else {
        this.logger.error(
          `❌ Failed to send error notification to user ${userId}: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error handling digestion.job.failed for ${captureId}:`,
        error,
      );
    }
  }
}
