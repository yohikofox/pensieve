/**
 * Notifications Controller Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 5, Subtask 5.3 & Task 6, Subtask 6.2
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './NotificationsController';
import { UserRepository } from '../repositories/UserRepository';
import { PushNotificationService } from '../services/PushNotificationService';
import { BetterAuthGuard } from '../../../../auth/guards/better-auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPushNotificationService: jest.Mocked<PushNotificationService>;

  beforeEach(async () => {
    mockUserRepository = {
      updatePushToken: jest.fn().mockResolvedValue(undefined),
      updateNotificationPreferences: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockPushNotificationService = {
      isValidPushToken: jest.fn().mockReturnValue(true),
    } as any;

    // Mock BetterAuthGuard to always allow requests in tests
    const mockAuthGuard = {
      canActivate: (context: ExecutionContext) => true,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
      ],
    })
      .overrideGuard(BetterAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /users/push-token', () => {
    it('should register valid push token', async () => {
      const req = { user: { id: 'user-123' } };
      const body = { pushToken: 'ExponentPushToken[xxxxxx]' };

      const result = await controller.registerPushToken(req, body);

      expect(mockPushNotificationService.isValidPushToken).toHaveBeenCalledWith(
        'ExponentPushToken[xxxxxx]',
      );
      expect(mockUserRepository.updatePushToken).toHaveBeenCalledWith(
        'user-123',
        'ExponentPushToken[xxxxxx]',
      );
      expect(result).toEqual({
        message: 'Push token registered successfully',
        validated: true,
      });
    });

    it('should reject invalid push token', async () => {
      mockPushNotificationService.isValidPushToken.mockReturnValue(false);

      const req = { user: { id: 'user-123' } };
      const body = { pushToken: 'invalid-token' };

      await expect(controller.registerPushToken(req, body)).rejects.toThrow(
        'Invalid Expo push token format',
      );

      expect(mockPushNotificationService.isValidPushToken).toHaveBeenCalledWith(
        'invalid-token',
      );
      expect(mockUserRepository.updatePushToken).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /users/notification-settings', () => {
    it('should update all notification preferences', async () => {
      const req = { user: { id: 'user-123' } };
      const body = {
        pushNotificationsEnabled: false,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: false,
      };

      const result = await controller.updateNotificationPreferences(req, body);

      expect(
        mockUserRepository.updateNotificationPreferences,
      ).toHaveBeenCalledWith('user-123', body);
      expect(result).toEqual({
        message: 'Notification preferences updated successfully',
        preferences: body,
      });
    });

    it('should update partial notification preferences', async () => {
      const req = { user: { id: 'user-123' } };
      const body = {
        pushNotificationsEnabled: false,
      };

      const result = await controller.updateNotificationPreferences(req, body);

      expect(
        mockUserRepository.updateNotificationPreferences,
      ).toHaveBeenCalledWith('user-123', body);
      expect(result).toEqual({
        message: 'Notification preferences updated successfully',
        preferences: body,
      });
    });

    it('should handle empty preferences object', async () => {
      const req = { user: { id: 'user-123' } };
      const body = {};

      const result = await controller.updateNotificationPreferences(req, body);

      expect(
        mockUserRepository.updateNotificationPreferences,
      ).toHaveBeenCalledWith('user-123', body);
      expect(result).toEqual({
        message: 'Notification preferences updated successfully',
        preferences: body,
      });
    });
  });
});
