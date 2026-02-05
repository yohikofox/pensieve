/**
 * User Repository - Notification-specific user operations
 * Handles push token and notification preferences management
 *
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.3: Store and update user push tokens
 * Task 6, Subtask 6.2: Update notification preferences
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../shared/infrastructure/persistence/typeorm/entities/user.entity';

interface NotificationPreferences {
  pushNotificationsEnabled?: boolean;
  localNotificationsEnabled?: boolean;
  hapticFeedbackEnabled?: boolean;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Update user's Expo push token
   * Subtask 5.3: Store push token for sending notifications
   *
   * @param userId - User ID
   * @param pushToken - Expo push token
   */
  async updatePushToken(userId: string, pushToken: string): Promise<void> {
    await this.userRepository.update(userId, { pushToken });
  }

  /**
   * Update user's notification preferences
   * Subtask 6.2: Update notification settings
   *
   * @param userId - User ID
   * @param preferences - Notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: NotificationPreferences,
  ): Promise<void> {
    await this.userRepository.update(userId, preferences);
  }

  /**
   * Get user's push token and notification preferences
   * Used by notification services to check if notifications should be sent
   *
   * @param userId - User ID
   * @returns User with notification settings or null
   */
  async getUserNotificationSettings(userId: string): Promise<{
    pushToken?: string;
    pushNotificationsEnabled: boolean;
    localNotificationsEnabled: boolean;
    hapticFeedbackEnabled: boolean;
  } | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'pushToken',
        'pushNotificationsEnabled',
        'localNotificationsEnabled',
        'hapticFeedbackEnabled',
      ],
    });

    if (!user) {
      return null;
    }

    return {
      pushToken: user.pushToken ?? undefined,
      pushNotificationsEnabled: user.pushNotificationsEnabled,
      localNotificationsEnabled: user.localNotificationsEnabled,
      hapticFeedbackEnabled: user.hapticFeedbackEnabled,
    };
  }
}
