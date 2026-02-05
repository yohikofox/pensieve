/**
 * useTimeoutWarning Hook Tests
 * Story 4.4 - Task 11, Subtask 11.7
 *
 * Tests timeout warning handling:
 * - Listen to WebSocket timeout warning events (AC9)
 * - Show timeout notification with actions
 * - Handle "Keep Waiting" action (Subtask 11.4)
 * - Handle "Cancel" action (Subtask 11.5)
 * - Log slow processing metrics (Subtask 11.6)
 */

import { renderHook, act } from '@testing-library/react-native';
import { useTimeoutWarning } from '../useTimeoutWarning';
import { LocalNotificationService } from '../../services/notifications/LocalNotificationService';
import * as Notifications from 'expo-notifications';

// Mock dependencies
jest.mock('../../services/notifications/LocalNotificationService');
jest.mock('expo-notifications');

describe('useTimeoutWarning - Task 11.7', () => {
  let mockNotificationService: jest.Mocked<LocalNotificationService>;
  let mockNotificationResponseListener: jest.Mock;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock LocalNotificationService
    mockNotificationService = {
      showTimeoutWarningNotification: jest.fn().mockResolvedValue('notification-id-1'),
      setupNotificationCategories: jest.fn().mockResolvedValue(undefined),
      addNotificationResponseListener: jest.fn(),
    } as any;

    (LocalNotificationService as jest.Mock).mockImplementation(
      () => mockNotificationService
    );

    // Mock notification response listener
    mockNotificationResponseListener = jest.fn();
    mockNotificationService.addNotificationResponseListener.mockReturnValue({
      remove: jest.fn(),
    } as any);

    // Mock WebSocket connection
    mockWebSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    // Store WebSocket for tests
    (global as any).__mockWebSocket = mockWebSocket;
  });

  describe('WebSocket Timeout Warning Event (AC9)', () => {
    it('should listen to progress.timeout-warning events', () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      expect(mockWebSocket.on).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.any(Function)
      );
    });

    it('should show timeout notification when event received', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      // Get the callback registered with WebSocket
      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      // Trigger timeout warning event
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenCalledWith(
        'capture-123',
        32000
      );
    });

    it('should not show notification if disabled', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: false,
        })
      );

      // When disabled, should not subscribe to WebSocket events
      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      expect(callback).toBeUndefined();
      expect(mockNotificationService.showTimeoutWarningNotification).not.toHaveBeenCalled();
    });

    it('should default to enabled=true', () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
        })
      );

      expect(mockWebSocket.on).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.any(Function)
      );
    });

    it('should cleanup WebSocket listener on unmount', () => {
      const { unmount } = renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      unmount();

      expect(mockWebSocket.off).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.any(Function)
      );
    });
  });

  describe('Notification Action Handlers', () => {
    it('should setup notification categories on mount', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockNotificationService.setupNotificationCategories).toHaveBeenCalled();
    });

    it('should register notification response listener', () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      expect(mockNotificationService.addNotificationResponseListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('Keep Waiting Action (Subtask 11.4)', () => {
    it('should handle keep_waiting action', async () => {
      const onKeepWaiting = jest.fn();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
          onKeepWaiting,
        })
      );

      // Get the notification response handler
      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      // Simulate "Keep Waiting" button press
      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'keep_waiting',
        } as any);
      });

      expect(onKeepWaiting).toHaveBeenCalledWith('capture-123');
    });

    it('should log keep_waiting action for monitoring', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'keep_waiting',
        } as any);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[useTimeoutWarning] Keep waiting:',
        'capture-123'
      );

      consoleLogSpy.mockRestore();
    });

    it('should not trigger onKeepWaiting if not a timeout_warning notification', async () => {
      const onKeepWaiting = jest.fn();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
          onKeepWaiting,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'completed', // Different notification type
                },
              },
            },
          },
          actionIdentifier: 'keep_waiting',
        } as any);
      });

      expect(onKeepWaiting).not.toHaveBeenCalled();
    });
  });

  describe('Cancel Action (Subtask 11.5)', () => {
    it('should handle cancel action', async () => {
      const onCancel = jest.fn();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
          onCancel,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      // Simulate "Cancel" button press
      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'cancel',
        } as any);
      });

      expect(onCancel).toHaveBeenCalledWith('capture-123');
    });

    it('should log cancel action for monitoring', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'cancel',
        } as any);
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[useTimeoutWarning] Cancel job:',
        'capture-123'
      );

      consoleLogSpy.mockRestore();
    });

    it('should emit cancel-job event to WebSocket when onCancel not provided', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'cancel',
        } as any);
      });

      expect(mockWebSocket.emit).toHaveBeenCalledWith('digestion:cancel-job', {
        captureId: 'capture-123',
      });
    });
  });

  describe('Default Action (Tap Notification)', () => {
    it('should handle default tap without action identifier', async () => {
      const onTap = jest.fn();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
          onTap,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        } as any);
      });

      expect(onTap).toHaveBeenCalledWith('capture-123');
    });

    it('should not crash if no callback provided for default tap', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
        } as any);
      });

      // Should not throw
    });
  });

  describe('Slow Processing Metrics (Subtask 11.6)', () => {
    it('should log timeout event with metrics', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useTimeoutWarning] Timeout warning:'),
        expect.objectContaining({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('should include timestamp in metrics log', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const timestamp = new Date().toISOString();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp,
        });
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timestamp,
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Edge Cases (Subtask 11.8)', () => {
    it('should handle timeout warning while job completes', async () => {
      const onKeepWaiting = jest.fn();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
          onKeepWaiting,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      // Show timeout warning
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      // User presses "Keep Waiting" but job already completed
      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'keep_waiting',
        } as any);
      });

      // Should still call handler (backend will validate if job exists)
      expect(onKeepWaiting).toHaveBeenCalledWith('capture-123');
    });

    it('should handle notification service error gracefully', async () => {
      mockNotificationService.showTimeoutWarningNotification.mockRejectedValue(
        new Error('Notification failed')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      // Should log error but not crash
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useTimeoutWarning] Failed to show notification:'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should only show one notification per captureId', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      // First timeout warning
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      // Second timeout warning for same capture (should be ignored)
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 35000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenCalledTimes(1);
    });

    it('should allow new notification after user action', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      // First timeout warning
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      // User presses "Keep Waiting"
      const responseHandler =
        mockNotificationService.addNotificationResponseListener.mock.calls[0][0];

      await act(async () => {
        await responseHandler({
          notification: {
            request: {
              content: {
                data: {
                  captureId: 'capture-123',
                  type: 'timeout_warning',
                },
              },
            },
          },
          actionIdentifier: 'keep_waiting',
        } as any);
      });

      // Second timeout warning after user action (should be allowed)
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 62000,
          threshold: 60000,
          timestamp: new Date().toISOString(),
        });
      });

      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple Captures', () => {
    it('should handle timeout warnings for different captures independently', async () => {
      renderHook(() =>
        useTimeoutWarning({
          webSocket: mockWebSocket,
          enabled: true,
        })
      );

      const callback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'progress.timeout-warning'
      )?.[1];

      // Timeout warning for capture-123
      await act(async () => {
        await callback({
          captureId: 'capture-123',
          elapsed: 32000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      // Timeout warning for capture-456 (should be allowed)
      await act(async () => {
        await callback({
          captureId: 'capture-456',
          elapsed: 33000,
          threshold: 30000,
          timestamp: new Date().toISOString(),
        });
      });

      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenCalledTimes(2);
      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenNthCalledWith(
        1,
        'capture-123',
        32000
      );
      expect(mockNotificationService.showTimeoutWarningNotification).toHaveBeenNthCalledWith(
        2,
        'capture-456',
        33000
      );
    });
  });
});
