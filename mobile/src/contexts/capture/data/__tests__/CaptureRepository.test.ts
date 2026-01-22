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
        return { rows: { _array: [] } };
      }),
      transaction: jest.fn((callback: any) => {
        const mockTransactionDB = {
          execute: jest.fn((sql: string, params?: any[]) => {
            if (executeImpl) {
              return executeImpl(sql, params);
            }
            return { rows: { _array: [] } };
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
    repository = new CaptureRepository();
    mockStore = (database as any)._getStore();
    mockStore.clear();

    // Setup mock implementation
    (database as any)._setExecuteImpl((sql: string, params?: any[]) => {
      // INSERT
      if (sql.includes('INSERT INTO captures')) {
        const [id, type, state, raw_content, duration, file_size, created_at, updated_at, sync_status, sync_version] = params || [];
        mockStore.set(id, {
          id,
          type,
          state,
          raw_content,
          duration,
          file_size,
          created_at,
          updated_at,
          sync_status,
          sync_version,
          last_sync_at: null,
          server_id: null,
          conflict_data: null,
        });
        return { rows: { _array: [] } };
      }

      // UPDATE
      if (sql.includes('UPDATE captures')) {
        const id = params?.[params.length - 1];
        const existing = mockStore.get(id);
        if (!existing) return { rows: { _array: [] } };

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
        if (sql.includes('sync_status = ?')) {
          let idx = 0;
          if (sql.includes('state = ?')) idx++;
          if (sql.includes('raw_content = ?')) idx++;
          if (sql.includes('duration = ?')) idx++;
          if (sql.includes('file_size = ?')) idx++;
          updates.sync_status = params?.[idx];
        }

        // Always update timestamp and version
        const updatedAtIdx = params!.length - 2;
        updates.updated_at = params?.[updatedAtIdx];
        updates.sync_version = (existing.sync_version || 0) + 1;

        mockStore.set(id, { ...existing, ...updates });
        return { rows: { _array: [] } };
      }

      // SELECT by ID
      if (sql.includes('SELECT * FROM captures WHERE id = ?')) {
        const id = params?.[0];
        const row = mockStore.get(id);
        return { rows: { _array: row ? [row] : [] } };
      }

      // SELECT all
      if (sql.includes('SELECT * FROM captures') && !sql.includes('WHERE')) {
        const rows = Array.from(mockStore.values()).sort((a, b) => b.created_at - a.created_at);
        return { rows: { _array: rows } };
      }

      // SELECT by state
      if (sql.includes('WHERE state = ?')) {
        const state = params?.[0];
        const rows = Array.from(mockStore.values())
          .filter((r) => r.state === state)
          .sort((a, b) => b.created_at - a.created_at);
        return { rows: { _array: rows } };
      }

      // SELECT by sync_status
      if (sql.includes('WHERE sync_status = ?')) {
        const syncStatus = params?.[0];
        const rows = Array.from(mockStore.values())
          .filter((r) => r.sync_status === syncStatus)
          .sort((a, b) => b.created_at - a.created_at);
        return { rows: { _array: rows } };
      }

      // SELECT by type
      if (sql.includes('WHERE type = ?')) {
        const type = params?.[0];
        const rows = Array.from(mockStore.values())
          .filter((r) => r.type === type)
          .sort((a, b) => b.created_at - a.created_at);
        return { rows: { _array: rows } };
      }

      // DELETE
      if (sql.includes('DELETE FROM captures')) {
        const id = params?.[0];
        mockStore.delete(id);
        return { rows: { _array: [] } };
      }

      return { rows: { _array: [] } };
    });
  });

  afterEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new capture with required fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      expect(capture).toBeDefined();
      expect(capture.type).toBe('audio');
      expect(capture.state).toBe('recording');
      expect(capture.rawContent).toBe('/path/to/audio.m4a');
      expect(capture.syncStatus).toBe('pending');
      expect(capture.createdAt).toBeInstanceOf(Date);
    });

    it('should create a capture with optional fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
        duration: 5000,
        fileSize: 1024000,
      });

      expect(capture.duration).toBe(5000);
      expect(capture.fileSize).toBe(1024000);
    });
  });

  describe('findById', () => {
    it('should find a capture by id', async () => {
      const created = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.type).toBe('audio');
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update capture state', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      const updated = await repository.update(capture.id, {
        state: 'captured',
      });

      expect(updated.state).toBe('captured');
      expect(updated.id).toBe(capture.id);
      expect(updated.syncVersion).toBe(1); // Incremented from 0
    });

    it('should update multiple fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/temp.m4a',
        syncStatus: 'pending',
      });

      const updated = await repository.update(capture.id, {
        state: 'captured',
        rawContent: '/path/to/final.m4a',
        duration: 10000,
        fileSize: 2048000,
        syncStatus: 'synced',
      });

      expect(updated.state).toBe('captured');
      expect(updated.rawContent).toBe('/path/to/final.m4a');
      expect(updated.duration).toBe(10000);
      expect(updated.fileSize).toBe(2048000);
      expect(updated.syncStatus).toBe('synced');
    });
  });

  describe('findAll', () => {
    it('should return empty array when no captures exist', async () => {
      const captures = await repository.findAll();

      expect(captures).toEqual([]);
    });

    it('should return all captures', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'text',
        state: 'captured',
        rawContent: 'Quick note',
        syncStatus: 'synced',
      });

      const captures = await repository.findAll();

      expect(captures).toHaveLength(2);
    });
  });

  describe('findByState', () => {
    it('should find captures by state', async () => {
      await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio2.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/audio3.m4a',
        syncStatus: 'pending',
      });

      const recording = await repository.findByState('recording');

      expect(recording).toHaveLength(2);
      expect(recording.every((c) => c.state === 'recording')).toBe(true);
    });
  });

  describe('findBySyncStatus', () => {
    it('should find captures by sync status', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio2.m4a',
        syncStatus: 'synced',
      });

      const pending = await repository.findBySyncStatus('pending');

      expect(pending).toHaveLength(1);
      expect(pending[0].syncStatus).toBe('pending');
    });
  });

  describe('findByType', () => {
    it('should find captures by type', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'text',
        state: 'captured',
        rawContent: 'Quick note',
        syncStatus: 'pending',
      });

      const audioCaptures = await repository.findByType('audio');

      expect(audioCaptures).toHaveLength(1);
      expect(audioCaptures[0].type).toBe('audio');
    });
  });

  describe('delete', () => {
    it('should delete a capture', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
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
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
      });

      await repository.destroyPermanently(capture.id);

      const found = await repository.findById(capture.id);
      expect(found).toBeNull();
    });
  });
});
