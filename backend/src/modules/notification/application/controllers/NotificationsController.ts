/**
 * Notifications Controller
 * Handles notification-related HTTP endpoints
 *
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.3: Create endpoint POST /api/users/push-token
 */

import { Controller, Post, Body, Patch, UseGuards, Req } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
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
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Register user's Expo push token
   * Subtask 5.3: Create endpoint POST /api/users/push-token
   *
   * @param req - Request with user from JWT
   * @param body - Push token payload
   * @returns Success message
   */
  @Post('push-token')
  async registerPushToken(
    @Req() req: any,
    @Body() body: RegisterPushTokenDto,
  ): Promise<{ message: string; validated: boolean }> {
    const userId = req.user.id;
    const { pushToken } = body;

    // Validate push token format
    const isValid = this.pushNotificationService.isValidPushToken(pushToken);
    if (!isValid) {
      throw new Error('Invalid Expo push token format');
    }

    // Update user's push token
    await this.userRepository.updatePushToken(userId, pushToken);

    return {
      message: 'Push token registered successfully',
      validated: true,
    };
  }

  /**
   * Update user's notification preferences
   * Task 6, Subtask 6.2: Create endpoint PATCH /api/users/notification-settings
   *
   * @param req - Request with user from JWT
   * @param body - Notification preferences
   * @returns Updated preferences
   */
  @Patch('notification-settings')
  async updateNotificationPreferences(
    @Req() req: any,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<{
    message: string;
    preferences: UpdateNotificationPreferencesDto;
  }> {
    const userId = req.user.id;

    // Update user's notification preferences
    await this.userRepository.updateNotificationPreferences(userId, body);

    return {
      message: 'Notification preferences updated successfully',
      preferences: body,
    };
  }
}
