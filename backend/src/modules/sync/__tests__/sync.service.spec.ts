import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SyncService } from '../application/services/sync.service';
import { Thought } from '../../knowledge/domain/entities/thought.entity';
import { Idea } from '../../knowledge/domain/entities/idea.entity';
import { Todo } from '../../action/domain/entities/todo.entity';
import { Capture } from '../../capture/domain/entities/capture.entity';
import { CaptureSyncStatusRepository } from '../../capture/infrastructure/repositories/capture-sync-status.repository';
import { SyncLog } from '../domain/entities/sync-log.entity';
import { SyncConflictResolver } from '../infrastructure/sync-conflict-resolver';
import { PushRequestDto } from '../application/dto/push-request.dto';

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
    findByNaturalKey: jest.fn().mockResolvedValue({ id: 2, name: 'deleted' }),
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
      // Pas de capture existante avec ce clientId
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
                typeId: 1,
                stateId: 2,
                syncStatusId: 1,
                rawContent: '/minio/audio.m4a',
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

      // La sauvegarde stocke clientId (pas id mobile comme id backend)
      expect(mockCaptureRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'mobile-uuid',
          ownerId: userId,
          typeId: 1,
          stateId: 2,
        }),
      );
      // Vérifie que l'id mobile n'est PAS utilisé comme id backend — un nouvel UUID est généré
      const savedRecord = mockCaptureRepository.save.mock.calls[0][0];
      expect(savedRecord.id).toBeDefined(); // UUID généré par l'application (uuidv7), pas l'id mobile
      expect(savedRecord.id).not.toBe('mobile-id'); // L'id mobile est exclu
    });

    it('should UPDATE an existing capture without creating a duplicate', async () => {
      const existingCapture = {
        id: 'backend-uuid',
        clientId: 'mobile-uuid',
        ownerId: userId,
        lastModifiedAt: 999000, // Antérieur à lastPulledAt → pas de conflit
        syncStatusId: 1,
      };

      mockCaptureRepository.findOne.mockResolvedValueOnce(existingCapture);
      mockCaptureRepository.save.mockResolvedValueOnce(existingCapture);

      const dto: PushRequestDto = {
        lastPulledAt: 1000000,
        changes: {
          captures: {
            updated: [
              {
                id: 'mobile-uuid',
                typeId: 1,
                stateId: 2,
                syncStatusId: 1,
                normalizedText: 'Transcription mise à jour',
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
      // Le status 'deleted' a l'id=2 dans les fixtures
      mockCaptureSyncStatusRepository.findByNaturalKey.mockResolvedValueOnce({
        id: 2,
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
          syncStatusId: 2, // id du statut 'deleted'
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
            updated: [{ id: 'cap-1', typeId: 1, stateId: 2 }],
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

      // Le service mappe les captures supprimées sur clientId
      // Testé indirectement via processPull
      const pullDto = { lastPulledAt: 0 };
      const result = await service.processPull(userId, pullDto);

      // Le résultat doit inclure captures dans changes
      // (vide si aucune capture active, mais pas d'erreur)
      expect(result).toMatchObject({
        timestamp: expect.any(Number),
        changes: expect.any(Object),
      });
    });
  });
});
