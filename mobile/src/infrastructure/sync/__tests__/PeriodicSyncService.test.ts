/**
 * PeriodicSyncService Unit Tests
 * Story 6.3 - Task 3: Real-Time Sync Between Devices
 *
 * Tests TDD - RED phase first
 */

import { PeriodicSyncService } from '../PeriodicSyncService';
import { SyncService } from '../SyncService';
import { NetworkMonitor } from '../../network/NetworkMonitor';

// Mock dependencies
jest.mock('../SyncService');
jest.mock('../../network/NetworkMonitor');

// Mock timers
jest.useFakeTimers();

describe('PeriodicSyncService', () => {
  let periodicSync: PeriodicSyncService;
  let mockSyncService: jest.Mocked<SyncService>;
  let mockNetworkMonitor: jest.Mocked<NetworkMonitor>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Mock SyncService
    mockSyncService = {
      sync: jest.fn().mockResolvedValue({
        result: 'success',
        retryable: false,
      }),
    } as any;

    // Mock NetworkMonitor (getCurrentState is the public async method)
    mockNetworkMonitor = {
      getCurrentState: jest.fn().mockResolvedValue(true),
    } as any;

    periodicSync = new PeriodicSyncService(mockSyncService, mockNetworkMonitor);
  });

  afterEach(() => {
    periodicSync.stop();
  });

  describe('Task 3.2: Start periodic sync (15min interval)', () => {
    it('should start interval when start() is called', () => {
      // ACT
      periodicSync.start();

      // ASSERT - Timer should be active
      expect(periodicSync.isRunning()).toBe(true);
    });

    it('should NOT start if already running', async () => {
      // ARRANGE
      periodicSync.start();
      const firstCallCount = mockSyncService.sync.mock.calls.length;

      // ACT - Try to start again
      periodicSync.start();

      // Fast-forward 15 minutes
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState promise

      // ASSERT - Should not double-sync
      expect(mockSyncService.sync).toHaveBeenCalledTimes(firstCallCount + 1); // Only one more call
    });

    it('should trigger sync every 15 minutes', async () => {
      // ARRANGE
      periodicSync.start();

      // ACT - Fast-forward 45 minutes (3 intervals)
      jest.advanceTimersByTime(45 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState promises (3 concurrent)

      // ASSERT - Sync called 3 times (after 15min, 30min, 45min)
      expect(mockSyncService.sync).toHaveBeenCalledTimes(3);
    });

    it('should pass priority "low" to sync', async () => {
      // ARRANGE
      periodicSync.start();

      // ACT
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState promise

      // ASSERT
      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'low',
        source: 'periodic',
      });
    });
  });

  describe('Task 3.3: Only sync when app is active and online', () => {
    it('should NOT sync when network is offline', async () => {
      // ARRANGE - Network offline
      mockNetworkMonitor.getCurrentState.mockResolvedValue(false);
      periodicSync.start();

      // ACT
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState promise

      // ASSERT - Sync NOT called
      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });

    it('should resume sync when network comes back online', async () => {
      // ARRANGE - Start offline
      mockNetworkMonitor.getCurrentState.mockResolvedValue(false);
      periodicSync.start();
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();

      expect(mockSyncService.sync).not.toHaveBeenCalled();

      // ACT - Network comes back online
      mockNetworkMonitor.getCurrentState.mockResolvedValue(true);
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve();

      // ASSERT - Sync called after network recovery
      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task 3.2: Stop periodic sync', () => {
    it('should stop interval when stop() is called', () => {
      // ARRANGE
      periodicSync.start();

      // ACT
      periodicSync.stop();

      // Advance time
      jest.advanceTimersByTime(15 * 60 * 1000);

      // ASSERT - Sync NOT called after stop
      expect(mockSyncService.sync).not.toHaveBeenCalled();
      expect(periodicSync.isRunning()).toBe(false);
    });

    it('should be safe to call stop() multiple times', () => {
      // ARRANGE
      periodicSync.start();

      // ACT
      periodicSync.stop();
      periodicSync.stop(); // Call again

      // ASSERT - No error
      expect(periodicSync.isRunning()).toBe(false);
    });

    it('should be safe to call stop() when not running', () => {
      // ACT
      periodicSync.stop();

      // ASSERT - No error
      expect(periodicSync.isRunning()).toBe(false);
    });
  });

  describe('Task 3.6: Error handling', () => {
    it('should continue periodic sync even if one sync fails', async () => {
      // ARRANGE - First sync fails, second succeeds
      mockSyncService.sync
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          result: 'success',
          retryable: false,
        });

      periodicSync.start();

      // ACT - Advance 30 minutes (2 syncs)
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState + sync attempt 1
      jest.advanceTimersByTime(15 * 60 * 1000);
      await Promise.resolve(); // Flush getCurrentState + sync attempt 2

      // ASSERT - Both syncs attempted
      expect(mockSyncService.sync).toHaveBeenCalledTimes(2);
    });
  });
});
