/**
 * Notification Repository Interface
 * Domain interface for Notification persistence
 *
 * Story 4.4: Notifications de Progression IA
 * Task 1, Subtask 1.4: Create NotificationRepository interface
 *
 * Following DDD patterns established in Knowledge Context
 */

import { Notification } from '../entities/Notification.entity';

export interface INotificationRepository {
  /**
   * Create a new notification
   * @param notification - Notification to create
   * @returns Created notification with ID
   */
  create(notification: Notification): Promise<Notification>;

  /**
   * Find notification by ID
   * @param id - Notification ID
   * @returns Notification or null if not found
   */
  findById(id: string): Promise<Notification | null>;

  /**
   * Find all notifications for a user
   * @param userId - User ID
   * @param limit - Optional limit (default: 50)
   * @returns Array of notifications
   */
  findByUserId(userId: string, limit?: number): Promise<Notification[]>;

  /**
   * Find notifications by related entity
   * @param relatedEntityId - Related entity ID (e.g., captureId)
   * @param relatedEntityType - Related entity type (e.g., 'capture')
   * @returns Array of notifications
   */
  findByRelatedEntity(
    relatedEntityId: string,
    relatedEntityType: string,
  ): Promise<Notification[]>;

  /**
   * Update notification delivery status
   * @param id - Notification ID
   * @param status - New delivery status
   * @param timestamp - Optional timestamp (sentAt or deliveredAt)
   */
  updateDeliveryStatus(
    id: string,
    status: 'scheduled' | 'sent' | 'delivered' | 'failed',
    timestamp?: Date,
  ): Promise<void>;

  /**
   * Delete old notifications (retention policy)
   * @param olderThanDays - Delete notifications older than X days
   * @returns Number of deleted notifications
   */
  deleteOldNotifications(olderThanDays: number): Promise<number>;

  /**
   * Count unread notifications for user
   * @param userId - User ID
   * @returns Count of unread notifications
   */
  countUnreadByUserId(userId: string): Promise<number>;
}
