/**
 * Digestion Failed Listener Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 6, Subtask 6.4 & 6.6: Notification preference enforcement
 */

import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { DigestionFailedListener } from './DigestionFailedListener';
import { PushNotificationService } from '../services/PushNotificationService';
import { UserRepository } from '../repositories/UserRepository';

describe('DigestionFailedListener', () => {
  let listener: DigestionFailedListener;
  let mockPushNotificationService: jest.Mocked<PushNotificationService>;
  let mockUserRepository: jest.Mocked<UserRepository>;

  const mockEvent = {
    eventType: 'DigestionJobFailed',
    captureId: 'capture-456',
    userId: 'user-789',
    errorMessage: 'Processing failed',
    stackTrace: 'Error stack trace...',
    retryCount: 3,
    failedAt: new Date().toISOString(),
    jobPayload: { captureId: 'capture-456', userId: 'user-789' },
  };

  beforeEach(async () => {
    mockPushNotificationService = {
      sendErrorNotification: jest.fn().mockResolvedValue({
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
        DigestionFailedListener,
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

    listener = module.get<DigestionFailedListener>(DigestionFailedListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDigestionFailed (AC5, AC7)', () => {
    it('should send error notification when preferences enabled', async () => {
      await listener.handleDigestionFailed(mockEvent);

      expect(mockUserRepository.getUserNotificationSettings).toHaveBeenCalledWith('user-789');
      expect(mockPushNotificationService.sendErrorNotification).toHaveBeenCalledWith(
        'user-789',
        'ExponentPushToken[xxxxxx]',
        'capture-456',
        3, // retryCount
      );
    });

    it('should NOT send notification if pushNotificationsEnabled is false (AC7)', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue({
        pushToken: 'ExponentPushToken[xxxxxx]',
        pushNotificationsEnabled: false, // Disabled
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      });

      await listener.handleDigestionFailed(mockEvent);

      expect(mockUserRepository.getUserNotificationSettings).toHaveBeenCalledWith('user-789');
      expect(mockPushNotificationService.sendErrorNotification).not.toHaveBeenCalled();
    });

    it('should NOT send notification if user has no push token', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue({
        pushToken: undefined, // No token
        pushNotificationsEnabled: true,
        localNotificationsEnabled: true,
        hapticFeedbackEnabled: true,
      });

      await listener.handleDigestionFailed(mockEvent);

      expect(mockUserRepository.getUserNotificationSettings).toHaveBeenCalledWith('user-789');
      expect(mockPushNotificationService.sendErrorNotification).not.toHaveBeenCalled();
    });

    it('should NOT send notification if user settings not found', async () => {
      mockUserRepository.getUserNotificationSettings.mockResolvedValue(null);

      await listener.handleDigestionFailed(mockEvent);

      expect(mockUserRepository.getUserNotificationSettings).toHaveBeenCalledWith('user-789');
      expect(mockPushNotificationService.sendErrorNotification).not.toHaveBeenCalled();
    });

    it('should log error if notification send fails', async () => {
      mockPushNotificationService.sendErrorNotification.mockResolvedValue({
        success: false,
        error: 'DeviceNotRegistered',
      });

      await listener.handleDigestionFailed(mockEvent);

      expect(mockPushNotificationService.sendErrorNotification).toHaveBeenCalled();
      // Error should be logged (tested via logger spy if needed)
    });

    it('should handle exceptions gracefully', async () => {
      mockUserRepository.getUserNotificationSettings.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(listener.handleDigestionFailed(mockEvent)).resolves.not.toThrow();
    });
  });
});
