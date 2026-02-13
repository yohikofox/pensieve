/**
 * Tests for Capture Repository - Data Access Layer
 *
 * Validates CRUD operations and querying capabilities
 * with OP-SQLite
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Migration: WatermelonDB → OP-SQLite
 */

import { CaptureRepository } from '../CaptureRepository';
import { database } from '../../../../database';
import { ISyncQueueService } from '../../domain/ISyncQueueService';
import { EventBus } from '../../../shared/events/EventBus';
import { CAPTURE_TYPES, CAPTURE_STATES } from '../../domain/Capture.model';

// Mock ISyncQueueService
const mockSyncQueueService: jest.Mocked<ISyncQueueService> = {
  enqueue: jest.fn().mockResolvedValue(1),
  getPendingOperations: jest.fn(),
  getPendingOperationsForEntity: jest.fn(),
  markAsSynced: jest.fn(),
  markAsFailed: jest.fn(),
  getQueueSize: jest.fn(),
  getQueueSizeByType: jest.fn(),
  removeFailedOperation: jest.fn(),
  clearQueue: jest.fn(),
};

// Mock EventBus
const mockEventBus: jest.Mocked<EventBus> = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
} as any;

// Mock OP-SQLite database
jest.mock('../../../../database', () => {
  const mockDB = new Map<string, any>();
  let executeImpl: any = null;

  return {
    database: {
      execute: jest.fn((sql: string, params?: any[]) => {
        if (executeImpl) {
          return executeImpl(sql, params);
        }
        return { rows: [] };
      }),
      transaction: jest.fn((callback: any) => {
        const mockTransactionDB = {
          execute: jest.fn((sql: string, params?: any[]) => {
            if (executeImpl) {
              return executeImpl(sql, params);
            }
            return { rows: [] };
          }),
        };
        return callback(mockTransactionDB);
      }),
      reset: jest.fn(),
      _setExecuteImpl: (impl: any) => {
        executeImpl = impl;
      },
      _getStore: () => mockDB,
    },
  };
});

describe('CaptureRepository', () => {
  let repository: CaptureRepository;
  let mockStore: Map<string, any>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CaptureRepository(mockSyncQueueService, mockEventBus);
    mockStore = (database as any)._getStore();
    mockStore.clear();

    // Setup mock implementation
    (database as any)._setExecuteImpl((sql: string, params?: any[]) => {
      // INSERT
      if (sql.includes('INSERT INTO captures')) {
        const [id, type, state, raw_content, duration, file_size, created_at, updated_at, sync_version] = params || [];
        mockStore.set(id, {
          id,
          type,
          state,
          raw_content,
          duration,
          file_size,
          created_at,
          updated_at,
          sync_version,
          last_sync_at: null,
          server_id: null,
          conflict_data: null,
        });
        return { rows: [] };
      }

      // UPDATE
      if (sql.includes('UPDATE captures')) {
        const id = params?.[params.length - 1];
        const existing = mockStore.get(id);
        if (!existing) return { rows: [] };

        // Parse update fields from SQL
        const updates: any = {};
        if (sql.includes('state = ?')) {
          updates.state = params?.[0];
        }
        if (sql.includes('raw_content = ?')) {
          const idx = sql.includes('state = ?') ? 1 : 0;
          updates.raw_content = params?.[idx];
        }
        if (sql.includes('duration = ?')) {
          let idx = 0;
          if (sql.includes('state = ?')) idx++;
          if (sql.includes('raw_content = ?')) idx++;
          updates.duration = params?.[idx];
        }
        if (sql.includes('file_size = ?')) {
          let idx = 0;
          if (sql.includes('state = ?')) idx++;
          if (sql.includes('raw_content = ?')) idx++;
          if (sql.includes('duration = ?')) idx++;
          updates.file_size = params?.[idx];
        }

        // Always update timestamp and version
        const updatedAtIdx = params!.length - 2;
        updates.updated_at = params?.[updatedAtIdx];
        updates.sync_version = (existing.sync_version || 0) + 1;

        mockStore.set(id, { ...existing, ...updates });
        return { rows: [] };
      }

      // SELECT by ID
      if (sql.includes('SELECT * FROM captures WHERE id = ?')) {
        const id = params?.[0];
        const row = mockStore.get(id);
        return { rows: row ? [row] : [] };
      }

      // SELECT all
      if (sql.includes('SELECT * FROM captures') && !sql.includes('WHERE')) {
        const rows = Array.from(mockStore.values()).sort((a, b) => b.created_at - a.created_at);
        return { rows: rows };
      }

      // SELECT by state
      if (sql.includes('WHERE state = ?')) {
        const state = params?.[0];
        const rows = Array.from(mockStore.values())
          .filter((r) => r.state === state)
          .sort((a, b) => b.created_at - a.created_at);
        return { rows: rows };
      }

      // SELECT by type
      if (sql.includes('WHERE type = ?')) {
        const type = params?.[0];
        const rows = Array.from(mockStore.values())
          .filter((r) => r.type === type)
          .sort((a, b) => b.created_at - a.created_at);
        return { rows: rows };
      }

      // DELETE
      if (sql.includes('DELETE FROM captures')) {
        const id = params?.[0];
        mockStore.delete(id);
        return { rows: [] };
      }

      return { rows: [] };
    });
  });

  afterEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new capture with required fields', async () => {
      const result = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: '/path/to/audio.m4a',
      });

      expect(result.type).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data!.type).toBe('audio');
      expect(result.data!.state).toBe('recording');
      expect(result.data!.rawContent).toBe('/path/to/audio.m4a');
      expect(result.data!.createdAt).toBeInstanceOf(Date);
    });

    it('should create a capture with optional fields', async () => {
      const result = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/path/to/audio.m4a',
        duration: 5000,
        fileSize: 1024000,
      });

      expect(result.type).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data!.duration).toBe(5000);
      expect(result.data!.fileSize).toBe(1024000);
    });
  });

  describe('findById', () => {
    it('should find a capture by id', async () => {
      const createResult = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/path/to/audio.m4a',
      });

      expect(createResult.type).toBe('success');
      const found = await repository.findById(createResult.data!.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(createResult.data!.id);
      expect(found?.type).toBe('audio');
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update capture state', async () => {
      const createResult = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: '/path/to/audio.m4a',
      });

      expect(createResult.type).toBe('success');

      const updateResult = await repository.update(createResult.data!.id, {
        state: CAPTURE_STATES.CAPTURED,
      });

      expect(updateResult.type).toBe('success');
      expect(updateResult.data).toBeDefined();
      expect(updateResult.data!.state).toBe('captured');
      expect(updateResult.data!.id).toBe(createResult.data!.id);
      expect(updateResult.data!.syncVersion).toBe(1); // Incremented from 0
    });

    it('should update multiple fields', async () => {
      const createResult = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: '/path/to/temp.m4a',
      });

      expect(createResult.type).toBe('success');

      const updateResult = await repository.update(createResult.data!.id, {
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/path/to/final.m4a',
        duration: 10000,
        fileSize: 2048000,
      });

      expect(updateResult.type).toBe('success');
      expect(updateResult.data).toBeDefined();
      expect(updateResult.data!.state).toBe('captured');
      expect(updateResult.data!.rawContent).toBe('/path/to/final.m4a');
      expect(updateResult.data!.duration).toBe(10000);
      expect(updateResult.data!.fileSize).toBe(2048000);
    });
  });

  describe('findAll', () => {
    it('should return empty array when no captures exist', async () => {
      const captures = await repository.findAll();

      expect(captures).toEqual([]);
    });

    it('should return all captures', async () => {
      await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio1.m4a',
      });

      await repository.create({
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Quick note',
      });

      const captures = await repository.findAll();

      expect(captures).toHaveLength(2);
    });
  });

  describe('findByState', () => {
    it('should find captures by state', async () => {
      await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: '/audio1.m4a',
      });

      await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio2.m4a',
      });

      await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.RECORDING,
        rawContent: '/audio3.m4a',
      });

      const recording = await repository.findByState('recording');

      expect(recording).toHaveLength(2);
      expect(recording.every((c) => c.state === 'recording')).toBe(true);
    });
  });

  describe('findByType', () => {
    it('should find captures by type', async () => {
      await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio.m4a',
      });

      await repository.create({
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: 'Quick note',
      });

      const audioCaptures = await repository.findByType('audio');

      expect(audioCaptures).toHaveLength(1);
      expect(audioCaptures[0].type).toBe('audio');
    });
  });

  describe('delete', () => {
    it('should delete a capture', async () => {
      const capture = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio.m4a',
      });

      const id = capture.id;
      await repository.delete(id);

      const found = await repository.findById(id);
      expect(found).toBeNull();
    });
  });

  describe('destroyPermanently', () => {
    it('should permanently delete a capture', async () => {
      const capture = await repository.create({
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        rawContent: '/audio.m4a',
      });

      await repository.destroyPermanently(capture.id);

      const found = await repository.findById(capture.id);
      expect(found).toBeNull();
    });
  });
});
