import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SyncConflictResolver,
  SyncEntity,
  ConflictResolutionResult,
} from '../infrastructure/sync-conflict-resolver';
import { SyncConflict } from '../domain/entities/sync-conflict.entity';

describe('SyncConflictResolver', () => {
  let resolver: SyncConflictResolver;
  let conflictRepository: Repository<SyncConflict>;

  // Mock repository
  const mockConflictRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncConflictResolver,
        {
          provide: getRepositoryToken(SyncConflict),
          useValue: mockConflictRepository,
        },
      ],
    }).compile();

    resolver = module.get<SyncConflictResolver>(SyncConflictResolver);
    conflictRepository = module.get<Repository<SyncConflict>>(
      getRepositoryToken(SyncConflict),
    );
  });

  describe('Capture Conflict Resolution (ADR-009.2)', () => {
    it('should resolve capture conflict with server winning on technical metadata', async () => {
      // Arrange
      const serverRecord = {
        id: 'capture-1',
        normalized_text: 'Server AI normalized text',
        state: 'processed',
        transcription_status: 'completed',
        digest_status: 'done',
        tags: ['server-tag'],
        projectId: 'server-project',
        title: 'Server Title',
        last_modified_at: 1000,
      };

      const clientRecord = {
        id: 'capture-1',
        normalized_text: 'Client normalized text',
        state: 'pending',
        transcription_status: 'pending',
        digest_status: 'pending',
        tags: ['client-tag', 'user-tag'],
        projectId: 'client-project',
        title: 'Client Title',
        last_modified_at: 2000,
      };

      mockConflictRepository.create.mockReturnValue({});
      mockConflictRepository.save.mockResolvedValue({});

      // Act
      const result: ConflictResolutionResult = await resolver.resolve(
        serverRecord,
        clientRecord,
        'capture',
      );

      // Assert - Server wins on technical metadata
      expect(result.resolvedRecord.normalized_text).toBe(
        'Server AI normalized text',
      );
      expect(result.resolvedRecord.state).toBe('processed');
      expect(result.resolvedRecord.transcription_status).toBe('completed');
      expect(result.resolvedRecord.digest_status).toBe('done');

      // Assert - Client wins on user data
      expect(result.resolvedRecord.tags).toEqual(['client-tag', 'user-tag']);
      expect(result.resolvedRecord.projectId).toBe('client-project');
      expect(result.resolvedRecord.title).toBe('Client Title');

      // Assert - Strategy metadata
      expect(result.strategy).toBe('per-column-hybrid');
      expect(result.conflictType).toBe('capture-user-vs-technical');
    });
  });

  describe('Todo Conflict Resolution (ADR-009.2)', () => {
    it('should resolve todo conflict with client winning on business state', async () => {
      // Arrange
      const serverRecord = {
        id: 'todo-1',
        state: 'todo',
        completed_at: null,
        title: 'Server Title',
        description: 'Server description',
        priority: 5, // AI calculated
        suggested_due_date: '2026-02-20',
        last_modified_at: 1000,
      };

      const clientRecord = {
        id: 'todo-1',
        state: 'done',
        completed_at: '2026-02-13T10:00:00Z',
        title: 'Client Title - User edited',
        description: 'Client description - User edited',
        priority: 3, // User tried to change
        suggested_due_date: '2026-02-15', // User tried to change
        last_modified_at: 2000,
      };

      mockConflictRepository.create.mockReturnValue({});
      mockConflictRepository.save.mockResolvedValue({});

      // Act
      const result: ConflictResolutionResult = await resolver.resolve(
        serverRecord,
        clientRecord,
        'todo',
      );

      // Assert - Client wins on business state
      expect(result.resolvedRecord.state).toBe('done');
      expect(result.resolvedRecord.completed_at).toBe(
        '2026-02-13T10:00:00Z',
      );
      expect(result.resolvedRecord.title).toBe('Client Title - User edited');
      expect(result.resolvedRecord.description).toBe(
        'Client description - User edited',
      );

      // Assert - Server wins on AI metadata
      expect(result.resolvedRecord.priority).toBe(5);
      expect(result.resolvedRecord.suggested_due_date).toBe('2026-02-20');

      // Assert - Strategy metadata
      expect(result.strategy).toBe('per-column-hybrid');
      expect(result.conflictType).toBe('todo-state-vs-ai');
    });
  });

  describe('Default Client-Wins Resolution', () => {
    it.each<SyncEntity>(['thought', 'idea', 'project'])(
      'should resolve %s conflict with client-wins strategy',
      async (entity: SyncEntity) => {
        // Arrange
        const serverRecord = {
          id: `${entity}-1`,
          title: 'Server Title',
          content: 'Server content',
          last_modified_at: 1000,
        };

        const clientRecord = {
          id: `${entity}-1`,
          title: 'Client Title',
          content: 'Client content',
          last_modified_at: 2000,
        };

        mockConflictRepository.create.mockReturnValue({});
        mockConflictRepository.save.mockResolvedValue({});

        // Act
        const result: ConflictResolutionResult = await resolver.resolve(
          serverRecord,
          clientRecord,
          entity,
        );

        // Assert - Client wins everything
        expect(result.resolvedRecord.title).toBe('Client Title');
        expect(result.resolvedRecord.content).toBe('Client content');

        // Assert - Strategy metadata
        expect(result.strategy).toBe('client-wins');
        expect(result.conflictType).toBe('simple-client-wins');
      },
    );
  });

  describe('Multi-Client Conflict Scenarios', () => {
    it('should handle 2 clients modifying same todo record', async () => {
      // Arrange - Simulate 2 clients modifying same record
      const serverRecord = {
        id: 'todo-shared',
        title: 'Original Server Title',
        state: 'todo',
        priority: 3,
        last_modified_at: 1000,
      };

      const client1Record = {
        id: 'todo-shared',
        title: 'Client 1 Edit',
        state: 'in-progress',
        priority: 5,
        last_modified_at: 2000,
      };

      const client2Record = {
        id: 'todo-shared',
        title: 'Client 2 Edit',
        state: 'done',
        priority: 8,
        last_modified_at: 3000,
      };

      mockConflictRepository.create.mockReturnValue({});
      mockConflictRepository.save.mockResolvedValue({});

      // Act - First sync (client 1)
      const result1: ConflictResolutionResult = await resolver.resolve(
        serverRecord,
        client1Record,
        'todo',
      );

      // Act - Second sync (client 2, now conflicts with updated server)
      const result2: ConflictResolutionResult = await resolver.resolve(
        result1.resolvedRecord,
        client2Record,
        'todo',
      );

      // Assert - Last client wins on business state (client 2)
      expect(result2.resolvedRecord.state).toBe('done');
      expect(result2.resolvedRecord.title).toBe('Client 2 Edit');

      // Assert - Conflicts logged twice
      expect(mockConflictRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('Conflict Logging', () => {
    it('should log conflict to sync_conflicts table', async () => {
      // Arrange
      const serverRecord = {
        id: 'thought-1',
        title: 'Server',
        last_modified_at: 1000,
      };
      const clientRecord = {
        id: 'thought-1',
        title: 'Client',
        last_modified_at: 2000,
      };

      const mockConflictEntity = {
        entity: 'thought',
        recordId: 'thought-1',
        conflictType: 'simple-client-wins',
        resolutionStrategy: 'client-wins',
        serverData: serverRecord,
        clientData: clientRecord,
        resolvedData: expect.any(Object),
        resolvedAt: expect.any(Date),
      };

      mockConflictRepository.create.mockReturnValue(mockConflictEntity);
      mockConflictRepository.save.mockResolvedValue(mockConflictEntity);

      // Act
      await resolver.resolve(serverRecord, clientRecord, 'thought');

      // Assert
      expect(mockConflictRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'thought',
          recordId: 'thought-1',
          conflictType: 'simple-client-wins',
          resolutionStrategy: 'client-wins',
          serverData: serverRecord,
          clientData: clientRecord,
        }),
      );
      expect(mockConflictRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should not throw if conflict logging fails', async () => {
      // Arrange
      const serverRecord = { id: 'test-1', last_modified_at: 1000 };
      const clientRecord = { id: 'test-1', last_modified_at: 2000 };

      mockConflictRepository.create.mockReturnValue({});
      mockConflictRepository.save.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert - Should not throw
      await expect(
        resolver.resolve(serverRecord, clientRecord, 'thought'),
      ).resolves.not.toThrow();
    });
  });

  describe('hasConflict', () => {
    it('should detect conflict when server modified after lastPulledAt', () => {
      // Arrange
      const serverRecord = { last_modified_at: 2000 };
      const lastPulledAt = 1000;

      // Act
      const result = resolver.hasConflict(serverRecord, lastPulledAt);

      // Assert
      expect(result).toBe(true);
    });

    it('should not detect conflict when server not modified after lastPulledAt', () => {
      // Arrange
      const serverRecord = { last_modified_at: 1000 };
      const lastPulledAt = 2000;

      // Act
      const result = resolver.hasConflict(serverRecord, lastPulledAt);

      // Assert
      expect(result).toBe(false);
    });

    it('should not detect conflict when timestamps equal', () => {
      // Arrange
      const serverRecord = { last_modified_at: 1000 };
      const lastPulledAt = 1000;

      // Act
      const result = resolver.hasConflict(serverRecord, lastPulledAt);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Unknown Entity Handling', () => {
    it('should handle unknown entity type with client-wins fallback', async () => {
      // Arrange
      const serverRecord = { id: 'unknown-1', data: 'server' };
      const clientRecord = { id: 'unknown-1', data: 'client' };

      mockConflictRepository.create.mockReturnValue({});
      mockConflictRepository.save.mockResolvedValue({});

      // Act
      const result = await resolver.resolve(
        serverRecord,
        clientRecord,
        'unknown-entity' as SyncEntity,
      );

      // Assert
      expect(result.resolvedRecord.data).toBe('client');
      expect(result.strategy).toBe('client-wins');
      expect(result.conflictType).toBe('unknown-entity');
    });
  });
});
