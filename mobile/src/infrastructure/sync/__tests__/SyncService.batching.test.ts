import 'reflect-metadata';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// IMPORTANT: Mock axios.create BEFORE importing SyncService
jest.spyOn(axios, 'create').mockReturnValue(axios as any);

import { SyncService } from '../SyncService';
import { SyncResult } from '../types';
import { DatabaseConnection } from '../../../database';

// Mock database
const mockDB = {
  executeSync: jest.fn(),
};

jest.mock('../../../database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => mockDB),
    })),
  },
}));

// Mock SyncStorage
jest.mock('../SyncStorage', () => ({
  getLastPulledAt: jest.fn().mockResolvedValue(0),
  updateLastPulledAt: jest.fn().mockResolvedValue(undefined),
  updateLastPushedAt: jest.fn().mockResolvedValue(undefined),
  updateSyncStatus: jest.fn().mockResolvedValue(undefined),
}));

// Mock ConflictHandler
jest.mock('../ConflictHandler', () => ({
  getConflictHandler: jest.fn(() => ({
    applyConflicts: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('SyncService - Batching (Task 2.5, 2.6)', () => {
  let syncService: SyncService;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();

    syncService = new SyncService('http://localhost:3000');
    syncService.setAuthToken('test-token');

    mockAxios = new MockAdapter(axios);
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('Task 2.6: Batching scenario - 250 records → 3 batches', () => {
    it('should send 250 changed records in 3 batches (100 + 100 + 50)', async () => {
      // Mock PULL response (empty - no server changes)
      mockAxios.onGet('/api/sync/pull').reply(200, {
        changes: {},
        timestamp: Date.now(),
      });

      // Mock PUSH responses (3 batches)
      mockAxios.onPost('/api/sync/push').reply(200, {
        conflicts: [],
      });

      // Simulate 250 changed records in captures table
      let callCount = 0;
      mockDB.executeSync.mockImplementation((query: string) => {
        // Detect if this is a SELECT query for changed records
        if (query.includes('SELECT * FROM captures WHERE _changed = 1')) {
          callCount++;

          if (callCount === 1) {
            // Batch 1: 100 records
            return {
              rows: {
                _array: Array.from({ length: 100 }, (_, i) => ({
                  id: `capture-${i}`,
                  raw_content: `Content ${i}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 100,
              },
            };
          } else if (callCount === 2) {
            // Batch 2: 100 records
            return {
              rows: {
                _array: Array.from({ length: 100 }, (_, i) => ({
                  id: `capture-${i + 100}`,
                  raw_content: `Content ${i + 100}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 100,
              },
            };
          } else if (callCount === 3) {
            // Batch 3: 50 records
            return {
              rows: {
                _array: Array.from({ length: 50 }, (_, i) => ({
                  id: `capture-${i + 200}`,
                  raw_content: `Content ${i + 200}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 50,
              },
            };
          } else {
            // No more changes
            return { rows: { _array: [], length: 0 } };
          }
        }

        // Detect if this is an UPDATE query to mark records as synced
        if (query.includes('UPDATE captures SET _changed = 0')) {
          return { rows: { _array: [], length: 0 } };
        }

        // Other queries (thoughts, ideas, todos)
        return { rows: { _array: [], length: 0 } };
      });

      // Execute sync
      const result = await syncService.sync();

      // Assertions
      expect(result.result).toBe(SyncResult.SUCCESS);

      // Should have made 3 PUSH requests (one per batch)
      const pushRequests = mockAxios.history.post.filter((req) =>
        req.url?.includes('/api/sync/push'),
      );
      expect(pushRequests).toHaveLength(3);

      // Verify batch sizes
      const batch1 = JSON.parse(pushRequests[0].data);
      const batch2 = JSON.parse(pushRequests[1].data);
      const batch3 = JSON.parse(pushRequests[2].data);

      expect(batch1.changes.captures.updated).toHaveLength(100);
      expect(batch2.changes.captures.updated).toHaveLength(100);
      expect(batch3.changes.captures.updated).toHaveLength(50);

      // Verify all 250 records were pushed
      const allPushedIds = [
        ...batch1.changes.captures.updated.map((r: any) => r.id),
        ...batch2.changes.captures.updated.map((r: any) => r.id),
        ...batch3.changes.captures.updated.map((r: any) => r.id),
      ];
      expect(allPushedIds).toHaveLength(250);
      expect(new Set(allPushedIds).size).toBe(250); // All unique
    });

    it('should stop batching when no more changes exist', async () => {
      // Mock PULL response
      mockAxios.onGet('/api/sync/pull').reply(200, {
        changes: {},
        timestamp: Date.now(),
      });

      // Mock PUSH responses
      mockAxios.onPost('/api/sync/push').reply(200, {
        conflicts: [],
      });

      // Simulate exactly 100 changed records (1 batch only)
      let callCount = 0;
      mockDB.executeSync.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM captures WHERE _changed = 1')) {
          callCount++;

          if (callCount === 1) {
            // Batch 1: 100 records
            return {
              rows: {
                _array: Array.from({ length: 100 }, (_, i) => ({
                  id: `capture-${i}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 100,
              },
            };
          } else {
            // No more changes
            return { rows: { _array: [], length: 0 } };
          }
        }

        if (query.includes('UPDATE captures SET _changed = 0')) {
          return { rows: { _array: [], length: 0 } };
        }

        return { rows: { _array: [], length: 0 } };
      });

      const result = await syncService.sync();

      expect(result.result).toBe(SyncResult.SUCCESS);

      // Should have made only 1 PUSH request (batch not full, so no more batches)
      const pushRequests = mockAxios.history.post.filter((req) =>
        req.url?.includes('/api/sync/push'),
      );
      expect(pushRequests).toHaveLength(1);
    });

    it('should collect conflicts from all batches', async () => {
      // Mock PULL response
      mockAxios.onGet('/api/sync/pull').reply(200, {
        changes: {},
        timestamp: Date.now(),
      });

      // Mock PUSH responses with conflicts in batch 1 and 3
      let pushCount = 0;
      mockAxios.onPost('/api/sync/push').reply(() => {
        pushCount++;

        if (pushCount === 1) {
          // Batch 1: 2 conflicts
          return [
            200,
            {
              conflicts: [
                { entity: 'captures', id: 'cap-1', serverVersion: {} },
                { entity: 'captures', id: 'cap-2', serverVersion: {} },
              ],
            },
          ];
        } else if (pushCount === 2) {
          // Batch 2: no conflicts
          return [200, { conflicts: [] }];
        } else {
          // Batch 3: 1 conflict
          return [
            200,
            {
              conflicts: [
                { entity: 'captures', id: 'cap-150', serverVersion: {} },
              ],
            },
          ];
        }
      });

      // Simulate 250 changed records (3 batches: 100 + 100 + 50)
      let callCount = 0;
      mockDB.executeSync.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM captures WHERE _changed = 1')) {
          callCount++;

          if (callCount === 1) {
            // Batch 1: 100 records
            return {
              rows: {
                _array: Array.from({ length: 100 }, (_, i) => ({
                  id: `capture-${i}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 100,
              },
            };
          } else if (callCount === 2) {
            // Batch 2: 100 records
            return {
              rows: {
                _array: Array.from({ length: 100 }, (_, i) => ({
                  id: `capture-${i + 100}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 100,
              },
            };
          } else if (callCount === 3) {
            // Batch 3: 50 records
            return {
              rows: {
                _array: Array.from({ length: 50 }, (_, i) => ({
                  id: `capture-${i + 200}`,
                  _status: 'active',
                  _changed: 1,
                })),
                length: 50,
              },
            };
          } else {
            return { rows: { _array: [], length: 0 } };
          }
        }

        if (query.includes('UPDATE captures SET _changed = 0')) {
          return { rows: { _array: [], length: 0 } };
        }

        return { rows: { _array: [], length: 0 } };
      });

      const result = await syncService.sync();

      expect(result.result).toBe(SyncResult.SUCCESS);

      // Should have collected all 3 conflicts from all batches
      expect(result.conflicts).toHaveLength(3);
      expect(result.conflicts).toEqual([
        { entity: 'captures', id: 'cap-1', serverVersion: {} },
        { entity: 'captures', id: 'cap-2', serverVersion: {} },
        { entity: 'captures', id: 'cap-150', serverVersion: {} },
      ]);
    });
  });

  describe('Task 2.4: Soft deletes in payload', () => {
    it('should include deleted records in PUSH payload', async () => {
      // Mock PULL response
      mockAxios.onGet('/api/sync/pull').reply(200, {
        changes: {},
        timestamp: Date.now(),
      });

      // Mock PUSH response
      mockAxios.onPost('/api/sync/push').reply(200, {
        conflicts: [],
      });

      // Simulate mixed records: 5 updated + 3 deleted
      mockDB.executeSync.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM captures WHERE _changed = 1')) {
          return {
            rows: {
              _array: [
                // Updated records
                {
                  id: 'cap-1',
                  raw_content: 'Content 1',
                  _status: 'active',
                  _changed: 1,
                },
                {
                  id: 'cap-2',
                  raw_content: 'Content 2',
                  _status: 'active',
                  _changed: 1,
                },
                {
                  id: 'cap-3',
                  raw_content: 'Content 3',
                  _status: 'active',
                  _changed: 1,
                },
                {
                  id: 'cap-4',
                  raw_content: 'Content 4',
                  _status: 'active',
                  _changed: 1,
                },
                {
                  id: 'cap-5',
                  raw_content: 'Content 5',
                  _status: 'active',
                  _changed: 1,
                },
                // Deleted records
                {
                  id: 'cap-deleted-1',
                  raw_content: 'Deleted 1',
                  _status: 'deleted',
                  _changed: 1,
                },
                {
                  id: 'cap-deleted-2',
                  raw_content: 'Deleted 2',
                  _status: 'deleted',
                  _changed: 1,
                },
                {
                  id: 'cap-deleted-3',
                  raw_content: 'Deleted 3',
                  _status: 'deleted',
                  _changed: 1,
                },
              ],
              length: 8,
            },
          };
        }

        if (query.includes('UPDATE captures SET _changed = 0')) {
          return { rows: { _array: [], length: 0 } };
        }

        return { rows: { _array: [], length: 0 } };
      });

      const result = await syncService.sync();

      expect(result.result).toBe(SyncResult.SUCCESS);

      // Verify PUSH payload structure
      const pushRequest = mockAxios.history.post.find((req) =>
        req.url?.includes('/api/sync/push'),
      );
      expect(pushRequest).toBeDefined();

      const payload = JSON.parse(pushRequest!.data);

      // Should have separated updated and deleted
      expect(payload.changes.captures.updated).toHaveLength(5);
      expect(payload.changes.captures.deleted).toHaveLength(3);

      // Verify deleted record IDs
      const deletedIds = payload.changes.captures.deleted.map((r: any) => r.id);
      expect(deletedIds).toEqual([
        'cap-deleted-1',
        'cap-deleted-2',
        'cap-deleted-3',
      ]);
    });
  });
});
