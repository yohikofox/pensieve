import 'reflect-metadata';

// Mock DatabaseConnection BEFORE SyncService import
jest.mock('../../../database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => ({
        executeSync: jest.fn(),
      })),
    })),
  },
}));

import { SyncTrigger } from '../SyncTrigger';
import { SyncService } from '../SyncService';
import { SyncResult } from '../types';

// Mock SyncService
jest.mock('../SyncService');

describe('SyncTrigger', () => {
  let syncTrigger: SyncTrigger;
  let mockSyncService: jest.Mocked<SyncService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockSyncService = new SyncService('http://localhost:3000') as jest.Mocked<SyncService>;
    mockSyncService.sync = jest.fn().mockResolvedValue({
      result: SyncResult.SUCCESS,
      retryable: false,
    });

    syncTrigger = new SyncTrigger(mockSyncService, 3000); // 3s debounce
  });

  afterEach(() => {
    syncTrigger.cleanup();
    jest.useRealTimers();
  });

  describe('queueSync() - AC3 debounce 3 seconds', () => {
    it('should trigger sync after 3 seconds debounce', async () => {
      syncTrigger.queueSync();

      // Should NOT sync immediately
      expect(mockSyncService.sync).not.toHaveBeenCalled();

      // Fast-forward 2 seconds (not enough)
      jest.advanceTimersByTime(2000);
      expect(mockSyncService.sync).not.toHaveBeenCalled();

      // Fast-forward remaining 1 second (total 3s)
      jest.advanceTimersByTime(1000);

      // Give promises time to resolve
      await Promise.resolve();

      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'normal',
        entity: undefined,
      });
    });

    it('should coalesce multiple rapid changes into single sync', async () => {
      // Trigger sync 5 times rapidly
      syncTrigger.queueSync();
      jest.advanceTimersByTime(500);
      syncTrigger.queueSync();
      jest.advanceTimersByTime(500);
      syncTrigger.queueSync();
      jest.advanceTimersByTime(500);
      syncTrigger.queueSync();
      jest.advanceTimersByTime(500);
      syncTrigger.queueSync();

      // Fast-forward to complete debounce (from last call)
      jest.advanceTimersByTime(3000);

      await Promise.resolve();

      // Should have synced only ONCE (not 5 times)
      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });

    it('should pass entity option to sync', async () => {
      syncTrigger.queueSync({ entity: 'captures' });

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'normal',
        entity: 'captures',
      });
    });

    it('should pass priority option to sync', async () => {
      syncTrigger.queueSync({ priority: 'high' });

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'high',
        entity: undefined,
      });
    });

    it('should not block when sync fails (fire and forget)', async () => {
      mockSyncService.sync.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      syncTrigger.queueSync();

      jest.advanceTimersByTime(3000);

      // Wait for promises to resolve/reject
      await Promise.resolve();
      await Promise.resolve(); // Extra tick for promise chain

      // Should have attempted sync
      expect(mockSyncService.sync).toHaveBeenCalled();

      // Error logged but not thrown
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Background sync failed'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('syncNow() - immediate sync', () => {
    it('should trigger sync immediately without debounce', async () => {
      await syncTrigger.syncNow();

      // Should sync immediately (no timer needed)
      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });

    it('should cancel pending debounced sync when called', async () => {
      // Queue a debounced sync
      syncTrigger.queueSync();

      // Before debounce completes, trigger syncNow
      await syncTrigger.syncNow();

      // Fast-forward past debounce time
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Should have synced only ONCE (syncNow), not twice
      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });

    it('should pass options to sync', async () => {
      await syncTrigger.syncNow({ entity: 'todos', priority: 'high' });

      expect(mockSyncService.sync).toHaveBeenCalledWith({
        priority: 'high',
        entity: 'todos',
      });
    });
  });

  describe('setEnabled() - enable/disable trigger', () => {
    it('should not trigger sync when disabled', async () => {
      syncTrigger.setEnabled(false);

      syncTrigger.queueSync();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });

    it('should cancel pending sync when disabled', async () => {
      // Queue sync
      syncTrigger.queueSync();

      // Disable before debounce completes
      syncTrigger.setEnabled(false);

      // Fast-forward
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });

    it('should resume syncing when re-enabled', async () => {
      syncTrigger.setEnabled(false);
      syncTrigger.queueSync(); // No-op

      syncTrigger.setEnabled(true);
      syncTrigger.queueSync(); // Should work

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(mockSyncService.sync).toHaveBeenCalledTimes(1);
    });

    it('syncNow should also respect enabled flag', async () => {
      syncTrigger.setEnabled(false);

      await syncTrigger.syncNow();

      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });
  });

  describe('cleanup()', () => {
    it('should cancel pending sync', async () => {
      syncTrigger.queueSync();

      syncTrigger.cleanup();

      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(mockSyncService.sync).not.toHaveBeenCalled();
    });
  });

  describe('Background sync (AC3 non-blocking)', () => {
    it('should not await sync completion (fire and forget)', async () => {
      // Make sync take 5 seconds to complete
      mockSyncService.sync.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  result: SyncResult.SUCCESS,
                  retryable: false,
                }),
              5000,
            );
          }),
      );

      syncTrigger.queueSync();

      // Fast-forward debounce
      jest.advanceTimersByTime(3000);

      // executeSync should return immediately (not wait 5s)
      // The sync continues in background

      // Sync should have been called
      expect(mockSyncService.sync).toHaveBeenCalled();

      // But we don't wait for it to complete
      // (in real code, execution continues without blocking)
    });
  });
});
