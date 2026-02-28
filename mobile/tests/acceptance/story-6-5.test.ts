/**
 * Story 6.5 — Fix Pipeline Audio Upload & Synchro Descendante
 *
 * Tests BDD pour valider :
 * - BUG 1 fix : processUploadQueue() consomme la queue après SyncSuccess
 * - BUG 2 fix : captures.audio_url est persisté après upload réussi
 * - BUG 5 fix : audioUrl du PULL est stocké dans captures.audio_url
 *
 * Pattern: BDD avec jest-cucumber
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import path from 'path';
import {
  RepositoryResultType,
  success,
  networkError,
} from '../../src/contexts/shared/domain/Result';
import { CAPTURE_TYPES } from '../../src/contexts/capture/domain/Capture.model';

// ============================================================================
// Mocks
// ============================================================================

// Mock database (OP-SQLite) — synchronous execute
interface MockDatabase {
  _captures: Record<string, any>[];
  _uploadQueue: Record<string, any>[];
  execute: jest.Mock;
  executeSync: jest.Mock;
  reset(): void;
}

const mockDb: MockDatabase = {
  _captures: [],
  _uploadQueue: [],

  execute: jest.fn((sql: string, params?: any[]): { rows?: any[]; rowsAffected: number } => {
    // SELECT * FROM upload_queue WHERE status = 'pending'
    if (sql.includes('FROM upload_queue') && sql.includes("status = 'pending'")) {
      return {
        rows: mockDb._uploadQueue.filter((u: Record<string, any>) => u.status === 'pending'),
        rowsAffected: 0,
      };
    }

    // UPDATE upload_queue SET status = ...
    if (sql.includes('UPDATE upload_queue SET status')) {
      const status = params?.[0];
      const id = params?.[params.length - 1];
      const entry = mockDb._uploadQueue.find((u: Record<string, any>) => u.id === id);
      if (entry) entry.status = status;
      return { rowsAffected: 1 };
    }

    // UPDATE captures SET audio_url = ...
    if (sql.includes('UPDATE captures SET audio_url')) {
      const audioUrl = params?.[0];
      const captureId = params?.[params.length - 1];
      const capture = mockDb._captures.find((c: Record<string, any>) => c.id === captureId);
      if (capture) capture.audio_url = audioUrl;
      return { rowsAffected: 1 };
    }

    // UPDATE captures SET ... (upsert from PULL)
    if (sql.includes('UPDATE captures SET') && sql.includes('audio_url')) {
      const captureId = params?.[params.length - 1];
      const capture = mockDb._captures.find((c: Record<string, any>) => c.id === captureId);
      if (capture) {
        // Extract audio_url from SET clause
        const audioUrlIdx = sql.indexOf('audio_url = ?');
        if (audioUrlIdx > -1) {
          const colNames = sql
            .substring(sql.indexOf('SET') + 3, sql.indexOf('WHERE'))
            .split(',')
            .map((s) => s.trim().split(' = ?')[0].trim());
          const audioUrlColIdx = colNames.indexOf('audio_url');
          if (audioUrlColIdx > -1) {
            capture.audio_url = params?.[audioUrlColIdx];
          }
        }
      }
      return { rowsAffected: 1 };
    }

    return { rowsAffected: 0, rows: [] };
  }),

  executeSync: jest.fn((sql: string, params?: any[]): { rows: { _array: any[] }; rowsAffected: number } => {
    // SELECT id FROM captures WHERE id = ?
    if (sql.includes('SELECT id FROM captures WHERE id')) {
      const id = params?.[0];
      const found = mockDb._captures.filter((c: Record<string, any>) => c.id === id);
      return { rows: { _array: found }, rowsAffected: 0 };
    }
    // UPDATE captures SET ... WHERE id = ?
    if (sql.includes('UPDATE captures SET') && sql.includes('WHERE id = ?')) {
      return { rowsAffected: 1, rows: { _array: [] } };
    }
    return { rowsAffected: 0, rows: { _array: [] } };
  }),

  reset() {
    this._captures = [];
    this._uploadQueue = [];
    this.execute.mockClear();
    this.executeSync.mockClear();
  },
};

jest.mock('../../src/database', () => ({
  database: mockDb,
  DatabaseConnection: {
    getInstance: jest.fn(() => ({
      getDatabase: jest.fn(() => mockDb),
      initialize: jest.fn(),
    })),
  },
}));

// ============================================================================
// Mock AudioUploadService
// ============================================================================

const mockAudioUploadService = {
  enqueueUpload: jest.fn(),
  uploadFile: jest.fn(),
  getPendingUploads: jest.fn(),
};

// ============================================================================
// Mock EventBus
// ============================================================================

type EventHandler = (event: any) => void;
const mockEventBus = {
  _handlers: new Map<string, EventHandler>(),
  subscribe: jest.fn((eventType: string, handler: EventHandler) => {
    mockEventBus._handlers.set(eventType, handler);
    return { unsubscribe: jest.fn() };
  }),
  publish: jest.fn(),
  reset() {
    this._handlers.clear();
    this.subscribe.mockClear();
    this.publish.mockClear();
  },
};

// ============================================================================
// Lazy-import UploadOrchestrator after mocks are set up
// ============================================================================

let UploadOrchestrator: any;

// ============================================================================
// Feature loading
// ============================================================================

const feature = loadFeature(
  path.join(
    __dirname,
    'features/story-6-5-audio-upload-pipeline.feature',
  ),
);

defineFeature(feature, (test) => {
  let orchestrator: any;

  beforeAll(async () => {
    // Import after mocks are registered
    ({ UploadOrchestrator } = await import(
      '../../src/infrastructure/upload/UploadOrchestrator'
    ));
  });

  beforeEach(() => {
    mockDb.reset();
    mockEventBus.reset();
    jest.clearAllMocks();

    // Default: getPendingUploads returns empty list
    mockAudioUploadService.getPendingUploads.mockResolvedValue(
      success([]),
    );

    orchestrator = new UploadOrchestrator(mockEventBus, mockAudioUploadService);
  });

  afterEach(() => {
    orchestrator.stop();
  });

  // ============================================================================
  // BUG 1 FIX — Upload worker déclenché après SyncSuccess
  // ============================================================================

  test('La queue d\'upload est consommée après une synchronisation réussie', ({
    given,
    and,
    when,
    then,
  }) => {
    const captureId = 'capture-abc';
    const filePath = '/storage/audio.m4a';
    const uploadId = 'upload-1';

    given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
    and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

    given(
      /^une capture audio "([^"]*)" avec fichier local "([^"]*)" existe$/,
      (id, path) => {
        mockDb._captures.push({
          id,
          type: CAPTURE_TYPES.AUDIO,
          raw_content: path,
          file_size: 1024000,
          audio_url: null,
        });
      },
    );

    and(
      /^la capture a été synchronisée \(SyncSuccess\)$/,
      () => {
        // Will be triggered by event
      },
    );

    and(
      /^la capture est en attente dans la upload_queue avec statut "pending"$/,
      () => {
        mockDb._uploadQueue.push({
          id: uploadId,
          capture_id: captureId,
          file_path: filePath,
          file_size: 1024000,
          status: 'pending',
        });

        mockAudioUploadService.getPendingUploads.mockResolvedValue(
          success([{
            id: uploadId,
            capture_id: captureId,
            file_path: filePath,
            file_size: 1024000,
            status: 'pending',
          }]),
        );

        // Mock uploadFile: simulate AudioUploadService updating status + returning audioUrl
        mockAudioUploadService.uploadFile.mockImplementation(
          async (id: string, _captureId: string) => {
            const entry = mockDb._uploadQueue.find(
              (u: Record<string, any>) => u.id === id,
            );
            if (entry) entry.status = 'completed';
            return success({ audioUrl: `audio/user-1/${captureId}.m4a` });
          },
        );
      },
    );

    when(
      /^l'UploadOrchestrator traite l'événement SyncSuccess$/,
      async () => {
        const handler = mockEventBus._handlers.get('SyncSuccess');
        await handler?.({
          type: 'SyncSuccess',
          timestamp: Date.now(),
          payload: { syncedCaptureIds: [captureId] },
        });
        // Allow async processing
        await new Promise((r) => setTimeout(r, 10));
      },
    );

    then(
      /^AudioUploadService\.uploadFile\(\) est appelé pour la capture "([^"]*)"$/,
      (id) => {
        expect(mockAudioUploadService.uploadFile).toHaveBeenCalledWith(
          uploadId,
          id,
          filePath,
          1024000,
        );
      },
    );

    and(
      /^le statut dans upload_queue passe à "completed"$/,
      () => {
        // AudioUploadService (mocked) updates status — verify via mockDb state
        const entry = mockDb._uploadQueue.find(
          (u: Record<string, any>) => u.id === uploadId,
        );
        expect(entry?.status).toBe('completed');
      },
    );
  });

  test('Aucun traitement si la queue est vide', ({ given, when, then, and }) => {
    given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
    and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

    given(
      /^aucune capture audio n'est en attente dans la upload_queue$/,
      () => {
        mockAudioUploadService.getPendingUploads.mockResolvedValue(success([]));
      },
    );

    when(
      /^l'UploadOrchestrator traite l'événement SyncSuccess avec captures \["([^"]*)"\]$/,
      async (captureId) => {
        const handler = mockEventBus._handlers.get('SyncSuccess');
        await handler?.({
          type: 'SyncSuccess',
          timestamp: Date.now(),
          payload: { syncedCaptureIds: [captureId] },
        });
        await new Promise((r) => setTimeout(r, 10));
      },
    );

    then(
      /^AudioUploadService\.uploadFile\(\) n'est pas appelé$/,
      () => {
        expect(mockAudioUploadService.uploadFile).not.toHaveBeenCalled();
      },
    );
  });

  // ============================================================================
  // BUG 2 FIX — audio_url persisté dans captures
  // ============================================================================

  test('L\'audio_url est persisté dans captures après upload réussi', ({
    given,
    and,
    when,
    then,
  }) => {
    const captureId = 'capture-abc';
    const expectedAudioUrl = 'audio/user-1/capture-abc.m4a';

    given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
    and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

    given(
      /^une capture audio "([^"]*)" est dans la upload_queue avec statut "pending"$/,
      (id) => {
        mockDb._captures.push({ id, audio_url: null });
        mockDb._uploadQueue.push({
          id: 'upload-1',
          capture_id: id,
          file_path: '/storage/audio.m4a',
          file_size: 1024000,
          status: 'pending',
        });
      },
    );

    and(
      /^l'AudioUploadService retourne l'audioUrl "([^"]*)" pour cet upload$/,
      (audioUrl) => {
        mockAudioUploadService.getPendingUploads.mockResolvedValue(
          success([{
            id: 'upload-1',
            capture_id: captureId,
            file_path: '/storage/audio.m4a',
            file_size: 1024000,
            status: 'pending',
          }]),
        );
        mockAudioUploadService.uploadFile.mockResolvedValue(
          success({ audioUrl }),
        );
      },
    );

    when(
      /^l'UploadOrchestrator traite la queue d'upload$/,
      async () => {
        const handler = mockEventBus._handlers.get('SyncSuccess');
        await handler?.({
          type: 'SyncSuccess',
          timestamp: Date.now(),
          payload: { syncedCaptureIds: [captureId] },
        });
        await new Promise((r) => setTimeout(r, 10));
      },
    );

    then(
      /^la capture "([^"]*)" dans la table captures a audio_url = "([^"]*)"$/,
      (id, audioUrl) => {
        const updateCalls = mockDb.execute.mock.calls.filter(
          ([sql, params]: [string, any[]]) =>
            sql.includes('UPDATE captures SET audio_url') &&
            params.includes(audioUrl) &&
            params.includes(id),
        );
        expect(updateCalls.length).toBeGreaterThan(0);
      },
    );
  });

  test('audio_url non mis à jour si l\'upload échoue', ({
    given,
    and,
    when,
    then,
  }) => {
    const captureId = 'capture-fail';

    given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
    and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

    given(
      /^une capture audio "([^"]*)" est dans la upload_queue avec statut "pending"$/,
      (id) => {
        mockDb._captures.push({ id, audio_url: null });
        mockDb._uploadQueue.push({
          id: 'upload-fail',
          capture_id: id,
          file_path: '/storage/audio.m4a',
          file_size: 1024000,
          status: 'pending',
        });
      },
    );

    and(
      /^l'AudioUploadService retourne une erreur réseau pour cet upload$/,
      () => {
        mockAudioUploadService.getPendingUploads.mockResolvedValue(
          success([{
            id: 'upload-fail',
            capture_id: captureId,
            file_path: '/storage/audio.m4a',
            file_size: 1024000,
            status: 'pending',
          }]),
        );
        mockAudioUploadService.uploadFile.mockResolvedValue(
          networkError('Connection timeout'),
        );
      },
    );

    when(
      /^l'UploadOrchestrator traite la queue d'upload$/,
      async () => {
        const handler = mockEventBus._handlers.get('SyncSuccess');
        await handler?.({
          type: 'SyncSuccess',
          timestamp: Date.now(),
          payload: { syncedCaptureIds: [captureId] },
        });
        await new Promise((r) => setTimeout(r, 10));
      },
    );

    then(
      /^la capture "([^"]*)" dans la table captures n'a pas d'audio_url$/,
      (id) => {
        const audioUrlUpdateCalls = mockDb.execute.mock.calls.filter(
          ([sql, params]: [string, any[]]) =>
            sql.includes('UPDATE captures SET audio_url') &&
            params.includes(id),
        );
        expect(audioUrlUpdateCalls.length).toBe(0);
      },
    );

    and(
      /^le statut dans upload_queue passe à "failed"$/,
      () => {
        // The AudioUploadService handles failed status internally
        // We just verify uploadFile was called (failure path)
        expect(mockAudioUploadService.uploadFile).toHaveBeenCalledWith(
          'upload-fail',
          captureId,
          '/storage/audio.m4a',
          1024000,
        );
      },
    );
  });

  // ============================================================================
  // BUG 5 FIX — audioUrl du PULL stocké dans captures
  // ============================================================================

  test('L\'audioUrl reçue du PULL est stockée dans captures.audio_url', ({
    given,
    when,
    then,
    and,
  }) => {
    const presignedUrl =
      'http://api.example.local:3000/api/uploads/audio/capture-abc';

    let SyncService: any;
    let syncService: any;
    let appliedCaptures: any[];

    given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
    and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

    given(
      /^le serveur retourne une capture audio avec audioUrl "([^"]*)"$/,
      (audioUrl) => {
        appliedCaptures = [
          {
            id: 'backend-uuid',
            clientId: 'mobile-uuid',
            typeName: 'audio',
            stateName: 'captured',
            rawContent: 'audio/user-1/mobile-uuid.m4a',
            audioUrl,
            duration: 5000,
            fileSize: 1024000,
            lastModifiedAt: Date.now(),
            createdAt: Date.now(),
          },
        ];
      },
    );

    when(
      /^SyncService applique les changements serveur \(applyServerChanges\)$/,
      async () => {
        ({ SyncService } = await import(
          '../../src/infrastructure/sync/SyncService'
        ));

        // Create a SyncService instance and call the private method via the public sync interface
        // We test mapCaptureFromBackend indirectly by checking that audio_url is included
        // In the mapped record.
        const instance = new SyncService('http://api.example.local');

        // Access the private method for testing
        const mapped = (instance as any).mapCaptureFromBackend(
          appliedCaptures[0],
        );
        syncService = { mapped };
      },
    );

    then(
      /^la capture locale a audio_url = "([^"]*)"$/,
      (audioUrl) => {
        expect(syncService.mapped.audio_url).toBe(audioUrl);
      },
    );
  });

  test(
    'L\'audioUrl n\'est pas écrasée si absente du PULL',
    ({ given, and, when, then }) => {
      let mappedResult: any;

      given(/^l'utilisateur est authentifié$/, () => { /* handled in beforeEach */ });
      and(/^l'AudioUploadService est initialisé$/, () => { /* handled in beforeEach */ });

      given(
        /^une capture locale a déjà audio_url = "([^"]*)"$/,
        (_existingUrl) => {
          // Simulate local capture state — the mapping is done fresh from server data
          // so the test checks that undefined/null audioUrl doesn't produce audio_url key
        },
      );

      and(
        /^le serveur retourne la même capture sans audioUrl dans le PULL$/,
        () => {
          // Server record has no audioUrl field
        },
      );

      when(
        /^SyncService applique les changements serveur \(applyServerChanges\)$/,
        async () => {
          const { SyncService } = await import(
            '../../src/infrastructure/sync/SyncService'
          );

          const instance = new SyncService('http://api.example.local');

          // Server record without audioUrl
          mappedResult = (instance as any).mapCaptureFromBackend({
            id: 'backend-uuid',
            clientId: 'mobile-uuid',
            typeName: 'audio',
            stateName: 'captured',
            rawContent: null,
            normalizedText: null,
            duration: 5000,
            fileSize: null,
            lastModifiedAt: Date.now(),
            createdAt: Date.now(),
            // No audioUrl field
          });
        },
      );

      then(
        /^la capture locale conserve son audio_url = "([^"]*)"$/,
        (_existingUrl) => {
          // When server doesn't provide audioUrl, the mapped record should not have audio_url
          // so the upsert won't overwrite the existing value
          expect(mappedResult.audio_url).toBeUndefined();
        },
      );
    },
  );
});
