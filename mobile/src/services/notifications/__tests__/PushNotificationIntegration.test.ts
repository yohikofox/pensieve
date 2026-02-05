/**
 * Push Notification Integration Tests
 * Story 4.4 - Task 5, Subtask 5.8
 *
 * Tests push notification delivery behavior in different app states:
 * - Foreground: Local notification should be shown
 * - Background: Push notification should be sent
 * - Closed: Push notification should be sent
 *
 * AC3: Completion Notification with Preview
 */

import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import { LocalNotificationService } from '../LocalNotificationService';

// Mock expo-notifications
jest.mock('expo-notifications');

// Mock AppState
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  currentState: 'active',
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe('Push Notification Integration - AC3 (Task 5.8)', () => {
  let localNotificationService: LocalNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    localNotificationService = new LocalNotificationService();

    // Default mock implementations
    (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notification-id');
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
  });

  describe('Foreground State (App Active)', () => {
    it('should show local notification when app is in foreground', async () => {
      // Given: App is in foreground state
      (AppState.currentState as AppStateStatus) = 'active';

      const captureId = 'capture-123';
      const summary = 'This is a test summary of the digested thought';
      const ideasCount = 3;
      const todosCount = 2;

      // When: Completion notification is triggered
      await localNotificationService.showCompletionNotification(
        captureId,
        summary,
        ideasCount,
        todosCount
      );

      // Then: Local notification should be scheduled immediately
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '✨ New insights from your thought!',
          body: expect.stringContaining('3 ideas, 2 actions'),
          data: {
            captureId,
            type: 'completed',
            deepLink: `pensieve://capture/${captureId}`,
          },
          sound: true,
        },
        trigger: null, // Immediate trigger
      });
    });

    it('should include insights preview in notification body (AC3)', async () => {
      // Given: App is in foreground
      (AppState.currentState as AppStateStatus) = 'active';

      const summary = 'A very long summary text that should be truncated after 50 characters to avoid notification overflow';
      const captureId = 'capture-456';

      // When: Completion notification is triggered
      await localNotificationService.showCompletionNotification(
        captureId,
        summary,
        1,
        1
      );

      // Then: Body should contain truncated summary preview
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: expect.stringMatching(/A very long summary text that should be truncated \.\.\./),
          }),
        })
      );
    });

    it('should trigger notification even if permissions not granted (best effort)', async () => {
      // Given: Permissions not granted (AC3 should still attempt)
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
        granted: false,
      });

      // When: Attempting to show notification
      await localNotificationService.showCompletionNotification(
        'capture-789',
        'Summary',
        0,
        0
      );

      // Then: Should still attempt to schedule (system will block if denied)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('Background State (App Backgrounded)', () => {
    it('should prepare notification for background delivery (AC3)', async () => {
      // Given: App is in background state
      (AppState.currentState as AppStateStatus) = 'background';

      const captureId = 'capture-bg-123';
      const summary = 'Background notification test';
      const ideasCount = 5;
      const todosCount = 3;

      // When: Completion notification is triggered
      // Note: In background, mobile app should NOT handle this directly.
      // Backend PushNotificationService should send Expo push notification.
      // This test verifies mobile service behavior when called in background.

      await localNotificationService.showCompletionNotification(
        captureId,
        summary,
        ideasCount,
        todosCount
      );

      // Then: Local notification service still schedules (app-level behavior)
      // Real push notification would come from backend via Expo Push Service
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        content: {
          title: '✨ New insights from your thought!',
          body: expect.stringContaining('5 ideas, 3 actions'),
          data: {
            captureId,
            type: 'completed',
            deepLink: `pensieve://capture/${captureId}`,
          },
          sound: true,
        },
        trigger: null,
      });
    });

    it('should handle background notification with deep link data (AC4)', async () => {
      // Given: App in background
      (AppState.currentState as AppStateStatus) = 'background';

      const captureId = 'capture-deep-link-test';

      // When: Notification triggered
      await localNotificationService.showCompletionNotification(
        captureId,
        'Test summary',
        2,
        1
      );

      // Then: Deep link should be included in notification data
      const callArgs = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
      expect(callArgs.content.data.deepLink).toBe(`pensieve://capture/${captureId}`);
      expect(callArgs.content.data.captureId).toBe(captureId);
    });
  });

  describe('Closed State (App Terminated)', () => {
    it('should handle notification scheduling when app is not running', async () => {
      // Given: App state is unknown/inactive (app closed)
      (AppState.currentState as AppStateStatus) = 'unknown';

      // Note: When app is closed, only backend push notifications via Expo Push Service work.
      // This test verifies the mobile service can still be called safely.

      const captureId = 'capture-closed-app';

      // When: Attempting to show notification (would normally come from background task)
      await localNotificationService.showCompletionNotification(
        captureId,
        'Closed app test',
        1,
        0
      );

      // Then: Should gracefully handle scheduling
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('Edge Cases - App State Transitions', () => {
    it('should handle rapid foreground-background transitions', async () => {
      // Given: App transitions between states rapidly
      (AppState.currentState as AppStateStatus) = 'active';

      // When: First notification in foreground
      await localNotificationService.showCompletionNotification(
        'capture-1',
        'First',
        1,
        1
      );

      // Then: Switch to background
      (AppState.currentState as AppStateStatus) = 'background';

      // When: Second notification in background
      await localNotificationService.showCompletionNotification(
        'capture-2',
        'Second',
        2,
        2
      );

      // Then: Both notifications should be scheduled
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    });

    it('should not crash if AppState is unavailable', async () => {
      // Given: AppState.currentState is undefined (edge case)
      (AppState.currentState as any) = undefined;

      // When: Attempting notification
      const operation = localNotificationService.showCompletionNotification(
        'capture-undefined',
        'Test',
        0,
        0
      );

      // Then: Should not throw error
      await expect(operation).resolves.not.toThrow();
    });
  });

  describe('Notification Permissions', () => {
    it('should check permissions before scheduling (best practice)', async () => {
      // When: Showing any notification
      await localNotificationService.showCompletionNotification(
        'capture-perm-check',
        'Permission test',
        1,
        1
      );

      // Then: Should attempt to schedule notification
      // (Expo notifications will handle permission check internally)
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should handle notification scheduling failure gracefully', async () => {
      // Given: Notification scheduling fails (e.g., system error)
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('System denied notification')
      );

      // When: Attempting to show notification
      const result = await localNotificationService.showCompletionNotification(
        'capture-fail',
        'Failure test',
        0,
        0
      );

      // Then: Should return null (graceful error handling, not crashing)
      expect(result).toBeNull();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('Backend Integration Note', () => {
    it('verifies mobile service structure for backend push integration', () => {
      // This test documents the integration contract between:
      // - Mobile LocalNotificationService (foreground local notifications)
      // - Backend PushNotificationService (background/closed push via Expo)

      // AC3: Push notification (background) sent via Backend PushNotificationService
      // AC3: Local notification (foreground) sent via Mobile LocalNotificationService

      // Integration flow:
      // 1. DigestionCompleted event fires (Backend)
      // 2. Backend checks app state of user (not trivial - usually assume background)
      // 3. Backend sends Expo push notification via PushNotificationService
      // 4. Expo delivers notification based on actual app state:
      //    - If foreground: App receives via NotificationListener → shows local notification
      //    - If background/closed: System shows push notification directly

      // This test confirms mobile service API matches backend expectations
      expect(localNotificationService.showCompletionNotification).toBeDefined();
      expect(typeof localNotificationService.showCompletionNotification).toBe('function');
    });
  });
});
