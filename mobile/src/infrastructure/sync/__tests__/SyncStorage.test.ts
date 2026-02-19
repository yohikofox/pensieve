/**
 * SyncStorage Unit Tests
 * Story 14.2 — Audit AsyncStorage (ADR-022)
 *
 * Tests all OP-SQLite data access functions in SyncStorage.ts.
 * Validates that sync metadata is correctly persisted and retrieved from OP-SQLite.
 */

import {
  getSyncMetadata,
  setSyncMetadata,
  getLastPulledAt,
  updateLastPulledAt,
  updateLastPushedAt,
  updateSyncStatus,
  clearAllSyncMetadata,
} from '../SyncStorage';

// Mock the OP-SQLite database layer
const mockExecuteSync = jest.fn();
const mockGetDatabase = jest.fn(() => ({ executeSync: mockExecuteSync }));

jest.mock('../../../database', () => ({
  database: {
    getDatabase: () => mockGetDatabase(),
  },
}));

describe('SyncStorage (OP-SQLite)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getSyncMetadata ────────────────────────────────────────────────────────

  describe('getSyncMetadata', () => {
    it('should return null when no row exists for the entity', async () => {
      mockExecuteSync.mockReturnValue({ rows: [] });

      const result = await getSyncMetadata('captures');

      expect(result).toBeNull();
      expect(mockExecuteSync).toHaveBeenCalledWith(
        'SELECT * FROM sync_metadata WHERE entity = ?',
        ['captures'],
      );
    });

    it('should return a SyncMetadata object when a row exists', async () => {
      const row = {
        entity: 'captures',
        last_pulled_at: 1736760600000,
        last_pushed_at: 1736760700000,
        last_sync_status: 'success',
        last_sync_error: null,
        updated_at: 1736760800000,
      };
      mockExecuteSync.mockReturnValue({ rows: [row] });

      const result = await getSyncMetadata('captures');

      expect(result).toEqual({
        entity: 'captures',
        last_pulled_at: 1736760600000,
        last_pushed_at: 1736760700000,
        last_sync_status: 'success',
        last_sync_error: undefined,
        updated_at: 1736760800000,
      });
    });

    it('should return null and not throw on database error', async () => {
      mockExecuteSync.mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await getSyncMetadata('captures');

      expect(result).toBeNull();
    });
  });

  // ─── setSyncMetadata ────────────────────────────────────────────────────────

  describe('setSyncMetadata', () => {
    it('should execute an INSERT OR UPDATE for the entity', async () => {
      mockExecuteSync.mockReturnValue({});

      await setSyncMetadata('captures', {
        entity: 'captures',
        last_pulled_at: 1736760600000,
        last_pushed_at: 1736760700000,
        last_sync_status: 'success',
        last_sync_error: undefined,
        updated_at: 1736760800000,
      });

      expect(mockExecuteSync).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecuteSync.mock.calls[0];
      expect(sql).toContain('INSERT INTO sync_metadata');
      expect(sql).toContain('ON CONFLICT(entity) DO UPDATE SET');
      expect(params[0]).toBe('captures');
      expect(params[1]).toBe(1736760600000);
    });

    it('should throw when database write fails', async () => {
      mockExecuteSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(
        setSyncMetadata('captures', {
          entity: 'captures',
          last_pulled_at: 0,
          last_pushed_at: 0,
          last_sync_status: 'success',
          updated_at: 0,
        }),
      ).rejects.toThrow('Write failed');
    });
  });

  // ─── getLastPulledAt ────────────────────────────────────────────────────────

  describe('getLastPulledAt', () => {
    it('should return 0 when no metadata exists (triggers full sync)', async () => {
      mockExecuteSync.mockReturnValue({ rows: [] });

      const result = await getLastPulledAt('captures');

      expect(result).toBe(0);
    });

    it('should return the stored last_pulled_at timestamp', async () => {
      mockExecuteSync.mockReturnValue({
        rows: [
          {
            entity: 'captures',
            last_pulled_at: 1736760600000,
            last_pushed_at: 0,
            last_sync_status: 'success',
            last_sync_error: null,
            updated_at: 1736760600000,
          },
        ],
      });

      const result = await getLastPulledAt('captures');

      expect(result).toBe(1736760600000);
    });
  });

  // ─── updateLastPulledAt ─────────────────────────────────────────────────────

  describe('updateLastPulledAt', () => {
    it('should set last_pulled_at with status=success when no prior row exists', async () => {
      // First call: getSyncMetadata returns null (no row)
      // Second call: setSyncMetadata executes INSERT
      mockExecuteSync
        .mockReturnValueOnce({ rows: [] })
        .mockReturnValueOnce({});

      await updateLastPulledAt('captures', 1736760900000);

      expect(mockExecuteSync).toHaveBeenCalledTimes(2);
      const [, params] = mockExecuteSync.mock.calls[1];
      expect(params[1]).toBe(1736760900000); // last_pulled_at
      expect(params[3]).toBe('success'); // last_sync_status
    });

    it('should preserve existing last_pushed_at when updating last_pulled_at', async () => {
      const existingRow = {
        entity: 'thoughts',
        last_pulled_at: 1736760000000,
        last_pushed_at: 1736760500000,
        last_sync_status: 'success',
        last_sync_error: null,
        updated_at: 1736760500000,
      };
      mockExecuteSync
        .mockReturnValueOnce({ rows: [existingRow] })
        .mockReturnValueOnce({});

      await updateLastPulledAt('thoughts', 1736760900000);

      const [, params] = mockExecuteSync.mock.calls[1];
      expect(params[1]).toBe(1736760900000); // new last_pulled_at
      expect(params[2]).toBe(1736760500000); // preserved last_pushed_at
    });
  });

  // ─── updateLastPushedAt ─────────────────────────────────────────────────────

  describe('updateLastPushedAt', () => {
    it('should set last_pushed_at with status=success', async () => {
      mockExecuteSync
        .mockReturnValueOnce({ rows: [] })
        .mockReturnValueOnce({});

      await updateLastPushedAt('todos', 1736760900000);

      const [, params] = mockExecuteSync.mock.calls[1];
      expect(params[2]).toBe(1736760900000); // last_pushed_at
      expect(params[3]).toBe('success');
    });
  });

  // ─── updateSyncStatus ───────────────────────────────────────────────────────

  describe('updateSyncStatus', () => {
    it('should update status to error with error message', async () => {
      mockExecuteSync
        .mockReturnValueOnce({ rows: [] })
        .mockReturnValueOnce({});

      await updateSyncStatus('captures', 'error', 'Network timeout');

      const [, params] = mockExecuteSync.mock.calls[1];
      expect(params[3]).toBe('error');
      expect(params[4]).toBe('Network timeout');
    });

    it('should update status to in_progress without error', async () => {
      mockExecuteSync
        .mockReturnValueOnce({ rows: [] })
        .mockReturnValueOnce({});

      await updateSyncStatus('ideas', 'in_progress');

      const [, params] = mockExecuteSync.mock.calls[1];
      expect(params[3]).toBe('in_progress');
      expect(params[4]).toBeNull();
    });
  });

  // ─── clearAllSyncMetadata ───────────────────────────────────────────────────

  describe('clearAllSyncMetadata', () => {
    it('should execute DELETE FROM sync_metadata (no hardcoded entity list)', async () => {
      mockExecuteSync.mockReturnValue({});

      await clearAllSyncMetadata();

      expect(mockExecuteSync).toHaveBeenCalledTimes(1);
      expect(mockExecuteSync).toHaveBeenCalledWith('DELETE FROM sync_metadata');
    });

    it('should throw when database delete fails', async () => {
      mockExecuteSync.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(clearAllSyncMetadata()).rejects.toThrow('Delete failed');
    });
  });
});
