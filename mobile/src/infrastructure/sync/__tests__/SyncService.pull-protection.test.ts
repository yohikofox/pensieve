/**
 * SyncService - PULL Protection Tests
 *
 * Bug Fix: La synchronisation backend écrase l'état local des captures.
 *
 * Tests pour :
 * 1. hasLocalPendingChanges() — vérifie _changed = 1 en DB locale
 * 2. applyServerChanges() — skip l'upsert si changements locaux en attente
 * 3. reconcileServerIdIfAbsent() — conserve le server_id même en cas de skip
 */

import 'reflect-metadata';
import { SyncService } from '../SyncService';
import { fetchWithRetry } from '../../http/fetchWithRetry';
import { DatabaseConnection } from '../../../database';
import { getLastPulledAt, updateLastPulledAt, updateLastPushedAt, updateSyncStatus } from '../SyncStorage';

// Mock dependencies
jest.mock('../../http/fetchWithRetry');
jest.mock('../../../database');
jest.mock('../SyncStorage');
jest.mock('@/stores/SyncStatusStore', () => ({
  useSyncStatusStore: {
    getState: () => ({
      setSyncing: jest.fn(),
      setSynced: jest.fn(),
      setError: jest.fn(),
    }),
  },
}));

const mockFetchWithRetry = fetchWithRetry as jest.MockedFunction<typeof fetchWithRetry>;
const mockGetLastPulledAt = getLastPulledAt as jest.MockedFunction<typeof getLastPulledAt>;
const mockUpdateLastPulledAt = updateLastPulledAt as jest.MockedFunction<typeof updateLastPulledAt>;
const mockUpdateLastPushedAt = updateLastPushedAt as jest.MockedFunction<typeof updateLastPushedAt>;
const mockUpdateSyncStatus = updateSyncStatus as jest.MockedFunction<typeof updateSyncStatus>;

function createFetchResponse(body: object, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('SyncService - PULL Protection (Bug Fix)', () => {
  let syncService: SyncService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      executeSync: jest.fn().mockReturnValue({ rows: [] }),
    };

    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue({
      getDatabase: () => mockDb,
    });

    mockGetLastPulledAt.mockResolvedValue(1000);
    mockUpdateLastPulledAt.mockResolvedValue(undefined);
    mockUpdateLastPushedAt.mockResolvedValue(undefined);
    mockUpdateSyncStatus.mockResolvedValue(undefined);

    syncService = new SyncService('https://api.example.com');
    syncService.setAuthToken('test-token');
  });

  describe('hasLocalPendingChanges()', () => {
    it('should return true when _changed = 1 for the record', () => {
      // Simule une capture avec des changements locaux en attente
      mockDb.executeSync.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT _changed') && params[0] === 'capture-local-id') {
          return { rows: { length: 1, _array: [{ _changed: 1 }] } };
        }
        return { rows: [] };
      });

      // Accès via la méthode privée — on passe par performPull pour le tester indirectement
      // Test direct via cast (méthode privée)
      const service = syncService as any;
      const result = service.hasLocalPendingChanges('captures', 'capture-local-id');
      expect(result).toBe(true);
    });

    it('should return false when _changed = 0 for the record', () => {
      mockDb.executeSync.mockReturnValue({
        rows: { length: 1, _array: [{ _changed: 0 }] },
      });

      const service = syncService as any;
      const result = service.hasLocalPendingChanges('captures', 'some-id');
      expect(result).toBe(false);
    });

    it('should return false when the record does not exist locally', () => {
      mockDb.executeSync.mockReturnValue({ rows: { length: 0, _array: [] } });

      const service = syncService as any;
      const result = service.hasLocalPendingChanges('captures', 'nonexistent-id');
      expect(result).toBe(false);
    });

    it('should return false for an invalid entity (SQL injection prevention)', () => {
      const service = syncService as any;
      const result = service.hasLocalPendingChanges('invalid_entity; DROP TABLE--', 'some-id');
      expect(result).toBe(false);
      // executeSync ne doit pas être appelé pour une entité invalide
      expect(mockDb.executeSync).not.toHaveBeenCalled();
    });

    it('should return false on DB error (fail-safe behavior)', () => {
      mockDb.executeSync.mockImplementation(() => {
        throw new Error('DB error');
      });

      const service = syncService as any;
      // Ne doit pas propager l'erreur
      expect(() => service.hasLocalPendingChanges('captures', 'some-id')).not.toThrow();
      const result = service.hasLocalPendingChanges('captures', 'some-id');
      expect(result).toBe(false);
    });
  });

  describe('applyServerChanges() — protection contre l\'écrasement', () => {
    it('should skip upsert when local record has _changed = 1', async () => {
      // Scénario du bug : transcription locale → PULL reçoit état stale du backend
      const pullResponse = {
        changes: {
          captures: {
            updated: [
              {
                id: 'backend-uuid',
                clientId: 'mobile-local-id', // sera mappé en id local
                stateName: 'captured',        // état stale du backend
                typeName: 'audio',
                normalizedText: null,         // pas encore transcrit côté backend
                lastModifiedAt: 1700000000000,
                createdAt: 1699000000000,
              },
            ],
          },
        },
        timestamp: Date.now(),
      };

      mockFetchWithRetry.mockResolvedValue(
        createFetchResponse(pullResponse),
      );

      // executeSync : première appel = _changed check → retourne 1 (changements locaux)
      // Les autres appels (SELECT id pour upsert) ne doivent PAS se produire
      mockDb.executeSync.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT _changed')) {
          // La capture a des changements locaux en attente
          return { rows: { length: 1, _array: [{ _changed: 1 }] } };
        }
        if (sql.includes('SELECT server_id')) {
          // server_id absent localement → réconciliation
          return { rows: { length: 1, _array: [{ server_id: null }] } };
        }
        return { rows: { length: 0, _array: [] } };
      });

      // Perform PULL only
      const service = syncService as any;
      const changesCount = await service.applyServerChanges(pullResponse.changes);

      // L'upsert est skipé — count = 0
      expect(changesCount).toBe(0);

      // Vérifie qu'aucun UPDATE/INSERT n'a été fait sur la capture
      const executeSyncCalls = mockDb.executeSync.mock.calls.map((c: any[]) => c[0] as string);
      const updateInsertCalls = executeSyncCalls.filter(
        (sql: string) => sql.trim().startsWith('UPDATE') || sql.trim().startsWith('INSERT'),
      );
      // Seul le UPDATE server_id de réconciliation est autorisé
      const nonServerIdUpdates = updateInsertCalls.filter(
        (sql: string) => !sql.includes('server_id'),
      );
      expect(nonServerIdUpdates).toHaveLength(0);
    });

    it('should apply upsert when local record has _changed = 0', async () => {
      const pullResponse = {
        changes: {
          captures: {
            updated: [
              {
                id: 'backend-uuid',
                clientId: 'mobile-local-id',
                stateName: 'captured',
                typeName: 'audio',
                normalizedText: null,
                lastModifiedAt: 1700000000000,
                createdAt: 1699000000000,
              },
            ],
          },
        },
        timestamp: Date.now(),
      };

      mockDb.executeSync.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT _changed')) {
          // Pas de changements locaux — le PULL peut écraser
          return { rows: { length: 1, _array: [{ _changed: 0 }] } };
        }
        if (sql.includes('SELECT id FROM captures')) {
          // La capture existe → UPDATE
          return { rows: { length: 1, _array: [{ id: 'mobile-local-id' }] } };
        }
        return { rows: { length: 0, _array: [] } };
      });

      const service = syncService as any;
      const changesCount = await service.applyServerChanges(pullResponse.changes);

      // L'upsert doit être appliqué
      expect(changesCount).toBe(1);

      // Vérifie qu'un UPDATE ou INSERT a bien été exécuté (upsertRecord)
      const executeSyncCalls = mockDb.executeSync.mock.calls.map((c: any[]) => c[0] as string);
      const upsertCalls = executeSyncCalls.filter(
        (sql: string) => sql.trim().startsWith('UPDATE') || sql.trim().startsWith('INSERT'),
      );
      expect(upsertCalls.length).toBeGreaterThan(0);
    });

    it('should reconcile server_id even when upsert is skipped', async () => {
      const pullResponse = {
        changes: {
          captures: {
            updated: [
              {
                id: 'backend-server-uuid',
                clientId: 'mobile-local-id',
                stateName: 'captured',
                typeName: 'audio',
                normalizedText: null,
                lastModifiedAt: 1700000000000,
                createdAt: 1699000000000,
              },
            ],
          },
        },
        timestamp: Date.now(),
      };

      const executeSyncCalls: Array<{ sql: string; params: any[] }> = [];
      mockDb.executeSync.mockImplementation((sql: string, params: any[]) => {
        executeSyncCalls.push({ sql, params });
        if (sql.includes('SELECT _changed')) {
          return { rows: { length: 1, _array: [{ _changed: 1 }] } };
        }
        if (sql.includes('SELECT server_id')) {
          // server_id absent → doit être réconcilié
          return { rows: { length: 1, _array: [{ server_id: null }] } };
        }
        return { rows: { length: 0, _array: [] } };
      });

      const service = syncService as any;
      await service.applyServerChanges(pullResponse.changes);

      // Vérifie que server_id a été mis à jour via reconcileServerIdIfAbsent
      const serverIdUpdate = executeSyncCalls.find(
        ({ sql }) => sql.includes('UPDATE captures SET server_id'),
      );
      expect(serverIdUpdate).toBeDefined();
      expect(serverIdUpdate!.params).toContain('backend-server-uuid');
      expect(serverIdUpdate!.params).toContain('mobile-local-id');
    });

    it('should NOT reconcile server_id when it already exists', async () => {
      const pullResponse = {
        changes: {
          captures: {
            updated: [
              {
                id: 'backend-server-uuid',
                clientId: 'mobile-local-id',
                stateName: 'captured',
                typeName: 'audio',
                normalizedText: null,
                lastModifiedAt: 1700000000000,
                createdAt: 1699000000000,
              },
            ],
          },
        },
        timestamp: Date.now(),
      };

      const executeSyncCalls: Array<{ sql: string; params: any[] }> = [];
      mockDb.executeSync.mockImplementation((sql: string, params: any[]) => {
        executeSyncCalls.push({ sql, params });
        if (sql.includes('SELECT _changed')) {
          return { rows: { length: 1, _array: [{ _changed: 1 }] } };
        }
        if (sql.includes('SELECT server_id')) {
          // server_id déjà présent → pas de réconciliation
          return { rows: { length: 1, _array: [{ server_id: 'backend-server-uuid' }] } };
        }
        return { rows: { length: 0, _array: [] } };
      });

      const service = syncService as any;
      await service.applyServerChanges(pullResponse.changes);

      // Aucun UPDATE server_id ne doit être fait
      const serverIdUpdate = executeSyncCalls.find(
        ({ sql }) => sql.includes('UPDATE captures SET server_id'),
      );
      expect(serverIdUpdate).toBeUndefined();
    });
  });
});
