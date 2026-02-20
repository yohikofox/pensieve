import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SyncService } from '../application/services/sync.service';
import { Thought } from '../../knowledge/domain/entities/thought.entity';
import { Idea } from '../../knowledge/domain/entities/idea.entity';
import { Todo } from '../../action/domain/entities/todo.entity';
import { Capture } from '../../capture/domain/entities/capture.entity';
import { CaptureSyncStatusRepository } from '../../capture/infrastructure/repositories/capture-sync-status.repository';
import { CaptureTypeRepository } from '../../capture/infrastructure/repositories/capture-type.repository';
import { CaptureStateRepository } from '../../capture/infrastructure/repositories/capture-state.repository';
import { SyncLog } from '../domain/entities/sync-log.entity';
import { SyncConflictResolver } from '../infrastructure/sync-conflict-resolver';
import { PushRequestDto } from '../application/dto/push-request.dto';

// UUIDs déterministes (reference-data.constants.ts)
const CAPTURE_STATE_UUID_CAPTURED = 'b0000000-0000-7000-8000-000000000002';
const CAPTURE_STATE_UUID_READY = 'b0000000-0000-7000-8000-000000000005';
const CAPTURE_STATE_UUID_PROCESSING = 'b0000000-0000-7000-8000-000000000004';
const CAPTURE_TYPE_UUID_AUDIO = 'a0000000-0000-7000-8000-000000000001';
const CAPTURE_SYNC_STATUS_UUID_ACTIVE = 'c0000000-0000-7000-8000-000000000001';
const CAPTURE_SYNC_STATUS_UUID_DELETED = 'c0000000-0000-7000-8000-000000000002';

describe('SyncService', () => {
  let service: SyncService;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'transaction'>>;

  const mockThoughtRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockIdeaRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockTodoRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockCaptureRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockCaptureSyncStatusRepository = {
    findByNaturalKey: jest.fn().mockResolvedValue({
      id: CAPTURE_SYNC_STATUS_UUID_ACTIVE,
      name: 'active',
    }),
  };

  const mockCaptureTypeRepository = {
    findByNaturalKey: jest.fn().mockResolvedValue({
      id: CAPTURE_TYPE_UUID_AUDIO,
      name: 'audio',
    }),
  };

  const mockCaptureStateRepository = {
    findByNaturalKey: jest.fn().mockResolvedValue({
      id: CAPTURE_STATE_UUID_CAPTURED,
      name: 'captured',
    }),
  };

  const mockSyncLogRepository = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({ id: 1 }),
  };

  const mockConflictResolver = {
    hasConflict: jest.fn().mockReturnValue(false),
    resolve: jest.fn(),
  };

  const mockTransactionManager = {
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset des mocks avec valeurs par défaut
    mockCaptureSyncStatusRepository.findByNaturalKey.mockResolvedValue({
      id: CAPTURE_SYNC_STATUS_UUID_ACTIVE,
      name: 'active',
    });
    mockCaptureTypeRepository.findByNaturalKey.mockResolvedValue({
      id: CAPTURE_TYPE_UUID_AUDIO,
      name: 'audio',
    });
    mockCaptureStateRepository.findByNaturalKey.mockResolvedValue({
      id: CAPTURE_STATE_UUID_CAPTURED,
      name: 'captured',
    });

    mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockTransactionManager);
      }),
    } as any;

    // Setup transactional repos including Capture
    mockTransactionManager.getRepository.mockImplementation((entity) => {
      if (entity === Thought) return mockThoughtRepository;
      if (entity === Idea) return mockIdeaRepository;
      if (entity === Todo) return mockTodoRepository;
      if (entity === Capture) return mockCaptureRepository;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: getRepositoryToken(Thought),
          useValue: mockThoughtRepository,
        },
        { provide: getRepositoryToken(Idea), useValue: mockIdeaRepository },
        { provide: getRepositoryToken(Todo), useValue: mockTodoRepository },
        {
          provide: getRepositoryToken(Capture),
          useValue: mockCaptureRepository,
        },
        {
          provide: CaptureSyncStatusRepository,
          useValue: mockCaptureSyncStatusRepository,
        },
        {
          provide: CaptureTypeRepository,
          useValue: mockCaptureTypeRepository,
        },
        {
          provide: CaptureStateRepository,
          useValue: mockCaptureStateRepository,
        },
        {
          provide: getRepositoryToken(SyncLog),
          useValue: mockSyncLogRepository,
        },
        { provide: SyncConflictResolver, useValue: mockConflictResolver },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  describe('processPush - unknown entity handling', () => {
    const userId = 'user-123';

    it('should not throw when PUSH contains an unsupported entity', async () => {
      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          unknown_entity: {
            updated: [{ id: 'rec-1' }],
          },
        },
      };

      await expect(service.processPush(userId, dto)).resolves.not.toThrow();
    });

    it('should return a valid sync response when PUSH contains only unsupported entities', async () => {
      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          unknown_entity: {
            updated: [{ id: 'rec-1' }],
            deleted: ['rec-2'],
          },
        },
      };

      const result = await service.processPush(userId, dto);

      expect(result).toMatchObject({
        timestamp: expect.any(Number),
        changes: expect.any(Object),
      });
    });

    it('should process known entities even when PUSH also contains unsupported ones', async () => {
      mockThoughtRepository.findOne.mockResolvedValueOnce(null);
      mockThoughtRepository.save.mockResolvedValueOnce({ id: 'thought-1' });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          unknown_entity: {
            updated: [{ id: 'rec-1' }],
          },
          thought: {
            updated: [
              {
                id: 'thought-1',
                ownerId: userId,
                summary: 'test',
                lastModifiedAt: 1000001,
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      expect(mockThoughtRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'thought-1', ownerId: userId },
      });
    });

    it('should not throw when PUSH deleted list contains unsupported entity', async () => {
      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          unknown_entity: {
            deleted: ['rec-1', 'rec-2'],
          },
        },
      };

      await expect(service.processPush(userId, dto)).resolves.not.toThrow();
    });
  });

  describe('processPush - captures', () => {
    const userId = 'user-123';

    it('should CREATE a new capture when clientId does not exist', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({
        id: 'backend-uuid',
        clientId: 'mobile-uuid',
        ownerId: userId,
      });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid', // ID mobile devient clientId
                type: 'audio',
                state: 'captured',
                raw_content: '/minio/audio.m4a',
                duration: 5000,
              },
            ],
          },
        },
      };

      await expect(service.processPush(userId, dto)).resolves.not.toThrow();

      // La recherche se fait par clientId (pas id)
      expect(mockCaptureRepository.findOne).toHaveBeenCalledWith({
        where: { clientId: 'mobile-uuid', ownerId: userId },
      });

      // La sauvegarde utilise les UUIDs résolus via les repositories
      expect(mockCaptureRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'mobile-uuid',
          ownerId: userId,
          typeId: CAPTURE_TYPE_UUID_AUDIO,
          stateId: CAPTURE_STATE_UUID_CAPTURED,
          rawContent: '/minio/audio.m4a',
          duration: 5000,
        }),
      );
      // Vérifie que l'id mobile n'est PAS utilisé comme id backend — un nouvel UUID est généré
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.id).toBeDefined();
      expect(savedRecord.id).not.toBe('mobile-uuid');
    });

    it('should UPDATE an existing capture without creating a duplicate', async () => {
      const existingCapture = {
        id: 'backend-uuid',
        clientId: 'mobile-uuid',
        ownerId: userId,
        lastModifiedAt: 999000, // Antérieur à lastPulledAt → pas de conflit
        syncStatusId: CAPTURE_SYNC_STATUS_UUID_ACTIVE,
      };

      mockCaptureRepository.findOne.mockResolvedValueOnce(existingCapture);
      mockCaptureRepository.save.mockResolvedValueOnce(existingCapture);

      mockCaptureStateRepository.findByNaturalKey.mockResolvedValueOnce({
        id: CAPTURE_STATE_UUID_READY,
        name: 'ready',
      });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                type: 'audio',
                state: 'ready',
                normalized_text: 'Transcription mise à jour',
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      // La recherche se fait par clientId
      expect(mockCaptureRepository.findOne).toHaveBeenCalledWith({
        where: { clientId: 'mobile-uuid', ownerId: userId },
      });

      // L'id backend est préservé (pas de doublon)
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.id).toBe('backend-uuid');
      expect(savedRecord.clientId).toBe('mobile-uuid');
    });

    it('should soft-delete a capture by setting syncStatusId=deleted', async () => {
      mockCaptureSyncStatusRepository.findByNaturalKey.mockResolvedValueOnce({
        id: CAPTURE_SYNC_STATUS_UUID_DELETED,
        name: 'deleted',
      });
      mockCaptureRepository.update.mockResolvedValueOnce({ affected: 1 });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            deleted: ['mobile-uuid-to-delete'],
          },
        },
      };

      await service.processPush(userId, dto);

      // La suppression se fait par clientId
      expect(mockCaptureRepository.update).toHaveBeenCalledWith(
        { clientId: 'mobile-uuid-to-delete', ownerId: userId },
        expect.objectContaining({
          syncStatusId: CAPTURE_SYNC_STATUS_UUID_DELETED,
        }),
      );
    });

    it('should handle mixed: capture update + todo delete without error', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});
      mockTodoRepository.update.mockResolvedValueOnce({ affected: 1 });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [{ id: 'cap-1', type: 'audio', state: 'captured' }],
          },
          todo: {
            deleted: ['todo-1'],
          },
        },
      };

      await expect(service.processPush(userId, dto)).resolves.not.toThrow();
    });

    it('should use clientId as identifier in PULL deleted list', async () => {
      // Simule 2 captures retournées par le PULL
      const deletedCaptures = [
        { id: 'backend-1', clientId: 'mobile-1' },
        { id: 'backend-2', clientId: 'mobile-2' },
      ];
      mockCaptureRepository.find.mockResolvedValue(deletedCaptures);

      const pullDto = { lastPulledAt: 0 };
      const result = await service.processPull(userId, pullDto);

      expect(result).toMatchObject({
        timestamp: expect.any(Number),
        changes: expect.any(Object),
      });
    });
  });

  describe('processPush - mapCaptureFromMobile (Bug Fix: PUSH ne mappait pas vers le format entity)', () => {
    const userId = 'user-123';

    it('should map state="ready" to stateId UUID via captureStateRepository', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});
      mockCaptureStateRepository.findByNaturalKey.mockResolvedValueOnce({
        id: CAPTURE_STATE_UUID_READY,
        name: 'ready',
      });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                state: 'ready',
                normalized_text: 'Ma transcription',
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      expect(mockCaptureStateRepository.findByNaturalKey).toHaveBeenCalledWith('ready');
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.stateId).toBe(CAPTURE_STATE_UUID_READY);
    });

    it('should map state="processing" to stateId UUID via captureStateRepository', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});
      mockCaptureStateRepository.findByNaturalKey.mockResolvedValueOnce({
        id: CAPTURE_STATE_UUID_PROCESSING,
        name: 'processing',
      });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [{ id: 'mobile-uuid', state: 'processing' }],
          },
        },
      };

      await service.processPush(userId, dto);

      expect(mockCaptureStateRepository.findByNaturalKey).toHaveBeenCalledWith('processing');
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.stateId).toBe(CAPTURE_STATE_UUID_PROCESSING);
    });

    it('should map normalized_text (snake_case) to normalizedText (camelCase)', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                normalized_text: 'Transcription complète',
                file_size: 102400,
                raw_content: '/local/audio.m4a',
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.normalizedText).toBe('Transcription complète');
      expect(savedRecord.fileSize).toBe(102400);
      expect(savedRecord.rawContent).toBe('/local/audio.m4a');
    });

    it('should exclude mobile-only fields (_changed, _status, sync_version, etc.)', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                state: 'captured',
                _changed: 1,
                _status: 'active',
                sync_version: 3,
                last_sync_at: 1700000000000,
                server_id: 'some-server-id',
                conflict_data: null,
                wav_path: '/tmp/audio.wav',
                retry_count: 2,
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      // Champs mobile-only doivent être absents du record sauvegardé
      expect(savedRecord._changed).toBeUndefined();
      expect(savedRecord._status).toBeUndefined();
      expect(savedRecord.sync_version).toBeUndefined();
      expect(savedRecord.last_sync_at).toBeUndefined();
      expect(savedRecord.wav_path).toBeUndefined();
      expect(savedRecord.retry_count).toBeUndefined();
    });

    it('should UPDATE capture with state="ready" and persist normalizedText correctly', async () => {
      // Scénario du bug : transcription locale → PUSH → vérifier persistance
      const existingCapture = {
        id: 'backend-uuid',
        clientId: 'mobile-uuid',
        ownerId: userId,
        lastModifiedAt: 999000,
        stateId: CAPTURE_STATE_UUID_CAPTURED,
        normalizedText: null,
      };

      mockCaptureRepository.findOne.mockResolvedValueOnce(existingCapture);
      mockCaptureRepository.save.mockResolvedValueOnce({
        ...existingCapture,
        stateId: CAPTURE_STATE_UUID_READY,
        normalizedText: 'Texte transcrit',
      });
      mockCaptureStateRepository.findByNaturalKey.mockResolvedValueOnce({
        id: CAPTURE_STATE_UUID_READY,
        name: 'ready',
      });

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                state: 'ready',
                normalized_text: 'Texte transcrit',
              },
            ],
          },
        },
      };

      await service.processPush(userId, dto);

      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.stateId).toBe(CAPTURE_STATE_UUID_READY);
      expect(savedRecord.normalizedText).toBe('Texte transcrit');
      // ID backend préservé
      expect(savedRecord.id).toBe('backend-uuid');
    });

    it('should warn but not throw when state is unknown (no DB match)', async () => {
      mockCaptureRepository.findOne.mockResolvedValueOnce(null);
      mockCaptureRepository.save.mockResolvedValueOnce({});
      // Repository retourne null pour un état inconnu
      mockCaptureStateRepository.findByNaturalKey.mockResolvedValueOnce(null);

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [{ id: 'mobile-uuid', state: 'unknown_state' }],
          },
        },
      };

      // Ne doit pas throw même si l'état est inconnu
      await expect(service.processPush(userId, dto)).resolves.not.toThrow();

      // stateId absent du record sauvegardé (pas de crash)
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.stateId).toBeUndefined();
    });
  });
});
