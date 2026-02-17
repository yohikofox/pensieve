/**
 * InitialSyncService Unit Tests
 * Story 6.3 - Task 1: Initial Full Sync on First Login
 *
 * Tests TDD - RED phase first
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { InitialSyncService } from '../InitialSyncService';
import { SyncService } from '../SyncService';
import { DatabaseConnection } from '../../../database';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('../SyncService');
jest.mock('../../../database');

describe('InitialSyncService', () => {
  let initialSyncService: InitialSyncService;
  let mockSyncService: jest.Mocked<SyncService>;

  beforeEach(() => {
    jest.clearAllMocks();

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
    it('should return true when no lastPulledAt exists in AsyncStorage', async () => {
      // ARRANGE - Simulate first login (no lastPulledAt)
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // ACT
      const isFirstLogin = await initialSyncService.isFirstSync();

      // ASSERT
      expect(isFirstLogin).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('sync_last_pulled_captures');
    });

    it('should return false when lastPulledAt exists', async () => {
      // ARRANGE - Simulate existing user (has lastPulledAt)
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1736760600000');

      // ACT
      const isFirstLogin = await initialSyncService.isFirstSync();

      // ASSERT
      expect(isFirstLogin).toBe(false);
    });

    it('should check captures entity for first sync detection', async () => {
      // ARRANGE
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // ACT
      await initialSyncService.isFirstSync();

      // ASSERT
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('sync_last_pulled_captures');
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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); // First sync

      // ACT
      await initialSyncService.performInitialSync('test-token', onProgress);

      // ASSERT - Progress should be called multiple times
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress.mock.calls.length).toBeGreaterThan(1);
    });

    it('should report 100% when sync completes', async () => {
      // ARRANGE
      const onProgress = jest.fn();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      mockSyncService.sync.mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp: 1736760900000, // Required for success path
      });

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT
      expect(mockSyncService.sync).toHaveBeenCalledWith({ forceFull: true });
    });

    it('should set auth token before syncing', async () => {
      // ARRANGE
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // ACT
      await initialSyncService.performInitialSync('my-jwt-token');

      // ASSERT
      expect(mockSyncService.setAuthToken).toHaveBeenCalledWith('my-jwt-token');
    });
  });

  describe('Task 1.7: Set lastPulledAt after success', () => {
    it('should set lastPulledAt timestamp after successful sync', async () => {
      // ARRANGE
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      mockSyncService.sync.mockResolvedValue({
        result: 'success',
        retryable: false,
        timestamp: 1736760900000,
      });

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT - lastPulledAt should be updated for all entities
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'sync_last_pulled_captures',
        '1736760900000'
      );
    });

    it('should NOT set lastPulledAt if sync fails', async () => {
      // ARRANGE
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
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
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Task 1.5: Download all entities', () => {
    it('should sync all entities: captures, thoughts, ideas, todos', async () => {
      // ARRANGE
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      // ACT
      await initialSyncService.performInitialSync('test-token');

      // ASSERT - forceFull should trigger all entities sync
      expect(mockSyncService.sync).toHaveBeenCalledWith({ forceFull: true });
    });
  });
});
