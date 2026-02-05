/**
 * Push Notification Service
 * Handles push notifications using Expo Push Notification Service
 *
 * Story 4.4: Notifications de Progression IA
 * Task 5: Push Notification Backend Service (AC3 - Backend)
 *
 * Covers:
 * - Subtask 5.1: Create PushNotificationService (expo-server-sdk)
 * - Subtask 5.4: Implement sendDigestionCompleteNotification (AC3)
 * - Subtask 5.5: Add notification batching if multiple completions
 * - Subtask 5.6: Handle Expo push errors (invalid tokens, rate limits)
 *
 * ADR-013: Hybrid Notification Strategy (Local + Push)
 * - Push notifications only when app in background
 * - Free tier: 1M notifications/month (sufficient for MVP)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';

export interface PushNotificationResult {
  success: boolean;
  ticketId?: string;
  error?: string;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private expo: Expo;

  constructor() {
    this.expo = new Expo({
      // Optional: You can provide access token for increased rate limits
      // accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
  }

  /**
   * Validate Expo push token
   * Subtask 5.6: Handle Expo push errors (invalid tokens)
   *
   * @param pushToken - Expo push token to validate
   * @returns Whether token is valid
   */
  isValidPushToken(pushToken: string): boolean {
    return Expo.isExpoPushToken(pushToken);
  }

  /**
   * Send digestion complete push notification
   * Subtask 5.4: Implement sendDigestionCompleteNotification (AC3)
   *
   * @param userId - User ID
   * @param pushToken - User's Expo push token
   * @param captureId - Capture ID
   * @param summary - Thought summary (truncated preview)
   * @param ideasCount - Number of ideas extracted
   * @param todosCount - Number of todos extracted
   * @returns Push notification result
   */
  async sendDigestionCompleteNotification(
    userId: string,
    pushToken: string,
    captureId: string,
    summary: string,
    ideasCount: number,
    todosCount: number,
  ): Promise<PushNotificationResult> {
    try {
      // Validate push token
      if (!this.isValidPushToken(pushToken)) {
        this.logger.warn(`Invalid Expo push token for user ${userId}: ${pushToken}`);
        return {
          success: false,
          error: 'Invalid Expo push token',
        };
      }

      // Truncate summary for notification (NFR12: no sensitive content)
      const summaryPreview = summary.substring(0, 50) + (summary.length > 50 ? '...' : '');

      // Create push message
      const message: ExpoPushMessage = {
        to: pushToken,
        sound: 'default',
        title: '✨ New insights from your thought!',
        body: `${ideasCount} ideas, ${todosCount} actions. "${summaryPreview}"`,
        data: {
          captureId,
          type: 'completed',
          deepLink: `pensieve://capture/${captureId}`,
        },
        priority: 'high',
        channelId: 'digestion-completed', // Android notification channel
      };

      // Send push notification
      const tickets = await this.sendPushNotifications([message]);

      if (tickets.length === 0) {
        return {
          success: false,
          error: 'No tickets returned from Expo',
        };
      }

      const ticket = tickets[0];

      if (ticket.status === 'error') {
        this.logger.error(
          `Failed to send push notification to user ${userId}: ${ticket.message}`,
        );
        return {
          success: false,
          error: ticket.message,
        };
      }

      this.logger.log(
        `✅ Push notification sent to user ${userId} (capture: ${captureId}), ticket: ${ticket.id}`,
      );

      return {
        success: true,
        ticketId: ticket.id,
      };
    } catch (error) {
      this.logger.error(`Error sending push notification to user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send batch of push notifications
   * Subtask 5.5: Add notification batching if multiple completions
   *
   * Expo allows up to 100 notifications per batch for optimal performance
   *
   * @param messages - Array of Expo push messages
   * @returns Array of push tickets
   */
  async sendPushNotifications(
    messages: ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    try {
      // Chunk messages into batches of 100 (Expo recommendation)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          this.logger.debug(`Sent batch of ${chunk.length} push notifications`);
        } catch (error) {
          this.logger.error('Failed to send push notification batch:', error);
          // Continue with next batch even if one fails
        }
      }

      return tickets;
    } catch (error) {
      this.logger.error('Error in sendPushNotifications:', error);
      return [];
    }
  }

  /**
   * Check push notification receipts
   * Subtask 5.6: Handle Expo push errors (rate limits, delivery confirmation)
   *
   * Call this asynchronously after sending notifications to verify delivery
   *
   * @param ticketIds - Array of push ticket IDs
   * @returns Map of ticket ID to receipt
   */
  async checkPushNotificationReceipts(
    ticketIds: string[],
  ): Promise<Map<string, ExpoPushReceipt>> {
    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
      const receipts = new Map<string, ExpoPushReceipt>();

      for (const chunk of receiptIdChunks) {
        try {
          const receiptChunk = await this.expo.getPushNotificationReceiptsAsync(chunk);

          for (const [receiptId, receipt] of Object.entries(receiptChunk)) {
            receipts.set(receiptId, receipt);

            if (receipt.status === 'error') {
              this.logger.error(
                `Push notification receipt error for ${receiptId}: ${receipt.message}`,
              );

              // Handle specific error cases
              if (receipt.details?.error === 'DeviceNotRegistered') {
                this.logger.warn(`Device not registered, should remove push token: ${receiptId}`);
                // TODO: In production, trigger event to remove invalid push token from user
              }
            } else if (receipt.status === 'ok') {
              this.logger.debug(`Push notification delivered successfully: ${receiptId}`);
            }
          }
        } catch (error) {
          this.logger.error('Failed to fetch push notification receipts:', error);
        }
      }

      return receipts;
    } catch (error) {
      this.logger.error('Error in checkPushNotificationReceipts:', error);
      return new Map();
    }
  }

  /**
   * Send error notification with retry action
   * AC5: Failure Notification with Retry
   *
   * @param userId - User ID
   * @param pushToken - User's Expo push token
   * @param captureId - Capture ID
   * @param retryCount - Number of retries attempted
   * @returns Push notification result
   */
  async sendErrorNotification(
    userId: string,
    pushToken: string,
    captureId: string,
    retryCount: number,
  ): Promise<PushNotificationResult> {
    try {
      if (!this.isValidPushToken(pushToken)) {
        return {
          success: false,
          error: 'Invalid Expo push token',
        };
      }

      const message: ExpoPushMessage = {
        to: pushToken,
        sound: 'default',
        title: '❌ Unable to process thought',
        body: 'Tap to retry',
        data: {
          captureId,
          type: 'failed',
          action: 'retry',
        },
        priority: 'high',
        channelId: 'digestion-failed',
      };

      const tickets = await this.sendPushNotifications([message]);

      if (tickets.length === 0 || tickets[0].status === 'error') {
        const errorMessage =
          tickets[0]?.status === 'error' ? tickets[0].message : 'Failed to send';
        return {
          success: false,
          error: errorMessage,
        };
      }

      return {
        success: true,
        ticketId: tickets[0].id,
      };
    } catch (error) {
      this.logger.error(`Error sending error notification to user ${userId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
