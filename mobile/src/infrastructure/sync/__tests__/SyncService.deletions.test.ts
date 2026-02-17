/**
 * SyncService Deletion Propagation Tests
 * Story 6.3 - Task 5.5: Tests for soft delete sync
 *
 * Tests TDD - Verify deletion propagation across devices
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

describe('SyncService - Deletion Propagation (Task 5)', () => {
  let syncService: SyncService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database
    mockDb = {
      executeSync: jest.fn(),
      execute: jest.fn(),
    };

    // Mock executeSync to return empty rows for SELECT (record doesn't exist)
    mockDb.executeSync.mockImplementation((sql: string) => {
      if (sql.includes('SELECT')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue({
      getDatabase: () => mockDb,
    });

    // Mock storage
    mockGetLastPulledAt.mockResolvedValue(1000);
    mockUpdateLastPulledAt.mockResolvedValue(undefined);

    syncService = new SyncService('https://api.example.com');
    syncService.setAuthToken('test-token');
  });

  describe('Task 5.5: Delete on Device A → sync → Device B removes from UI', () => {
    it('should mark record as deleted when backend sends deletion', async () => {
      // ARRANGE - Backend sends a deleted capture
      const deletionResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [],
            deleted: [{ id: 'capture-123' }],
          },
        },
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletionResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - Should call UPDATE to mark as deleted
      const updateCalls = mockDb.executeSync.mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE') && call[0].includes('_status')
      );
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toContain("UPDATE captures SET _status = 'deleted'");
      expect(updateCalls[0][1]).toEqual(['capture-123']);
    });

    it('should handle multiple deletions in one sync', async () => {
      // ARRANGE - Backend sends multiple deleted captures
      const deletionResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [],
            deleted: [
              { id: 'capture-1' },
              { id: 'capture-2' },
              { id: 'capture-3' },
            ],
          },
        },
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletionResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - Should mark all 3 as deleted
      const updateCalls = mockDb.executeSync.mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE') && call[0].includes('_status')
      );
      expect(updateCalls.length).toBe(3);
    });

    it('should handle deletions across multiple entities', async () => {
      // ARRANGE - Backend sends deletions for multiple entity types
      const deletionResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [],
            deleted: [{ id: 'capture-1' }],
          },
          thoughts: {
            updated: [],
            deleted: [{ id: 'thought-1' }],
          },
          todos: {
            updated: [],
            deleted: [{ id: 'todo-1' }],
          },
        },
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletionResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - Should mark all 3 entities as deleted
      const updateCalls = mockDb.executeSync.mock.calls.filter(
        (call: any[]) => call[0].includes('UPDATE') && call[0].includes('_status')
      );
      expect(updateCalls.length).toBe(3);
      expect(updateCalls[0][0]).toContain('UPDATE captures');
      expect(updateCalls[1][0]).toContain('UPDATE thoughts');
      expect(updateCalls[2][0]).toContain('UPDATE todos');
    });

    it('should set _changed = 0 to prevent re-sync of deleted items', async () => {
      // ARRANGE
      const deletionResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [],
            deleted: [{ id: 'capture-123' }],
          },
        },
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletionResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - _changed should be set to 0
      const updateCall = mockDb.executeSync.mock.calls.find(
        (call: any[]) => call[0].includes('UPDATE') && call[0].includes('_status')
      );
      expect(updateCall![0]).toContain('_changed = 0');
    });

    it('should continue processing if one deletion fails', async () => {
      // ARRANGE - 3 deletions, 2nd one fails
      const deletionResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [],
            deleted: [
              { id: 'capture-1' },
              { id: 'capture-2' },
              { id: 'capture-3' },
            ],
          },
        },
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => deletionResponse,
      } as Response);

      // Mock executeSync to fail on 2nd deletion
      let callCount = 0;
      mockDb.executeSync.mockImplementation((sql: string) => {
        if (sql.includes('UPDATE') && sql.includes('_status')) {
          callCount++;
          if (callCount === 2) {
            throw new Error('Database error');
          }
        }
        return { rows: [] };
      });

      // ACT
      const result = await syncService.sync({ direction: 'pull' });

      // ASSERT - Should still succeed (errors are logged, not thrown)
      expect(result.result).toBe('success');
    });
  });
});
