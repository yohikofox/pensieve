/**
 * SyncService Conflict Resolution Tests
 * Story 6.3 - Task 7.6: Tests for PULL conflict resolution
 *
 * Tests TDD - Verify last-write-wins conflict resolution
 */

import 'reflect-metadata';
import { SyncService } from '../SyncService';
import { fetchWithRetry } from '../../http/fetchWithRetry';
import { DatabaseConnection } from '../../../database';
import { ConflictHandler } from '../ConflictHandler';
import {
  getLastPulledAt,
  updateLastPulledAt,
} from '../SyncStorage';

// Mock dependencies
jest.mock('../../http/fetchWithRetry');
jest.mock('../../../database');
jest.mock('../SyncStorage');
jest.mock('../ConflictHandler');

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;
const mockGetLastPulledAt = getLastPulledAt as jest.MockedFunction<typeof getLastPulledAt>;
const mockUpdateLastPulledAt = updateLastPulledAt as jest.MockedFunction<typeof updateLastPulledAt>;

describe('SyncService - Conflict Resolution (Task 7)', () => {
  let syncService: SyncService;
  let mockDb: any;
  let mockConflictHandler: jest.Mocked<ConflictHandler>;

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

    // Mock ConflictHandler
    mockConflictHandler = {
      applyConflicts: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock getConflictHandler to return our mock
    const ConflictHandlerModule = require('../ConflictHandler');
    ConflictHandlerModule.getConflictHandler = jest.fn().mockReturnValue(mockConflictHandler);

    // Mock storage
    mockGetLastPulledAt.mockResolvedValue(1000);
    mockUpdateLastPulledAt.mockResolvedValue(undefined);

    syncService = new SyncService('https://api.example.com');
    syncService.setAuthToken('test-token');
  });

  describe('Task 7.6: Device A offline modifie → Device B modifie → A pull → server wins', () => {
    it('should apply conflict resolution when server detects conflict', async () => {
      // ARRANGE - Server returns conflict (both devices modified same record)
      const conflictResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [
              {
                id: 'capture-123',
                type: 'audio',
                state: 'captured',
                raw_content: '/server/version.m4a', // Server version
                created_at: 2000,
                updated_at: 2000,
              },
            ],
            deleted: [],
          },
        },
        conflicts: [
          {
            entity: 'captures',
            record_id: 'capture-123',
            conflict_type: 'concurrent_modification',
            resolution: 'server_wins',
            serverVersion: {
              id: 'capture-123',
              type: 'audio',
              state: 'captured',
              raw_content: '/server/version.m4a',
              created_at: 2000,
              updated_at: 2000,
            },
          },
        ],
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => conflictResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - ConflictHandler.applyConflicts should be called
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledTimes(1);
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledWith([
        {
          entity: 'captures',
          record_id: 'capture-123',
          conflict_type: 'concurrent_modification',
          resolution: 'server_wins',
          serverVersion: expect.objectContaining({
            id: 'capture-123',
            raw_content: '/server/version.m4a',
          }),
        },
      ]);
    });

    it('should apply multiple conflicts from one batch', async () => {
      // ARRANGE - Multiple conflicts in one response
      const conflictResponse = {
        timestamp: 2000,
        changes: { captures: { updated: [], deleted: [] } },
        conflicts: [
          {
            entity: 'captures',
            record_id: 'capture-1',
            resolution: 'server_wins',
            serverVersion: { id: 'capture-1' },
          },
          {
            entity: 'todos',
            record_id: 'todo-1',
            resolution: 'server_wins',
            serverVersion: { id: 'todo-1' },
          },
          {
            entity: 'thoughts',
            record_id: 'thought-1',
            resolution: 'client_wins', // Local version kept
            serverVersion: null,
          },
        ],
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => conflictResponse,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledTimes(1);
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ record_id: 'capture-1' }),
          expect.objectContaining({ record_id: 'todo-1' }),
          expect.objectContaining({ record_id: 'thought-1' }),
        ])
      );
    });

    it('should aggregate conflicts from multiple batches', async () => {
      // ARRANGE - Batch 1 has 2 conflicts, Batch 2 has 1 conflict
      const batch1 = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: Array(100).fill({ id: 'capture', created_at: 2000, updated_at: 2000 }),
            deleted: [],
          },
        },
        conflicts: [
          { entity: 'captures', record_id: 'conflict-1', resolution: 'server_wins', serverVersion: {} },
          { entity: 'captures', record_id: 'conflict-2', resolution: 'server_wins', serverVersion: {} },
        ],
      };

      const batch2 = {
        timestamp: 2100,
        changes: {
          captures: {
            updated: Array(50).fill({ id: 'capture', created_at: 2100, updated_at: 2100 }),
            deleted: [],
          },
        },
        conflicts: [
          { entity: 'todos', record_id: 'conflict-3', resolution: 'server_wins', serverVersion: {} },
        ],
      };

      mockFetchWithRetry
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => batch1 } as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => batch2 } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - Should apply all 3 conflicts (2 from batch 1 + 1 from batch 2)
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledTimes(1);
      expect(mockConflictHandler.applyConflicts).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ record_id: 'conflict-1' }),
          expect.objectContaining({ record_id: 'conflict-2' }),
          expect.objectContaining({ record_id: 'conflict-3' }),
        ])
      );
    });

    it('should handle PULL with no conflicts', async () => {
      // ARRANGE - No conflicts
      const response = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [{ id: 'capture-123', created_at: 2000, updated_at: 2000 }],
            deleted: [],
          },
        },
        conflicts: [], // Empty conflicts array
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => response,
      } as Response);

      // ACT
      await syncService.sync({ direction: 'pull' });

      // ASSERT - ConflictHandler should NOT be called
      expect(mockConflictHandler.applyConflicts).not.toHaveBeenCalled();
    });

    it('should continue sync even if conflict resolution fails', async () => {
      // ARRANGE - Conflict resolution throws error
      const conflictResponse = {
        timestamp: 2000,
        changes: {
          captures: {
            updated: [{ id: 'capture-123', created_at: 2000, updated_at: 2000 }],
            deleted: [],
          },
        },
        conflicts: [
          {
            entity: 'captures',
            record_id: 'capture-123',
            resolution: 'server_wins',
            serverVersion: { id: 'capture-123' },
          },
        ],
      };

      mockFetchWithRetry.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => conflictResponse,
      } as Response);

      mockConflictHandler.applyConflicts.mockRejectedValueOnce(new Error('Conflict resolution failed'));

      // ACT
      const result = await syncService.sync({ direction: 'pull' });

      // ASSERT - Sync should still succeed (errors are logged)
      expect(result.result).toBe('success');
    });
  });
});
