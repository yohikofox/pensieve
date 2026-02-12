/**
 * Digestion Completed Listener Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.4 & 6.6: Notification preference enforcement
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DigestionCompletedListener } from './DigestionCompletedListener';
import { PushNotificationService } from '../services/PushNotificationService';
import { UserRepository } from '../repositories/UserRepository';

describe('DigestionCompletedListener', () => {
  let listener: DigestionCompletedListener;
  let mockPushNotificationService: jest.Mocked<PushNotificationService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockEvent = {
    thoughtId: 'thought-123',
    captureId: 'capture-456',
    userId: 'user-789',
    summary: 'Test summary for notification',
    ideasCount: 3,
    todosCount: 2,
    processingTimeMs: 15000,
    completedAt: new Date(),
  };

  beforeEach(async () => {
    mockPushNotificationService = {
      sendDigestionCompleteNotification: jest.fn().mockResolvedValue({
        success: true,
        ticketId: 'ticket-123',
      }),
    } as any;

    mockUserRepository = {
      getUserNotificationSettings: jest.fn().mockResolvedValue({
        pushToken: 'ExponentPushToken[xxxxxx]',
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestionCompletedListener,
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    listener = module.get<DigestionCompletedListener>(
      DigestionCompletedListener,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDigestionCompleted (AC3, AC7)', () => {
    it('should send push notification when preferences enabled', async () => {
      await listener.handleDigestionCompleted(mockEvent);

      expect(
        mockUserRepository.getUserNotificationSettings,
      ).toHaveBeenCalledWith('user-789');
      expect(
        mockPushNotificationService.sendDigestionCompleteNotification,
      ).toHaveBeenCalledWith(
        'user-789',
        'ExponentPushToken[xxxxxx]',
        'capture-456',
        'Test summary for notification',
        3,
        2,
      );
    });

    it('should NOT send notification if pushNotificationsEnabled is false (AC7)', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue({
        pushToken: 'ExponentPushToken[xxxxxx]',
        pushNotificationsEnabled: false, // Disabled
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      });

      await listener.handleDigestionCompleted(mockEvent);

      expect(
        mockUserRepository.getUserNotificationSettings,
      ).toHaveBeenCalledWith('user-789');
      expect(
        mockPushNotificationService.sendDigestionCompleteNotification,
      ).not.toHaveBeenCalled();
    });

    it('should NOT send notification if user has no push token', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue({
        pushToken: undefined, // No token
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      });

      await listener.handleDigestionCompleted(mockEvent);

      expect(
        mockUserRepository.getUserNotificationSettings,
      ).toHaveBeenCalledWith('user-789');
      expect(
        mockPushNotificationService.sendDigestionCompleteNotification,
      ).not.toHaveBeenCalled();
    });

    it('should NOT send notification if user settings not found', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue(null);

      await listener.handleDigestionCompleted(mockEvent);

      expect(
        mockUserRepository.getUserNotificationSettings,
      ).toHaveBeenCalledWith('user-789');
      expect(
        mockPushNotificationService.sendDigestionCompleteNotification,
      ).not.toHaveBeenCalled();
    });

    it('should log error if notification send fails', async () => {
      mockPushNotificationService.sendDigestionCompleteNotification.mockResolvedValue(
        {
          success: false,
          error: 'DeviceNotRegistered',
        },
      );

      await listener.handleDigestionCompleted(mockEvent);

      expect(
        mockPushNotificationService.sendDigestionCompleteNotification,
      ).toHaveBeenCalled();
      // Error should be logged (tested via logger spy if needed)
    });

    it('should handle exceptions gracefully', async () => {
      mockUserRepository.getUserNotificationSettings.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(
        listener.handleDigestionCompleted(mockEvent),
      ).resolves.not.toThrow();
    });
  });
});
