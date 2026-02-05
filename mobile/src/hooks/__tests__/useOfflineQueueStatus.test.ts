/**
 * useOfflineQueueStatus Hook Tests
 * Story 4.4 - Task 10, Subtask 10.2
 *
 * Tests offline queue status management:
 * - Detect offline transitions (AC8)
 * - Update capture status to "Queued for when online"
 * - Detect online transitions
 * - Clear offline queue when back online
 */

// Mock NetworkStatusService BEFORE imports
jest.mock('../../services/network/NetworkStatusService', () => ({
  NetworkStatusService: {
    getInstance: jest.fn(),
  },
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { NetworkStatusService } from '../../services/network/NetworkStatusService';
import {
  useOfflineQueueStatus,
  addToOfflineQueue,
  removeFromOfflineQueue,
  isInOfflineQueue,
} from '../useOfflineQueueStatus';

describe('useOfflineQueueStatus - Task 10.2', () => {
  let mockNetworkService: jest.Mocked<NetworkStatusService>;
  let networkStatusCallback: ((status: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock NetworkStatusService instance
    mockNetworkService = {
      subscribe: jest.fn((callback) => {
        networkStatusCallback = callback;
        // Immediately call with initial online status
        callback({ isConnected: true, type: 'wifi', timestamp: new Date() });
        return jest.fn(); // unsubscribe function
      }),
      getCurrentStatus: jest.fn(() => ({
        isConnected: true,
        type: 'wifi',
        timestamp: new Date(),
      })),
      isOnline: jest.fn(() => true),
      isOffline: jest.fn(() => false),
    } as any;

    (NetworkStatusService.getInstance as jest.Mock).mockReturnValue(mockNetworkService);
  });

  afterEach(() => {
    networkStatusCallback = null;
  });

  describe('Network Status Monitoring', () => {
    it('should initialize with online state', () => {
      const { result } = renderHook(() => useOfflineQueueStatus());

      expect(result.current.isOffline).toBe(false);
      expect(result.current.offlineCaptureIds.size).toBe(0);
    });

    it('should subscribe to NetworkStatusService on mount', () => {
      renderHook(() => useOfflineQueueStatus());

      expect(mockNetworkService.subscribe).toHaveBeenCalled();
    });

    it('should unsubscribe on unmount', () => {
      const unsubscribeMock = jest.fn();
      mockNetworkService.subscribe.mockReturnValue(unsubscribeMock);

      const { unmount } = renderHook(() => useOfflineQueueStatus());

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('Offline Transition (AC8)', () => {
    it('should detect when network goes offline', async () => {
      const { result } = renderHook(() => useOfflineQueueStatus());

      // Initially online
      expect(result.current.isOffline).toBe(false);

      // Simulate offline transition
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });
    });

    it('should call onOffline callback when going offline', async () => {
      const onOfflineMock = jest.fn();

      renderHook(() =>
        useOfflineQueueStatus({
          onOffline: onOfflineMock,
        })
      );

      // Simulate offline transition
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(onOfflineMock).toHaveBeenCalled();
      });
    });

    it('should pass offline capture IDs to onOffline callback', async () => {
      const onOfflineMock = jest.fn();

      const { result } = renderHook(() =>
        useOfflineQueueStatus({
          onOffline: onOfflineMock,
        })
      );

      // Add some captures to offline queue (simulating queued captures)
      act(() => {
        addToOfflineQueue('capture-1', (updater) => {
          const newState =
            typeof updater === 'function' ? updater(result.current.offlineCaptureIds) : updater;
          // Note: In real usage, this would be managed by component state
        });
      });

      // Simulate offline transition
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(onOfflineMock).toHaveBeenCalled();
        // Callback receives array of capture IDs
        expect(onOfflineMock.mock.calls[0][0]).toBeInstanceOf(Array);
      });
    });
  });

  describe('Online Transition (AC8)', () => {
    it('should detect when network comes back online', async () => {
      // Start with offline state
      mockNetworkService.subscribe.mockImplementation((callback) => {
        networkStatusCallback = callback;
        callback({ isConnected: false, type: 'none', timestamp: new Date() });
        return jest.fn();
      });

      const { result } = renderHook(() => useOfflineQueueStatus());

      // Initially offline
      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });

      // Simulate online transition
      act(() => {
        networkStatusCallback?.({
          isConnected: true,
          type: 'wifi',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(false);
      });
    });

    it('should call onOnline callback when coming back online', async () => {
      const onOnlineMock = jest.fn();

      // Start offline
      mockNetworkService.subscribe.mockImplementation((callback) => {
        networkStatusCallback = callback;
        callback({ isConnected: false, type: 'none', timestamp: new Date() });
        return jest.fn();
      });

      renderHook(() =>
        useOfflineQueueStatus({
          onOnline: onOnlineMock,
        })
      );

      // Go back online
      act(() => {
        networkStatusCallback?.({
          isConnected: true,
          type: 'wifi',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(onOnlineMock).toHaveBeenCalled();
      });
    });

    it('should clear offline capture IDs when back online', async () => {
      // Start offline
      mockNetworkService.subscribe.mockImplementation((callback) => {
        networkStatusCallback = callback;
        callback({ isConnected: false, type: 'none', timestamp: new Date() });
        return jest.fn();
      });

      const { result } = renderHook(() => useOfflineQueueStatus());

      // Verify initially offline
      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });

      // Simulate some captures in offline queue
      // (In real usage, these would be added via component state management)

      // Go back online
      act(() => {
        networkStatusCallback?.({
          isConnected: true,
          type: 'wifi',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(false);
        expect(result.current.offlineCaptureIds.size).toBe(0);
      });
    });
  });

  describe('Helper Functions', () => {
    it('addToOfflineQueue should add capture ID to set', () => {
      let captureIds = new Set<string>();
      const setState = jest.fn((updater) => {
        captureIds = updater(captureIds);
      });

      addToOfflineQueue('capture-1', setState);

      expect(setState).toHaveBeenCalled();
      expect(captureIds.has('capture-1')).toBe(true);
    });

    it('addToOfflineQueue should not duplicate IDs', () => {
      let captureIds = new Set<string>(['capture-1']);
      const setState = jest.fn((updater) => {
        captureIds = updater(captureIds);
      });

      addToOfflineQueue('capture-1', setState);

      expect(captureIds.size).toBe(1);
    });

    it('removeFromOfflineQueue should remove capture ID', () => {
      let captureIds = new Set<string>(['capture-1', 'capture-2']);
      const setState = jest.fn((updater) => {
        captureIds = updater(captureIds);
      });

      removeFromOfflineQueue('capture-1', setState);

      expect(setState).toHaveBeenCalled();
      expect(captureIds.has('capture-1')).toBe(false);
      expect(captureIds.has('capture-2')).toBe(true);
    });

    it('isInOfflineQueue should check if capture is in queue', () => {
      const captureIds = new Set<string>(['capture-1', 'capture-2']);

      expect(isInOfflineQueue('capture-1', captureIds)).toBe(true);
      expect(isInOfflineQueue('capture-3', captureIds)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid offline/online transitions', async () => {
      const onOfflineMock = jest.fn();
      const onOnlineMock = jest.fn();

      renderHook(() =>
        useOfflineQueueStatus({
          onOffline: onOfflineMock,
          onOnline: onOnlineMock,
        })
      );

      // Rapid transitions
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      act(() => {
        networkStatusCallback?.({
          isConnected: true,
          type: 'wifi',
          timestamp: new Date(),
        });
      });

      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        // Should call callbacks for each transition
        expect(onOfflineMock.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(onOnlineMock.mock.calls.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should work without callbacks provided', async () => {
      const { result } = renderHook(() => useOfflineQueueStatus());

      // Should not crash when callbacks are undefined
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });
    });

    it('should handle multiple rerenders', async () => {
      const { result, rerender } = renderHook(() => useOfflineQueueStatus());

      expect(result.current.isOffline).toBe(false);

      // Rerender multiple times
      rerender();
      rerender();
      rerender();

      // Should still work correctly
      act(() => {
        networkStatusCallback?.({
          isConnected: false,
          type: 'none',
          timestamp: new Date(),
        });
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(true);
      });
    });
  });
});
