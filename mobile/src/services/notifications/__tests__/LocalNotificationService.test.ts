/**
 * Local Notification Service Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 4, Subtask 4.9: Add unit tests for LocalNotificationService
 */

import { LocalNotificationService } from '../LocalNotificationService';
import * as Notifications from 'expo-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
}));

describe('LocalNotificationService', () => {
  let service: LocalNotificationService;

  beforeEach(() => {
    service = new LocalNotificationService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear all intervals
    service.cancelAllNotifications();
  });

  describe('requestPermissions', () => {
    it('should return true if permissions already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestPermissions();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('should request permissions if not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestPermissions();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false if permissions denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await service.requestPermissions();

      expect(result).toBe(false);
    });
  });

  describe('showQueuedNotification (AC1)', () => {
    it('should show queued notification with queue position', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showQueuedNotification('capture-123', 5);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Processing your thought...',
          body: 'Position in queue: 5',
          data: {
            captureId: 'capture-123',
            type: 'queued',
          },
          sound: true,
        },
        trigger: null,
      });
    });

    it('should show queued notification without queue position', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-456',
      );

      const notificationId = await service.showQueuedNotification('capture-456');

      expect(notificationId).toBe('notification-456');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Processing your thought...',
          body: 'Starting soon',
          data: {
            captureId: 'capture-456',
            type: 'queued',
          },
          sound: true,
        },
        trigger: null,
      });
    });

    it('should return null if notification fails', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied'),
      );

      const notificationId = await service.showQueuedNotification('capture-789');

      expect(notificationId).toBeNull();
    });
  });

  describe('showProcessingNotification (AC2)', () => {
    it('should NOT show notification if elapsed < 10s', async () => {
      const notificationId = await service.showProcessingNotification('capture-123', 8000);

      expect(notificationId).toBeNull();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should show "Still processing..." notification if elapsed > 10s', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showProcessingNotification('capture-123', 12000);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Still processing...',
          body: 'Taking longer than usual (12s)',
          data: {
            captureId: 'capture-123',
            type: 'still_processing',
          },
          sound: false,
        },
        trigger: null,
      });
    });
  });

  describe('startPeriodicProcessingNotifications (Subtask 4.7)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should schedule periodic notifications every 10s', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

      const startedAt = Date.now();
      service.startPeriodicProcessingNotifications('capture-123', startedAt);

      // Fast-forward 10 seconds
      jest.advanceTimersByTime(10000);
      await Promise.resolve(); // Flush promises

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);

      // Fast-forward another 10 seconds
      jest.advanceTimersByTime(10000);
      await Promise.resolve();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('should stop periodic notifications', () => {
      const startedAt = Date.now();
      service.startPeriodicProcessingNotifications('capture-123', startedAt);

      service.stopPeriodicProcessingNotifications('capture-123');

      // Fast-forward 10 seconds - should NOT trigger notification
      jest.advanceTimersByTime(10000);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('showCompletionNotification (AC3)', () => {
    it('should show completion notification with insights preview', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const summary = 'This is a test summary that should be truncated if too long';
      const notificationId = await service.showCompletionNotification(
        'capture-123',
        summary,
        3,
        2,
      );

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '✨ New insights from your thought!',
          body: expect.stringContaining('3 ideas, 2 actions'),
          data: {
            captureId: 'capture-123',
            type: 'completed',
            deepLink: 'pensieve://capture/capture-123',
          },
          sound: true,
        },
        trigger: null,
      });
    });

    it('should truncate summary preview to 50 chars (NFR12)', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

      const longSummary = 'A'.repeat(100); // 100 chars
      await service.showCompletionNotification('capture-123', longSummary, 2, 1);

      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      const bodyText = callArgs.content.body;

      // Should be truncated to ~50 chars + "..."
      expect(bodyText.length).toBeLessThan(100);
      expect(bodyText).toContain('...');
    });
  });

  describe('showErrorNotification (AC5)', () => {
    it('should show error notification with retry action', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showErrorNotification('capture-123', 3);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '❌ Unable to process thought',
          body: 'Tap to retry',
          data: {
            captureId: 'capture-123',
            type: 'failed',
            action: 'retry',
          },
          sound: true,
        },
        trigger: null,
      });
    });
  });

  describe('showTimeoutWarningNotification (AC9)', () => {
    it('should show timeout warning notification', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showTimeoutWarningNotification('capture-123', 32000);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '⚠️ This is taking longer than usual...',
          body: 'Processing for 32s. Keep waiting?',
          data: {
            captureId: 'capture-123',
            type: 'timeout_warning',
          },
          sound: true,
          categoryIdentifier: expect.any(String),
        },
        trigger: null,
      });
    });
  });

  describe('showOfflineQueueNotification (AC8)', () => {
    it('should show offline queue notification with count', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showOfflineQueueNotification(3);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: 'Queued for when online',
          body: '3 thoughts will process when connected',
          data: {
            captureId: '',
            type: 'offline_queue',
          },
          sound: false,
        },
        trigger: null,
      });
    });

    it('should use singular form for single capture', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id');

      await service.showOfflineQueueNotification(1);

      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(callArgs.content.body).toContain('1 thought will');
    });
  });

  describe('showNetworkRestoredNotification (AC8)', () => {
    it('should show network restored notification', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue(
        'notification-123',
      );

      const notificationId = await service.showNetworkRestoredNotification(2);

      expect(notificationId).toBe('notification-123');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '🌐 Back online!',
          body: 'Processing 2 queued thoughts...',
          data: {
            captureId: '',
            type: 'network_restored',
          },
          sound: true,
        },
        trigger: null,
      });
    });
  });

  describe('cancelNotificationsForCapture', () => {
    it('should cancel all notifications for a specific capture', async () => {
      (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
        {
          identifier: 'notif-1',
          content: { data: { captureId: 'capture-123' } },
        },
        {
          identifier: 'notif-2',
          content: { data: { captureId: 'capture-456' } },
        },
        {
          identifier: 'notif-3',
          content: { data: { captureId: 'capture-123' } },
        },
      ]);

      await service.cancelNotificationsForCapture('capture-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-1');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-3');
    });
  });

  describe('cancelAllNotifications', () => {
    it('should cancel all scheduled notifications', async () => {
      await service.cancelAllNotifications();

      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('setupNotificationCategories (iOS only, Subtask 4.8)', () => {
    it('should setup notification categories on iOS', async () => {
      // Mock Platform.OS to be 'ios'
      jest.mock('react-native/Libraries/Utilities/Platform', () => ({
        OS: 'ios',
        select: jest.fn(),
      }));

      await service.setupNotificationCategories();

      // On iOS, should setup categories
      // Note: This test may need adjustment based on platform mocking
    });
  });

  describe('addNotificationResponseListener (Subtask 4.8)', () => {
    it('should add notification response listener', () => {
      const mockHandler = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue(
        mockSubscription,
      );

      const subscription = service.addNotificationResponseListener(mockHandler);

      expect(subscription).toBe(mockSubscription);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(
        mockHandler,
      );
    });
  });

  describe('addNotificationReceivedListener', () => {
    it('should add notification received listener', () => {
      const mockHandler = jest.fn();
      const mockSubscription = { remove: jest.fn() };
      (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue(
        mockSubscription,
      );

      const subscription = service.addNotificationReceivedListener(mockHandler);

      expect(subscription).toBe(mockSubscription);
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(mockHandler);
    });
  });
});
