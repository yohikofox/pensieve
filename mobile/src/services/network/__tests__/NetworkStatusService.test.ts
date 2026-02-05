/**
 * NetworkStatusService Unit Tests
 * Story 4.4 - Task 10, Subtask 10.1
 *
 * Tests network status detection using NetInfo:
 * - Initialize and fetch initial network state (AC8)
 * - Subscribe to network changes (AC8)
 * - Detect offline transitions
 * - Detect online transitions
 * - Singleton pattern
 * - Cleanup and disposal
 */

// Mock @react-native-community/netinfo BEFORE imports
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { NetworkStatusService, NetworkStatus } from '../NetworkStatusService';

describe('NetworkStatusService - Task 10.1', () => {
  let service: NetworkStatusService;
  let mockNetInfoListener: ((state: NetInfoState) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock NetInfo.fetch() to return initial online state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      type: 'wifi' as NetInfoStateType,
    });

    // Mock NetInfo.addEventListener to capture listener
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockNetInfoListener = listener;
      // Return unsubscribe function
      return jest.fn();
    });

    // Get fresh singleton instance
    service = NetworkStatusService.getInstance();
  });

  afterEach(() => {
    service.dispose();
    mockNetInfoListener = null;
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = NetworkStatusService.getInstance();
      const instance2 = NetworkStatusService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization (AC8)', () => {
    it('should fetch initial network state on initialize', async () => {
      // When: Initialize service
      await service.initialize();

      // Then: Should fetch initial state
      expect(NetInfo.fetch).toHaveBeenCalled();
    });

    it('should subscribe to network state changes on initialize', async () => {
      // When: Initialize service
      await service.initialize();

      // Then: Should add event listener
      expect(NetInfo.addEventListener).toHaveBeenCalled();
      expect(mockNetInfoListener).not.toBeNull();
    });

    it('should set current status to initial network state', async () => {
      // Given: NetInfo returns online state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi' as NetInfoStateType,
      });

      // When: Initialize
      await service.initialize();

      // Then: Current status should reflect initial state
      const status = service.getCurrentStatus();
      expect(status).not.toBeNull();
      expect(status?.isConnected).toBe(true);
      expect(status?.type).toBe('wifi');
    });

    it('should handle offline initial state', async () => {
      // Given: NetInfo returns offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      });

      // When: Initialize
      await service.initialize();

      // Then: Current status should be offline
      const status = service.getCurrentStatus();
      expect(status?.isConnected).toBe(false);
      expect(status?.type).toBe('none');
    });
  });

  describe('Network Status Detection (AC8)', () => {
    it('should detect when network goes offline', async () => {
      // Given: Service initialized with online state
      await service.initialize();

      const statusChanges: NetworkStatus[] = [];
      service.subscribe((status) => {
        statusChanges.push(status);
      });

      // When: Network goes offline
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Then: Should notify subscribers of offline state
      expect(statusChanges.length).toBeGreaterThan(0);
      const lastStatus = statusChanges[statusChanges.length - 1];
      expect(lastStatus.isConnected).toBe(false);
      expect(lastStatus.type).toBe('none');
    });

    it('should detect when network comes online', async () => {
      // Given: Service initialized with offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      });
      await service.initialize();

      const statusChanges: NetworkStatus[] = [];
      service.subscribe((status) => {
        statusChanges.push(status);
      });

      // When: Network comes online
      mockNetInfoListener?.({
        isConnected: true,
        type: 'wifi' as NetInfoStateType,
      } as NetInfoState);

      // Then: Should notify subscribers of online state
      expect(statusChanges.length).toBeGreaterThan(0);
      const lastStatus = statusChanges[statusChanges.length - 1];
      expect(lastStatus.isConnected).toBe(true);
      expect(lastStatus.type).toBe('wifi');
    });

    it('should NOT notify if connectivity state unchanged', async () => {
      // Given: Service initialized with online state
      await service.initialize();

      const callback = jest.fn();
      service.subscribe(callback);

      // Clear initial callback (called on subscribe)
      callback.mockClear();

      // When: Network state changes but connectivity remains same (wifi → cellular)
      mockNetInfoListener?.({
        isConnected: true,
        type: 'cellular' as NetInfoStateType,
      } as NetInfoState);

      // Then: Should NOT notify (connectivity didn't change)
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Subscription Management', () => {
    it('should allow multiple subscribers', async () => {
      await service.initialize();

      const callback1 = jest.fn();
      const callback2 = jest.fn();

      service.subscribe(callback1);
      service.subscribe(callback2);

      // Clear initial callbacks
      callback1.mockClear();
      callback2.mockClear();

      // When: Network status changes
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Then: Both callbacks should be called
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should unsubscribe correctly', async () => {
      await service.initialize();

      const callback = jest.fn();
      const unsubscribe = service.subscribe(callback);

      // Unsubscribe
      unsubscribe();

      // Clear mock (initial callback on subscribe)
      callback.mockClear();

      // When: Network status changes
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Then: Callback should NOT be called
      expect(callback).not.toHaveBeenCalled();
    });

    it('should immediately notify new subscribers with current status', async () => {
      // Given: Service initialized with online state
      await service.initialize();

      const callback = jest.fn();

      // When: Subscribe
      service.subscribe(callback);

      // Then: Callback should be called immediately with current status
      expect(callback).toHaveBeenCalled();
      const calledStatus = callback.mock.calls[0][0];
      expect(calledStatus.isConnected).toBe(true);
    });

    it('should handle subscriber callback errors gracefully', async () => {
      await service.initialize();

      let callCount = 0;
      const errorCallback = jest.fn(() => {
        callCount++;
        // Only throw error on subsequent calls (not initial callback on subscribe)
        if (callCount > 1) {
          throw new Error('Subscriber error');
        }
      });
      const goodCallback = jest.fn();

      service.subscribe(errorCallback);
      service.subscribe(goodCallback);

      // Clear initial calls
      errorCallback.mockClear();
      goodCallback.mockClear();

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // When: Network status changes (will trigger error in errorCallback)
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Then: Good callback should still be called despite error in errorCallback
      expect(errorCallback).toHaveBeenCalled();
      expect(goodCallback).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Status Queries', () => {
    it('should return null before initialization', () => {
      // Given: Service not initialized
      const status = service.getCurrentStatus();

      // Then: Should return null
      expect(status).toBeNull();
    });

    it('should return current status after initialization', async () => {
      // Given: Service initialized
      await service.initialize();

      // When: Get current status
      const status = service.getCurrentStatus();

      // Then: Should return status
      expect(status).not.toBeNull();
      expect(status?.isConnected).toBe(true);
    });

    it('isOnline() should return true when connected', async () => {
      // Given: Online state
      await service.initialize();

      // When: Check if online
      const isOnline = service.isOnline();

      // Then: Should return true
      expect(isOnline).toBe(true);
    });

    it('isOnline() should return false when offline', async () => {
      // Given: Offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      });
      await service.initialize();

      // When: Check if online
      const isOnline = service.isOnline();

      // Then: Should return false
      expect(isOnline).toBe(false);
    });

    it('isOffline() should return true when offline', async () => {
      // Given: Offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      });
      await service.initialize();

      // When: Check if offline
      const isOffline = service.isOffline();

      // Then: Should return true
      expect(isOffline).toBe(true);
    });

    it('isOffline() should return false when online', async () => {
      // Given: Online state
      await service.initialize();

      // When: Check if offline
      const isOffline = service.isOffline();

      // Then: Should return false
      expect(isOffline).toBe(false);
    });
  });

  describe('Cleanup and Disposal', () => {
    it('should clean up NetInfo listener on dispose', async () => {
      // Given: Service initialized
      await service.initialize();
      const unsubscribeMock = (NetInfo.addEventListener as jest.Mock).mock.results[0].value;

      // When: Dispose
      service.dispose();

      // Then: Should unsubscribe from NetInfo
      expect(unsubscribeMock).toHaveBeenCalled();
    });

    it('should clear all subscribers on dispose', async () => {
      await service.initialize();

      const callback = jest.fn();
      service.subscribe(callback);

      // Dispose
      service.dispose();

      // Clear mock
      callback.mockClear();

      // When: Try to trigger network change (should not work)
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Then: Callback should NOT be called
      expect(callback).not.toHaveBeenCalled();
    });

    it('should reset current status on dispose', async () => {
      // Given: Service initialized
      await service.initialize();
      expect(service.getCurrentStatus()).not.toBeNull();

      // When: Dispose
      service.dispose();

      // Then: Current status should be null
      expect(service.getCurrentStatus()).toBeNull();
    });

    it('should handle dispose without initialization gracefully', () => {
      // When: Dispose without initialize
      const operation = () => service.dispose();

      // Then: Should not throw
      expect(operation).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle NetInfo returning null isConnected', async () => {
      // Given: NetInfo returns null for isConnected (edge case)
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: null,
        type: 'unknown' as NetInfoStateType,
      });

      // When: Initialize
      await service.initialize();

      // Then: Should default to false (offline)
      const status = service.getCurrentStatus();
      expect(status?.isConnected).toBe(false);
    });

    it('should handle rapid network status changes', async () => {
      await service.initialize();

      const statusChanges: NetworkStatus[] = [];
      service.subscribe((status) => {
        statusChanges.push(status);
      });

      // Clear initial callback
      statusChanges.length = 0;

      // Rapid changes: online → offline → online → offline
      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      mockNetInfoListener?.({
        isConnected: true,
        type: 'wifi' as NetInfoStateType,
      } as NetInfoState);

      mockNetInfoListener?.({
        isConnected: false,
        type: 'none' as NetInfoStateType,
      } as NetInfoState);

      // Should capture all connectivity changes
      expect(statusChanges.length).toBe(3);
      expect(statusChanges[0].isConnected).toBe(false);
      expect(statusChanges[1].isConnected).toBe(true);
      expect(statusChanges[2].isConnected).toBe(false);
    });
  });
});
