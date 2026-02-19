/**
 * Notifications Controller
 * Handles notification-related HTTP endpoints
 *
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.3: Create endpoint POST /api/users/push-token
 */

import { Controller, Post, Body, Patch, UseGuards } from '@nestjs/common';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { CurrentUser } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import type { User } from '../../../authorization/infrastructure/decorators/current-user.decorator';
import { UserRepository } from '../repositories/UserRepository';
import { PushNotificationService } from '../services/PushNotificationService';

interface RegisterPushTokenDto {
  pushToken: string;
}

interface UpdateNotificationPreferencesDto {
  pushNotificationsEnabled?: boolean;
  localNotificationsEnabled?: boolean;
  hapticFeedbackEnabled?: boolean;
}

@Controller('users')
@UseGuards(BetterAuthGuard)
export class NotificationsController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Register user's Expo push token
   * Subtask 5.3: Create endpoint POST /api/users/push-token
   */
  @Post('push-token')
  async registerPushToken(
    @CurrentUser() user: User,
    @Body() body: RegisterPushTokenDto,
  ): Promise<{ message: string; validated: boolean }> {
    const { pushToken } = body;

    // Validate push token format
    const isValid = this.pushNotificationService.isValidPushToken(pushToken);
    if (!isValid) {
      throw new Error('Invalid Expo push token format');
    }

    // Update user's push token
    await this.userRepository.updatePushToken(user.id, pushToken);

    return {
      message: 'Push token registered successfully',
      validated: true,
    };
  }

  /**
   * Update user's notification preferences
   * Task 6, Subtask 6.2: Create endpoint PATCH /api/users/notification-settings
   */
  @Patch('notification-settings')
  async updateNotificationPreferences(
    @CurrentUser() user: User,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<{
    message: string;
    preferences: UpdateNotificationPreferencesDto;
  }> {
    await this.userRepository.updateNotificationPreferences(user.id, body);

    return {
      message: 'Notification preferences updated successfully',
      preferences: body,
    };
  }
}
