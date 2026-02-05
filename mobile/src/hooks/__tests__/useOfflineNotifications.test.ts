/**
 * useOfflineNotifications Hook Tests
 * Story 4.4 - Task 10, Subtask 10.4
 *
 * Tests offline notification integration:
 * - Send notification when offline (AC8)
 * - Send notification when network returns (AC8)
 * - Integrate with LocalNotificationService
 * - Respect enabled flag
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOfflineNotifications } from '../useOfflineNotifications';
import { LocalNotificationService } from '../../services/notifications/LocalNotificationService';

// Mock dependencies
jest.mock('../useOfflineQueueStatus', () => ({
  useOfflineQueueStatus: jest.fn((options) => {
    // Store callbacks for manual triggering in tests
    (global as any).__offlineCallbacks = options;
    return {
      isOffline: false,
      offlineCaptureIds: new Set(),
    };
  }),
}));

jest.mock('../../services/notifications/LocalNotificationService');

describe('useOfflineNotifications - Task 10.4', () => {
  let mockNotificationService: jest.Mocked<LocalNotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock LocalNotificationService methods
    mockNotificationService = {
      showOfflineQueueNotification: jest.fn().mockResolvedValue('notification-id-1'),
      showNetworkRestoredNotification: jest.fn().mockResolvedValue('notification-id-2'),
    } as any;

    (LocalNotificationService as jest.Mock).mockImplementation(
      () => mockNotificationService
    );
  });

  describe('Offline Notification (AC8)', () => {
    it('should send offline queue notification when going offline', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 3,
        })
      );

      // Trigger offline callback
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1', 'capture-2']);
      });

      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledWith(3);
      });
    });

    it('should use queuedCaptureCount if provided', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 5,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledWith(5);
      });
    });

    it('should use captureIds length if queuedCaptureCount is 0', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 0,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(
          ['capture-1', 'capture-2', 'capture-3']
        );
      });

      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledWith(3);
      });
    });

    it('should not send notification if count is 0', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 0,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.([]); // Empty array
      });

      expect(mockNotificationService.showOfflineQueueNotification).not.toHaveBeenCalled();
    });

    it('should only send offline notification once per offline period', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 2,
        })
      );

      // Trigger offline multiple times
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-2']);
      });

      // Should only call once
      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Online Notification (AC8)', () => {
    it('should send network restored notification when coming back online', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 3,
        })
      );

      // First go offline
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      // Then come back online
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      await waitFor(() => {
        expect(mockNotificationService.showNetworkRestoredNotification).toHaveBeenCalledWith(3);
      });
    });

    it('should use queuedCaptureCount for online notification', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 5,
        })
      );

      // Go offline then online
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      await waitFor(() => {
        expect(mockNotificationService.showNetworkRestoredNotification).toHaveBeenCalledWith(5);
      });
    });

    it('should not send online notification if never went offline', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 3,
        })
      );

      // Trigger online without offline first
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      expect(mockNotificationService.showNetworkRestoredNotification).not.toHaveBeenCalled();
    });

    it('should not send online notification if count is 0', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 0,
        })
      );

      // Go offline then online with 0 count
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.([]); // 0 count
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      expect(mockNotificationService.showNetworkRestoredNotification).not.toHaveBeenCalled();
    });

    it('should reset offline notification flag after coming online', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 2,
        })
      );

      // First offline-online cycle
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      // Second offline-online cycle
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-2']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      // Should send notifications in both cycles
      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledTimes(2);
        expect(mockNotificationService.showNetworkRestoredNotification).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Enabled Flag', () => {
    it('should not send notifications when enabled=false', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: false,
          queuedCaptureCount: 3,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      expect(mockNotificationService.showOfflineQueueNotification).not.toHaveBeenCalled();
      expect(mockNotificationService.showNetworkRestoredNotification).not.toHaveBeenCalled();
    });

    it('should default to enabled=true', async () => {
      renderHook(() =>
        useOfflineNotifications({
          queuedCaptureCount: 2,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      await waitFor(() => {
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalled();
      });
    });

    it('should reset notification flag when enabled changes to false', async () => {
      const { rerender } = renderHook(
        ({ enabled, count }) =>
          useOfflineNotifications({ enabled, queuedCaptureCount: count }),
        {
          initialProps: { enabled: true, count: 2 },
        }
      );

      // Go offline
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      // Disable
      rerender({ enabled: false, count: 2 });

      // Go online (should not send notification because disabled)
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      expect(mockNotificationService.showNetworkRestoredNotification).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid offline/online cycles', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 1,
        })
      );

      // Rapid cycles
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
        await (global as any).__offlineCallbacks?.onOnline?.();
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-2']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      await waitFor(() => {
        // Should handle both cycles
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledTimes(2);
        expect(mockNotificationService.showNetworkRestoredNotification).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle notification service errors gracefully', async () => {
      mockNotificationService.showOfflineQueueNotification.mockRejectedValue(
        new Error('Notification failed')
      );

      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 2,
        })
      );

      // Should not crash on error
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      // Verify it attempted to send
      expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should work with default options', async () => {
      renderHook(() => useOfflineNotifications());

      // Should not crash with no options
      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
      });

      // Enabled by default, queuedCaptureCount is 0 but captureIds.length is 1
      // So it will use captureIds.length as fallback
      expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalledWith(1);
    });
  });

  describe('Integration', () => {
    it('should integrate with LocalNotificationService correctly', async () => {
      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 3,
        })
      );

      await act(async () => {
        await (global as any).__offlineCallbacks?.onOffline?.(['capture-1']);
        await (global as any).__offlineCallbacks?.onOnline?.();
      });

      await waitFor(() => {
        // Verify both notification methods were called
        expect(mockNotificationService.showOfflineQueueNotification).toHaveBeenCalled();
        expect(mockNotificationService.showNetworkRestoredNotification).toHaveBeenCalled();
      });
    });

    it('should work with useOfflineQueueStatus hook', () => {
      // This documents the integration pattern
      // useOfflineNotifications internally uses useOfflineQueueStatus

      renderHook(() =>
        useOfflineNotifications({
          enabled: true,
          queuedCaptureCount: 2,
        })
      );

      // Verify useOfflineQueueStatus was called (via mock)
      expect((global as any).__offlineCallbacks).toBeDefined();
      expect((global as any).__offlineCallbacks?.onOffline).toBeDefined();
      expect((global as any).__offlineCallbacks?.onOnline).toBeDefined();
    });
  });
});
