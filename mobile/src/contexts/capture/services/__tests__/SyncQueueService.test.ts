/**
 * Tests for SyncQueueService
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC1: Persist All Captures Locally with Sync Status
 * Task 3: Implement Sync Queue Management
 */

import { SyncQueueService } from '../SyncQueueService';
import { database } from '../../../../database';

// Mock database
jest.mock('../../../../database', () => ({
  database: {
    execute: jest.fn(),
  },
}));

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let mockDatabase: jest.Mocked<typeof database>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = database as jest.Mocked<typeof database>;
    service = new SyncQueueService();
  });

  describe('enqueue', () => {
    it('should add operation to sync queue with FIFO ordering', async () => {
      // Mock last_insert_rowid response
      mockDatabase.execute.mockReturnValueOnce(undefined as any); // INSERT
      mockDatabase.execute.mockReturnValueOnce({ rows: [{ id: 42 }] } as any); // last_insert_rowid

      const queueItemId = await service.enqueue(
        'capture',
        'capture-123',
        'create',
        { type: CAPTURE_TYPES.AUDIO, state: CAPTURE_STATES.CAPTURED }
      );

      expect(queueItemId).toBe(42);
      expect(mockDatabase.execute).toHaveBeenCalledTimes(2);

      // Verify INSERT statement
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining(['capture', 'capture-123', 'create'])
      );
    });

    it('should serialize payload as JSON', async () => {
      mockDatabase.execute.mockReturnValueOnce(undefined as any);
      mockDatabase.execute.mockReturnValueOnce({ rows: [{ id: 1 }] } as any);

      const payload = { type: CAPTURE_TYPES.AUDIO, duration: 5000, fileSize: 1024 };
      await service.enqueue('capture', 'cap-456', 'update', payload);

      const insertCall = mockDatabase.execute.mock.calls[0];
      const payloadArg = insertCall[1]?.[3]; // 4th parameter in array
      expect(typeof payloadArg).toBe('string');
      expect(JSON.parse(payloadArg as string)).toEqual(payload);
    });
  });

  describe('getPendingOperations', () => {
    it('should return empty array when queue is empty', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [] } as any);

      const operations = await service.getPendingOperations();

      expect(operations).toEqual([]);
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE retry_count < max_retries'),
        expect.any(Array)
      );
    });

    it('should return operations in FIFO order (created_at ASC)', async () => {
      const mockRows = [
        {
          id: 1,
          entity_type: 'capture',
          entity_id: 'cap-1',
          operation: 'create',
          payload: '{"type":"audio"}',
          created_at: 1000,
          retry_count: 0,
          last_error: null,
          max_retries: 3,
        },
        {
          id: 2,
          entity_type: 'capture',
          entity_id: 'cap-2',
          operation: 'update',
          payload: '{"state":"captured"}',
          created_at: 2000,
          retry_count: 0,
          last_error: null,
          max_retries: 3,
        },
      ];

      mockDatabase.execute.mockReturnValueOnce({ rows: mockRows } as any);

      const operations = await service.getPendingOperations();

      expect(operations).toHaveLength(2);
      expect(operations[0].id).toBe(1);
      expect(operations[1].id).toBe(2);
      expect(operations[0].createdAt.getTime()).toBe(1000);
      expect(operations[1].createdAt.getTime()).toBe(2000);

      // Verify ORDER BY created_at ASC in query
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at ASC'),
        expect.any(Array)
      );
    });

    it('should respect limit parameter', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [] } as any);

      await service.getPendingOperations(10);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [10]
      );
    });

    it('should filter out operations that exceeded max retries', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [] } as any);

      await service.getPendingOperations();

      // Verify WHERE clause filters retry_count < max_retries
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE retry_count < max_retries'),
        expect.any(Array)
      );
    });
  });

  describe('getPendingOperationsForEntity', () => {
    it('should filter by entity type and ID', async () => {
      const mockRows = [
        {
          id: 1,
          entity_type: 'capture',
          entity_id: 'cap-123',
          operation: 'create',
          payload: '{}',
          created_at: 1000,
          retry_count: 0,
          last_error: null,
          max_retries: 3,
        },
      ];

      mockDatabase.execute.mockReturnValueOnce({ rows: mockRows } as any);

      const operations = await service.getPendingOperationsForEntity('capture', 'cap-123');

      expect(operations).toHaveLength(1);
      expect(operations[0].entityType).toBe('capture');
      expect(operations[0].entityId).toBe('cap-123');

      // Verify WHERE clause filters entity_type and entity_id
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE entity_type = ?'),
        expect.arrayContaining(['capture', 'cap-123'])
      );
    });
  });

  describe('markAsSynced', () => {
    it('should delete operation from queue', async () => {
      mockDatabase.execute.mockReturnValueOnce(undefined as any);

      await service.markAsSynced(42);

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        [42]
      );
    });
  });

  describe('markAsFailed', () => {
    it('should increment retry_count and log error', async () => {
      mockDatabase.execute.mockReturnValueOnce(undefined as any);

      await service.markAsFailed(42, 'Network timeout');

      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining(['Network timeout', 42])
      );
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('retry_count = retry_count + 1'),
        expect.any(Array)
      );
    });
  });

  describe('removeFailedOperation', () => {
    it('should remove operation from queue', async () => {
      // Mock SELECT query result
      mockDatabase.execute.mockReturnValueOnce({
        rows: [{
          id: 42,
          entity_type: 'capture',
          entity_id: 'cap-123',
          operation: 'create',
          retry_count: 3,
          last_error: 'Max retries exceeded',
        }],
      } as any);
      // Mock DELETE query
      mockDatabase.execute.mockReturnValueOnce(undefined as any);

      await service.removeFailedOperation(42);

      // Should call SELECT first, then DELETE
      expect(mockDatabase.execute).toHaveBeenCalledTimes(2);
      expect(mockDatabase.execute).toHaveBeenNthCalledWith(
        1,
        'SELECT * FROM sync_queue WHERE id = ?',
        [42]
      );
      expect(mockDatabase.execute).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM sync_queue WHERE id = ?',
        [42]
      );
    });
  });

  describe('getQueueSize', () => {
    it('should return total count of pending operations', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [{ count: 15 }] } as any);

      const size = await service.getQueueSize();

      expect(size).toBe(15);
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < max_retries'
      );
    });

    it('should return 0 on error', async () => {
      mockDatabase.execute.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const size = await service.getQueueSize();

      expect(size).toBe(0);
    });
  });

  describe('getQueueSizeByType', () => {
    it('should return count filtered by entity type', async () => {
      mockDatabase.execute.mockReturnValueOnce({ rows: [{ count: 7 }] } as any);

      const size = await service.getQueueSizeByType('capture');

      expect(size).toBe(7);
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE entity_type = ?'),
        expect.arrayContaining(['capture'])
      );
    });
  });

  describe('NFR6: Zero Data Loss', () => {
    it('should persist queue across app restarts', async () => {
      // Enqueue operation
      mockDatabase.execute.mockReturnValueOnce(undefined as any);
      mockDatabase.execute.mockReturnValueOnce({ rows: [{ id: 1 }] } as any);

      await service.enqueue('capture', 'cap-123', 'create', { type: CAPTURE_TYPES.AUDIO });

      // Verify operation written to SQLite table (persists across restarts)
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.any(Array)
      );

      // Simulate app restart: create new service instance
      const newService = new SyncQueueService();

      // Verify pending operations still accessible
      mockDatabase.execute.mockReturnValueOnce({
        rows: [
          {
            id: 1,
            entity_type: 'capture',
            entity_id: 'cap-123',
            operation: 'create',
            payload: '{"type":"audio"}',
            created_at: Date.now(),
            retry_count: 0,
            last_error: null,
            max_retries: 3,
          },
        ],
      } as any);

      const operations = await newService.getPendingOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].entityId).toBe('cap-123');
    });
  });
});
