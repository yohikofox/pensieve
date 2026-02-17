/**
 * SyncService Network Retry Tests
 * Story 6.3 - Task 6.5: Tests for network failure retry logic
 *
 * Tests TDD - Verify Fibonacci backoff retry
 */

import 'reflect-metadata';
import { SyncService } from '../SyncService';
import { fetchWithRetry } from '../../http/fetchWithRetry';
import { DatabaseConnection } from '../../../database';
import {
  getLastPulledAt,
  updateLastPulledAt,
} from '../SyncStorage';

// Mock dependencies
jest.mock('../../http/fetchWithRetry');
jest.mock('../../../database');
jest.mock('../SyncStorage');

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;
const mockGetLastPulledAt = getLastPulledAt as jest.MockedFunction<typeof getLastPulledAt>;
const mockUpdateLastPulledAt = updateLastPulledAt as jest.MockedFunction<typeof updateLastPulledAt>;

// Mock setTimeout to speed up tests
jest.useFakeTimers();

describe('SyncService - Network Error Retry (Task 6)', () => {
  let syncService: SyncService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Mock database
    mockDb = {
      executeSync: jest.fn().mockReturnValue({ rows: [] }),
      execute: jest.fn(),
    };

    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue({
      getDatabase: () => mockDb,
    });

    // Mock storage
    mockGetLastPulledAt.mockResolvedValue(1000);
    mockUpdateLastPulledAt.mockResolvedValue(undefined);

    syncService = new SyncService('https://api.example.com');
    syncService.setAuthToken('test-token');
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('Task 6.5: Network failure mid-sync → retry → eventual success', () => {
    it('should retry on network failure and eventually succeed', async () => {
      // ARRANGE - First 2 attempts fail, 3rd succeeds
      mockFetchWithRetry
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            timestamp: 2000,
            changes: { captures: { updated: [], deleted: [] } },
          }),
        } as Response);

      // ACT
      const syncPromise = syncService.sync({ direction: 'pull' });

      // Fast-forward through retry delays (1s, 1s)
      await jest.runAllTimersAsync();

      const result = await syncPromise;

      // ASSERT
      expect(result.result).toBe('success');
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });

    it('should preserve partially downloaded batches (Task 6.3)', async () => {
      // ARRANGE - Batch 1 succeeds, Batch 2 fails 2x then succeeds
      const batch1Response = {
        ok: true,
        status: 200,
        json: async () => ({
          timestamp: 2000,
          changes: {
            captures: {
              updated: Array(100).fill({ id: 'capture', created_at: 2000, updated_at: 2000 }),
              deleted: [],
            },
          },
        }),
      } as Response;

      const batch2Response = {
        ok: true,
        status: 200,
        json: async () => ({
          timestamp: 2100,
          changes: {
            captures: {
              updated: Array(50).fill({ id: 'capture', created_at: 2100, updated_at: 2100 }),
              deleted: [],
            },
          },
        }),
      } as Response;

      mockFetchWithRetry
        .mockResolvedValueOnce(batch1Response) // Batch 1 success
        .mockRejectedValueOnce(new Error('Network timeout')) // Batch 2 fail 1
        .mockRejectedValueOnce(new Error('Network timeout')) // Batch 2 fail 2
        .mockResolvedValueOnce(batch2Response); // Batch 2 success

      // ACT
      const syncPromise = syncService.sync({ direction: 'pull' });
      await jest.runAllTimersAsync();
      const result = await syncPromise;

      // ASSERT
      expect(result.result).toBe('success');

      // Verify lastPulledAt was updated after batch 1 (preserving partial progress)
      const updateCalls = mockUpdateLastPulledAt.mock.calls.filter(
        (call) => call[1] === 2000
      );
      expect(updateCalls.length).toBeGreaterThan(0); // Batch 1 preserved
    });

    it('should fail after max retries exceeded', async () => {
      // ARRANGE - All 10 attempts fail
      mockFetchWithRetry.mockRejectedValue(new Error('Network request failed'));

      // ACT
      const syncPromise = syncService.sync({ direction: 'pull' });
      await jest.runAllTimersAsync();

      const result = await syncPromise;

      // ASSERT
      expect(result.result).toBe('network_error');
      expect(result.retryable).toBe(true);
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(10); // Max attempts
    });

    it('should retry on 5xx server errors', async () => {
      // ARRANGE - 503 Service Unavailable → retry → success
      mockFetchWithRetry
        .mockRejectedValueOnce(new Error('HTTP 503: Service Unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            timestamp: 2000,
            changes: { captures: { updated: [], deleted: [] } },
          }),
        } as Response);

      // ACT
      const syncPromise = syncService.sync({ direction: 'pull' });
      await jest.runAllTimersAsync();
      const result = await syncPromise;

      // ASSERT
      expect(result.result).toBe('success');
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it('should retry all errors (conservative retry strategy)', async () => {
      // ARRANGE - Even 401 Unauthorized gets retried (conservative approach)
      mockFetchWithRetry
        .mockRejectedValueOnce(new Error('HTTP 401: Unauthorized'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            timestamp: 2000,
            changes: { captures: { updated: [], deleted: [] } },
          }),
        } as Response);

      // ACT
      const syncPromise = syncService.sync({ direction: 'pull' });
      await jest.runAllTimersAsync();
      const result = await syncPromise;

      // ASSERT - Conservative retry strategy retries all errors
      expect(result.result).toBe('success');
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(2); // 1 fail + 1 success
    });
  });
});
