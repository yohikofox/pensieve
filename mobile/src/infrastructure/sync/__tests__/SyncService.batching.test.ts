import 'reflect-metadata';

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

// Mock global fetch
global.fetch = jest.fn();

// Helper to track fetch calls
interface FetchCall {
  url: string;
  method: string;
  body?: any;
  headers?: any;
}

let fetchHistory: FetchCall[] = [];

function mockFetchResponse(url: string, response: any, status: number = 200) {
  (global.fetch as jest.Mock).mockImplementation(async (callUrl: string, options?: any) => {
    // Record call
    fetchHistory.push({
      url: callUrl,
      method: options?.method || 'GET',
      body: options?.body ? JSON.parse(options.body) : undefined,
      headers: options?.headers,
    });

    // Match URL pattern
    if (callUrl.includes(url)) {
      return new Response(JSON.stringify(response), {
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch call: ${callUrl}`);
  });
}

describe('SyncService - Batching (Task 2.5, 2.6)', () => {
  let syncService: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchHistory = [];

    syncService = new SyncService('http://localhost:3000');
    syncService.setAuthToken('test-token');
  });

  describe('Task 2.6: Batching scenario - 250 records → 3 batches', () => {
    it('should send 250 changed records in 3 batches (100 + 100 + 50)', async () => {
      // Mock fetch responses
      let pullCount = 0;
      let pushCount = 0;

      (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: any) => {
        fetchHistory.push({
          url,
          method: options?.method || 'GET',
          body: options?.body ? JSON.parse(options.body) : undefined,
          headers: options?.headers,
        });

        // PULL request
        if (url.includes('/api/sync/pull')) {
          pullCount++;
          return new Response(
            JSON.stringify({
              changes: {},
              timestamp: Date.now(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // PUSH requests
        if (url.includes('/api/sync/push')) {
          pushCount++;
          return new Response(
            JSON.stringify({
              conflicts: [],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
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
      const pushRequests = fetchHistory.filter((call) =>
        call.url.includes('/api/sync/push')
      );
      expect(pushRequests).toHaveLength(3);

      // Verify batch sizes
      const batch1 = pushRequests[0].body;
      const batch2 = pushRequests[1].body;
      const batch3 = pushRequests[2].body;

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
      // Mock fetch responses
      (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: any) => {
        fetchHistory.push({
          url,
          method: options?.method || 'GET',
          body: options?.body ? JSON.parse(options.body) : undefined,
        });

        if (url.includes('/api/sync/pull')) {
          return new Response(
            JSON.stringify({ changes: {}, timestamp: Date.now() }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('/api/sync/push')) {
          return new Response(
            JSON.stringify({ conflicts: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
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
      const pushRequests = fetchHistory.filter((call) =>
        call.url.includes('/api/sync/push')
      );
      expect(pushRequests).toHaveLength(1);
    });

    it('should collect conflicts from all batches', async () => {
      // Mock fetch responses with conflicts in batch 1 and 3
      let pushCount = 0;

      (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: any) => {
        fetchHistory.push({
          url,
          method: options?.method || 'GET',
          body: options?.body ? JSON.parse(options.body) : undefined,
        });

        if (url.includes('/api/sync/pull')) {
          return new Response(
            JSON.stringify({ changes: {}, timestamp: Date.now() }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('/api/sync/push')) {
          pushCount++;

          if (pushCount === 1) {
            // Batch 1: 2 conflicts
            return new Response(
              JSON.stringify({
                conflicts: [
                  { entity: 'captures', id: 'cap-1', serverVersion: {} },
                  { entity: 'captures', id: 'cap-2', serverVersion: {} },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          } else if (pushCount === 2) {
            // Batch 2: no conflicts
            return new Response(
              JSON.stringify({ conflicts: [] }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          } else {
            // Batch 3: 1 conflict
            return new Response(
              JSON.stringify({
                conflicts: [
                  { entity: 'captures', id: 'cap-150', serverVersion: {} },
                ],
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        throw new Error(`Unexpected fetch: ${url}`);
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
      // Mock fetch responses
      (global.fetch as jest.Mock).mockImplementation(async (url: string, options?: any) => {
        fetchHistory.push({
          url,
          method: options?.method || 'GET',
          body: options?.body ? JSON.parse(options.body) : undefined,
        });

        if (url.includes('/api/sync/pull')) {
          return new Response(
            JSON.stringify({ changes: {}, timestamp: Date.now() }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('/api/sync/push')) {
          return new Response(
            JSON.stringify({ conflicts: [] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        throw new Error(`Unexpected fetch: ${url}`);
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
      const pushRequest = fetchHistory.find((call) =>
        call.url.includes('/api/sync/push')
      );
      expect(pushRequest).toBeDefined();

      const payload = pushRequest!.body;

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
