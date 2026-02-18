/**
 * Thought Repository Tests
 * Covers Subtask 4.8: Add unit tests for repositories
 *
 * Note: These are basic unit tests with mocked DataSource.
 * Integration tests with real database are in BDD tests (Task 10).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { ThoughtRepository } from './thought.repository';
import { Thought } from '../../domain/entities/thought.entity';
import { Idea } from '../../domain/entities/idea.entity';

describe('ThoughtRepository', () => {
  let repository: ThoughtRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockThoughtRepo: jest.Mocked<Repository<Thought>>;
  let mockIdeaRepo: jest.Mocked<Repository<Idea>>;

  beforeEach(async () => {
    // Mock repositories
    mockThoughtRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockIdeaRepo = {
      // Idea repo methods if needed
    } as any;

    // Mock DataSource
    mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Thought) return mockThoughtRepo;
        if (entity === Idea) return mockIdeaRepo;
        return null;
      }),
      transaction: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThoughtRepository,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<ThoughtRepository>(ThoughtRepository);
  });

  describe('createWithIdeas', () => {
    it('should create Thought with Ideas in a transaction', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const summary = 'Test summary text';
      const ideas = ['Idea 1', 'Idea 2', 'Idea 3'];
      const processingTimeMs = 2500;

      const mockThought: Thought = {
        id: 'thought-789',
        captureId,
        ownerId: userId,
        summary,
        processingTimeMs,
        statusId: 'd0000000-0000-7000-8000-000000000001',
        lastModifiedAt: Date.now(),
        ideas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const mockIdeas: Idea[] = ideas.map((text, index) => ({
        id: `idea-${index}`,
        thoughtId: mockThought.id,
        ownerId: userId,
        text,
        orderIndex: index,
        createdAt: new Date(),
        updatedAt: new Date(),
        thought: mockThought,
      }));

      // Mock transaction to execute callback immediately
      mockDataSource.transaction.mockImplementation(async (callback) => {
        const mockManager = {
          create: jest.fn((entity, data) => ({ ...data })),
          save: jest.fn((entity, data) => {
            if (entity === Thought) {
              return Promise.resolve({ ...data, id: mockThought.id });
            }
            if (entity === Idea) {
              return Promise.resolve(mockIdeas);
            }
          }),
        };
        return await callback(mockManager as any);
      });

      const result = await repository.createWithIdeas(
        captureId,
        userId,
        summary,
        ideas,
        processingTimeMs,
      );

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should find Thought by ID with Ideas', async () => {
      const thoughtId = 'thought-123';
      const mockThought: Thought = {
        id: thoughtId,
        captureId: 'capture-456',
        ownerId: 'user-789',
        summary: 'Test summary',
        processingTimeMs: 1000,
        statusId: 'd0000000-0000-7000-8000-000000000001',
        lastModifiedAt: Date.now(),
        ideas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockThoughtRepo.findOne.mockResolvedValue(mockThought);

      const result = await repository.findById(thoughtId);

      expect(result).toEqual(mockThought);
      expect(mockThoughtRepo.findOne).toHaveBeenCalledWith({
        where: { id: thoughtId },
        relations: ['ideas'],
      });
    });

    it('should return null if Thought not found', async () => {
      mockThoughtRepo.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all Thoughts for a user', async () => {
      const userId = 'user-123';
      const mockThoughts: Thought[] = [
        {
          id: 'thought-1',
          captureId: 'capture-1',
          ownerId: userId,
          summary: 'Summary 1',
          processingTimeMs: 1000,
          statusId: 'd0000000-0000-7000-8000-000000000001',
          lastModifiedAt: Date.now(),
          ideas: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      mockThoughtRepo.find.mockResolvedValue(mockThoughts);

      const result = await repository.findByUserId(userId);

      expect(result).toEqual(mockThoughts);
      expect(mockThoughtRepo.find).toHaveBeenCalledWith({
        where: { ownerId: userId },
        relations: ['ideas'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByCaptureId', () => {
    it('should find Thought by Capture ID', async () => {
      const captureId = 'capture-123';
      const mockThought: Thought = {
        id: 'thought-456',
        captureId,
        ownerId: 'user-789',
        summary: 'Test summary',
        processingTimeMs: 1000,
        statusId: 'd0000000-0000-7000-8000-000000000001',
        lastModifiedAt: Date.now(),
        ideas: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockThoughtRepo.findOne.mockResolvedValue(mockThought);

      const result = await repository.findByCaptureId(captureId);

      expect(result).toEqual(mockThought);
      expect(mockThoughtRepo.findOne).toHaveBeenCalledWith({
        where: { captureId },
        relations: ['ideas'],
      });
    });
  });

  describe('delete', () => {
    it('should delete Thought by ID', async () => {
      const thoughtId = 'thought-123';

      mockThoughtRepo.delete.mockResolvedValue({ affected: 1, raw: {} });

      await repository.delete(thoughtId);

      expect(mockThoughtRepo.delete).toHaveBeenCalledWith(thoughtId);
    });
  });
});
