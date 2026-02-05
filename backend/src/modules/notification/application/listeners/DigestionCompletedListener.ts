/**
 * Digestion Completed Event Listener
 * Listens to digestion.completed events and sends push notifications
 *
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.4: Check user preferences before sending notifications (AC7)
 *
 * AC3: Completion Notification with Preview
 * AC7: Notification Settings Respect
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PushNotificationService } from '../services/PushNotificationService';
import { UserRepository } from '../repositories/UserRepository';

interface DigestionCompletedEvent {
  thoughtId: string;
  captureId: string;
  userId: string;
  summary: string;
  ideasCount: number;
  todosCount: number;
  processingTimeMs: number;
  completedAt: Date;
}

@Injectable()
export class DigestionCompletedListener {
  private readonly logger = new Logger(DigestionCompletedListener.name);

  constructor(
    private readonly pushNotificationService: PushNotificationService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Handle digestion.completed event
   * AC3: Send completion notification with insights preview
   * AC7: Check user preferences before sending (pushNotificationsEnabled)
   *
   * @param event - Digestion completed event
   */
  @OnEvent('digestion.completed')
  async handleDigestionCompleted(event: DigestionCompletedEvent): Promise<void> {
    const { captureId, userId, summary, ideasCount, todosCount } = event;

    this.logger.log(
      `📬 Handling digestion.completed for capture ${captureId} (user: ${userId})`,
    );

    try {
      // AC7: Check user notification preferences
      const userSettings = await this.userRepository.getUserNotificationSettings(userId);

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
        this.logger.debug(`⏭️  No push token registered for user ${userId}, skipping push notification`);
        return;
      }

      // AC3: Send push notification with insights preview
      const result = await this.pushNotificationService.sendDigestionCompleteNotification(
        userId,
        userSettings.pushToken,
        captureId,
        summary,
        ideasCount,
        todosCount,
      );

      if (result.success) {
        this.logger.log(
          `✅ Push notification sent to user ${userId} (ticket: ${result.ticketId})`,
        );
      } else {
        this.logger.error(
          `❌ Failed to send push notification to user ${userId}: ${result.error}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error handling digestion.completed for ${captureId}:`,
        error,
      );
    }
  }
}
