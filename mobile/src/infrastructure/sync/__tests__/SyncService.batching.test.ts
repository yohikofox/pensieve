/**
 * SyncService Batching Tests
 * Story 6.3 - Task 4.6: Tests for large dataset batching
 *
 * Tests TDD - Verify batching logic for PULL phase
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

describe('SyncService - Batching (Task 4)', () => {
  let syncService: SyncService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('Task 4.6: Large dataset batching (500 changes → 5 batches)', () => {
    it('should fetch data in batches of 100 when backend returns 500 changes', async () => {
      // ARRANGE - Mock 5 batches of 100 records each
      const batch1 = createBatchResponse(100, 1000);
      const batch2 = createBatchResponse(100, 1000);
      const batch3 = createBatchResponse(100, 1000);
      const batch4 = createBatchResponse(100, 1000);
      const batch5 = createBatchResponse(100, 1000); // Last batch still has 100

      // Mock fetch to return batches in sequence
      mockFetchWithRetry
        .mockResolvedValueOnce(createFetchResponse(batch1))
        .mockResolvedValueOnce(createFetchResponse(batch2))
        .mockResolvedValueOnce(createFetchResponse(batch3))
        .mockResolvedValueOnce(createFetchResponse(batch4))
        .mockResolvedValueOnce(createFetchResponse(batch5))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(0, 1000))); // Empty batch = end

      // ACT
      const result = await syncService.sync({ direction: 'pull' });

      // ASSERT
      expect(result.result).toBe('success');
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(6); // 5 full batches + 1 empty check

      // Verify offset progression: 0, 100, 200, 300, 400, 500
      const calls = mockFetchWithRetry.mock.calls;
      expect(calls[0][0]).toContain('offset=0');
      expect(calls[1][0]).toContain('offset=100');
      expect(calls[2][0]).toContain('offset=200');
      expect(calls[3][0]).toContain('offset=300');
      expect(calls[4][0]).toContain('offset=400');
      expect(calls[5][0]).toContain('offset=500');

      // Verify limit is always 100
      calls.forEach((call) => {
        expect(call[0]).toContain('limit=100');
      });
    });

    it('should update lastPulledAt after each batch success (Task 4.5)', async () => {
      // ARRANGE - 3 batches
      mockFetchWithRetry
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(100, 2000)))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(100, 2100)))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(50, 2200))); // Last batch < 100 = end

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - lastPulledAt updated 3 times (once per batch)
      expect(mockUpdateLastPulledAt).toHaveBeenCalledTimes(12); // 3 batches × 4 entities = 12 calls
      expect(mockUpdateLastPulledAt).toHaveBeenCalledWith('captures', 2000);
      expect(mockUpdateLastPulledAt).toHaveBeenCalledWith('captures', 2100);
      expect(mockUpdateLastPulledAt).toHaveBeenCalledWith('captures', 2200);
    });

    it('should stop fetching when batch returns fewer than 100 records', async () => {
      // ARRANGE - 2 full batches + 1 partial batch
      mockFetchWithRetry
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(100, 1000)))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(100, 1000)))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(30, 1000))); // Partial = last

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - Should NOT fetch batch 4
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(3);
    });

    it('should apply all records to database across batches', async () => {
      // ARRANGE - 2 batches
      mockFetchWithRetry
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(100, 1000)))
        .mockResolvedValueOnce(createFetchResponse(createBatchResponse(50, 1000)));

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - 150 total upserts (100 + 50)
      // Each record calls executeSync twice: SELECT (exists check) + INSERT/UPDATE
      const upsertCalls = mockDb.executeSync.mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE') || call[0].includes('INSERT')
      );
      expect(upsertCalls.length).toBe(150);
    });

    it('should handle empty first batch (no changes)', async () => {
      // ARRANGE - Empty response
      mockFetchWithRetry.mockResolvedValueOnce(createFetchResponse(createBatchResponse(0, 1000)));

      // ACT
      const result = await syncService.sync({ direction: 'pull' });

      // ASSERT
      expect(result.result).toBe('success');
      expect(mockFetchWithRetry).toHaveBeenCalledTimes(1);
      expect(mockUpdateLastPulledAt).not.toHaveBeenCalled(); // No changes = no update
    });
  });
});

/**
 * Helper: Create batch response with N records
 */
function createBatchResponse(count: number, timestamp: number) {
  const captures = [];
  for (let i = 0; i < count; i++) {
    captures.push({
      id: `capture-${i}`,
      type: 'audio',
      state: 'captured',
      raw_content: `/path/audio-${i}.m4a`,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  return {
    timestamp,
    changes: {
      captures: {
        updated: captures,
        deleted: [],
      },
    },
  };
}

/**
 * Helper: Create mock fetch response
 */
function createFetchResponse(data: any) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}
