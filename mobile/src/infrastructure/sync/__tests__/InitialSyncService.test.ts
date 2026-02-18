/**
 * InitialSyncService Unit Tests
 * Story 6.3 - Task 1: Initial Full Sync on First Login
 *
 * ADR-022: sync metadata now stored in OP-SQLite via SyncStorage, NOT AsyncStorage.
 * Updated by Story 14.2 (AsyncStorage audit).
 */

import { InitialSyncService } from '../InitialSyncService';
import { SyncService } from '../SyncService';
import { DatabaseConnection } from '../../../database';

// Mock SyncStorage (OP-SQLite layer) instead of AsyncStorage
jest.mock('../SyncStorage', () => ({
  getLastPulledAt: jest.fn(),
  updateLastPulledAt: jest.fn(),
}));

jest.mock('../SyncService');
jest.mock('../../../database');

import * as SyncStorage from '../SyncStorage';

describe('InitialSyncService', () => {
  let initialSyncService: InitialSyncService;
  let mockSyncService: jest.Mocked<SyncService>;
  const mockGetLastPulledAt = SyncStorage.getLastPulledAt as jest.Mock;
  const mockUpdateLastPulledAt = SyncStorage.updateLastPulledAt as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no prior sync (first sync)
    mockGetLastPulledAt.mockResolvedValue(0);
    mockUpdateLastPulledAt.mockResolvedValue(undefined);

    // Mock SyncService with default success response
    mockSyncService = {
      setAuthToken: jest.fn(),
      sync: jest.fn().mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp: 1736760900000,
      }),
    } as any;

    initialSyncService = new InitialSyncService(
      'https://api.example.com',
      mockSyncService
    );
  });

  describe('Task 1.1: Detect first login', () => {
    it('should return true when no lastPulledAt exists in OP-SQLite (value = 0)', async () => {
      // ARRANGE - Simulate first login (no lastPulledAt)
      mockGetLastPulledAt.mockResolvedValue(0);

      // ACT
      const isFirstLogin = await initialSyncService.isFirstSync();

      // ASSERT
      expect(isFirstLogin).toBe(true);
      expect(mockGetLastPulledAt).toHaveBeenCalledWith('captures');
    });

    it('should return false when lastPulledAt exists (value > 0)', async () => {
      // ARRANGE - Simulate existing user (has lastPulledAt)
      mockGetLastPulledAt.mockResolvedValue(1736760600000);

      // ACT
      const isFirstLogin = await initialSyncService.isFirstSync();

      // ASSERT
      expect(isFirstLogin).toBe(false);
    });

    it('should check captures entity for first sync detection', async () => {
      // ARRANGE
      mockGetLastPulledAt.mockResolvedValue(0);

      // ACT
      await initialSyncService.isFirstSync();

      // ASSERT
      expect(mockGetLastPulledAt).toHaveBeenCalledWith('captures');
    });
  });

  describe('Task 1.3: Progress tracking', () => {
    it('should initialize progress at 0%', async () => {
      // ARRANGE
      const onProgress = jest.fn();

      // ACT
      await initialSyncService.performInitialSync('test-token', onProgress);

      // ASSERT - First progress update should be 0%
      expect(onProgress).toHaveBeenNthCalledWith(1, 0);
    });

    it('should report progress during sync', async () => {
      // ARRANGE
      const onProgress = jest.fn();

      // ACT
      await initialSyncService.performInitialSync('test-token', onProgress);

      // ASSERT - Progress should be called multiple times
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls.length).toBeGreaterThan(1);
    });

    it('should report 100% when sync completes', async () => {
      // ARRANGE
      const onProgress = jest.fn();

      // ACT
      await initialSyncService.performInitialSync('test-token', onProgress);

      // ASSERT - Last call should be 100%
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(100);
    });
  });

  describe('Task 1.2: Trigger full sync automatically', () => {
    it('should call SyncService.sync with forceFull option', async () => {
      // ARRANGE
      mockSyncService.sync.mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp: 1736760900000,
      });

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT
      expect(mockSyncService.sync).toHaveBeenCalledWith({ forceFull: true });
    });

    it('should set auth token before syncing', async () => {
      // ACT
      await initialSyncService.performInitialSync('my-jwt-token');

      // ASSERT
      expect(mockSyncService.setAuthToken).toHaveBeenCalledWith('my-jwt-token');
    });
  });

  describe('Task 1.7: Set lastPulledAt after success (OP-SQLite via SyncStorage)', () => {
    it('should update lastPulledAt via updateLastPulledAt after successful sync', async () => {
      // ARRANGE
      mockSyncService.sync.mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp: 1736760900000,
      });

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT - lastPulledAt should be updated for captures entity (and others)
      expect(mockUpdateLastPulledAt).toHaveBeenCalledWith('captures', 1736760900000);
    });

    it('should NOT set lastPulledAt if sync fails', async () => {
      // ARRANGE
      mockSyncService.sync.mockResolvedValue({
        result: 'network_error',
        retryable: true,
        error: 'Network timeout',
      });

      // ACT
      try {
        await initialSyncService.performInitialSync('test-token');
      } catch (error) {
        // Expected error when sync fails
      }

      // ASSERT - lastPulledAt should NOT be set on failure
      expect(mockUpdateLastPulledAt).not.toHaveBeenCalled();
    });
  });

  describe('Task 1.5: Download all entities', () => {
    it('should sync all entities: captures, thoughts, ideas, todos', async () => {
      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT - forceFull should trigger all entities sync
      expect(mockSyncService.sync).toHaveBeenCalledWith({ forceFull: true });
    });

    it('should update lastPulledAt for all entities after successful sync', async () => {
      // ARRANGE
      const timestamp = 1736760900000;
      mockSyncService.sync.mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp,
      });

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT - all 4 entities should be updated
      const entities = ['captures', 'thoughts', 'ideas', 'todos'];
      entities.forEach((entity) => {
        expect(mockUpdateLastPulledAt).toHaveBeenCalledWith(entity, timestamp);
      });
      expect(mockUpdateLastPulledAt).toHaveBeenCalledTimes(entities.length);
    });
  });
});
