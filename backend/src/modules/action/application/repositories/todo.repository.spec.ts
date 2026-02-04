/**
 * Todo Repository Tests
 * Story 4.3 - Subtask 2.7: Add unit tests for TodoRepository
 *
 * Note: These are basic unit tests with mocked DataSource.
 * Integration tests with real database are in BDD tests (Task 10).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { TodoRepository, CreateTodoDto } from './todo.repository';
import { Todo } from '../../domain/entities/todo.entity';

describe('TodoRepository', () => {
  let repository: TodoRepository;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockTodoRepo: jest.Mocked<Repository<Todo>>;

  beforeEach(async () => {
    // Mock repository
    mockTodoRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    // Mock DataSource
    mockDataSource = {
      getRepository: jest.fn((entity) => {
        if (entity === Todo) return mockTodoRepo;
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoRepository,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    repository = module.get<TodoRepository>(TodoRepository);
  });

  describe('create', () => {
    it('should create a single Todo', async () => {
      const dto: CreateTodoDto = {
        thoughtId: 'thought-123',
        captureId: 'capture-456',
        userId: 'user-789',
        description: 'Send invoice to client',
        deadline: new Date('2026-02-07'),
        deadlineConfidence: 1.0,
        priority: 'high',
        priorityConfidence: 0.9,
      };

      const mockTodo: Todo = {
        id: 'todo-abc',
        ...dto,
        status: 'todo',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockTodoRepo.create.mockReturnValue(mockTodo);
      mockTodoRepo.save.mockResolvedValue(mockTodo);

      const result = await repository.create(dto);

      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
      expect(mockTodoRepo.save).toHaveBeenCalledWith(mockTodo);
      expect(result).toEqual(mockTodo);
    });

    it('should default status to "todo" if not provided', async () => {
      const dto: CreateTodoDto = {
        thoughtId: 'thought-123',
        captureId: 'capture-456',
        userId: 'user-789',
        description: 'Buy milk',
        priority: 'low',
      };

      const mockTodo = { ...dto, id: 'todo-abc', status: 'todo' } as any;

      mockTodoRepo.create.mockReturnValue(mockTodo);
      mockTodoRepo.save.mockResolvedValue(mockTodo);

      const result = await repository.create(dto);

      expect(result.status).toBe('todo');
    });
  });

  describe('createManyInTransaction', () => {
    it('should create multiple Todos within a transaction', async () => {
      const dtos: CreateTodoDto[] = [
        {
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          userId: 'user-789',
          description: 'Send invoice',
          deadline: new Date('2026-02-07'),
          priority: 'high',
        },
        {
          thoughtId: 'thought-123',
          captureId: 'capture-456',
          userId: 'user-789',
          description: 'Buy milk',
          priority: 'low',
        },
      ];

      const mockTodos: Todo[] = dtos.map((dto, index) => ({
        id: `todo-${index}`,
        ...dto,
        status: 'todo',
        createdAt: new Date(),
        updatedAt: new Date(),
      })) as any;

      const mockManager: Partial<EntityManager> = {
        create: jest.fn((entity, data) => ({ ...data })),
        save: jest.fn().mockResolvedValue(mockTodos),
      };

      const result = await repository.createManyInTransaction(
        mockManager as EntityManager,
        dtos,
      );

      expect(mockManager.create).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenCalledWith(Todo, expect.any(Array));
      expect(result).toHaveLength(2);
      expect(result).toEqual(mockTodos);
    });

    it('should return empty array if no dtos provided', async () => {
      const mockManager = {} as EntityManager;
      const result = await repository.createManyInTransaction(mockManager, []);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find Todo by ID with relations', async () => {
      const todoId = 'todo-123';
      const mockTodo = {
        id: todoId,
        description: 'Test todo',
      } as any;

      mockTodoRepo.findOne.mockResolvedValue(mockTodo);

      const result = await repository.findById(todoId);

      expect(mockTodoRepo.findOne).toHaveBeenCalledWith({
        where: { id: todoId },
        relations: ['thought', 'idea'],
      });
      expect(result).toEqual(mockTodo);
    });
  });

  describe('findByThoughtId', () => {
    it('should find all Todos for a Thought', async () => {
      const thoughtId = 'thought-123';
      const mockTodos = [
        { id: 'todo-1', thoughtId, description: 'Todo 1' },
        { id: 'todo-2', thoughtId, description: 'Todo 2' },
      ] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.findByThoughtId(thoughtId);

      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        where: { thoughtId },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockTodos);
      expect(result).toHaveLength(2);
    });
  });

  describe('findByUserId', () => {
    it('should find all Todos for a user', async () => {
      const userId = 'user-789';
      const mockTodos = [{ id: 'todo-1', userId }] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.findByUserId(userId);

      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        where: { userId },
        order: { deadline: 'ASC', priority: 'DESC', createdAt: 'ASC' },
        relations: ['thought'],
      });
      expect(result).toEqual(mockTodos);
    });

    it('should filter by status if provided', async () => {
      const userId = 'user-789';
      const status = 'completed';
      const mockTodos = [{ id: 'todo-1', userId, status }] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.findByUserId(userId, status);

      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        where: { userId, status },
        order: { deadline: 'ASC', priority: 'DESC', createdAt: 'ASC' },
        relations: ['thought'],
      });
      expect(result).toEqual(mockTodos);
    });
  });

  describe('findByCaptureId', () => {
    it('should find all Todos for a Capture', async () => {
      const captureId = 'capture-456';
      const mockTodos = [
        { id: 'todo-1', captureId },
        { id: 'todo-2', captureId },
      ] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.findByCaptureId(captureId);

      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        where: { captureId },
        order: { createdAt: 'ASC' },
      });
      expect(result).toEqual(mockTodos);
    });
  });

  describe('updateStatus', () => {
    it('should update Todo status', async () => {
      const todoId = 'todo-123';
      const newStatus = 'completed';
      const mockTodo = {
        id: todoId,
        status: 'todo',
      } as any;

      const updatedTodo = { ...mockTodo, status: newStatus, completedAt: expect.any(Date) };

      mockTodoRepo.findOne.mockResolvedValue(mockTodo);
      mockTodoRepo.save.mockResolvedValue(updatedTodo);

      const result = await repository.updateStatus(todoId, newStatus);

      expect(mockTodoRepo.findOne).toHaveBeenCalledWith({
        where: { id: todoId },
      });
      expect(result.status).toBe(newStatus);
    });

    it('should set completedAt when marking as completed', async () => {
      const todoId = 'todo-123';
      const mockTodo = {
        id: todoId,
        status: 'todo',
        completedAt: null,
      } as any;

      mockTodoRepo.findOne.mockResolvedValue(mockTodo);
      mockTodoRepo.save.mockImplementation((todo) =>
        Promise.resolve({ ...todo }),
      );

      const result = await repository.updateStatus(todoId, 'completed');

      expect(result.completedAt).toBeDefined();
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should throw error if Todo not found', async () => {
      const todoId = 'nonexistent';
      mockTodoRepo.findOne.mockResolvedValue(null);

      await expect(repository.updateStatus(todoId, 'completed')).rejects.toThrow(
        `Todo not found: ${todoId}`,
      );
    });
  });

  describe('update', () => {
    it('should update Todo fields', async () => {
      const todoId = 'todo-123';
      const mockTodo = {
        id: todoId,
        description: 'Old description',
        priority: 'low',
      } as any;

      const updates = {
        description: 'New description',
        priority: 'high' as const,
      };

      mockTodoRepo.findOne.mockResolvedValue(mockTodo);
      mockTodoRepo.save.mockResolvedValue({ ...mockTodo, ...updates });

      const result = await repository.update(todoId, updates);

      expect(result.description).toBe(updates.description);
      expect(result.priority).toBe(updates.priority);
    });

    it('should throw error if Todo not found', async () => {
      const todoId = 'nonexistent';
      mockTodoRepo.findOne.mockResolvedValue(null);

      await expect(
        repository.update(todoId, { priority: 'high' }),
      ).rejects.toThrow(`Todo not found: ${todoId}`);
    });
  });

  describe('delete', () => {
    it('should delete Todo', async () => {
      const todoId = 'todo-123';
      mockTodoRepo.delete.mockResolvedValue(undefined as any);

      await repository.delete(todoId);

      expect(mockTodoRepo.delete).toHaveBeenCalledWith(todoId);
    });
  });

  describe('findAll', () => {
    it('should find all Todos', async () => {
      const mockTodos = [
        { id: 'todo-1', description: 'Todo 1' },
        { id: 'todo-2', description: 'Todo 2' },
      ] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.findAll();

      expect(mockTodoRepo.find).toHaveBeenCalledWith({
        relations: ['thought'],
      });
      expect(result).toEqual(mockTodos);
    });
  });

  describe('countByStatus', () => {
    it('should count Todos by status', async () => {
      const userId = 'user-789';
      const mockTodos = [
        { status: 'todo' },
        { status: 'todo' },
        { status: 'completed' },
        { status: 'in_progress' },
      ] as any;

      mockTodoRepo.find.mockResolvedValue(mockTodos);

      const result = await repository.countByStatus(userId);

      expect(result.todo).toBe(2);
      expect(result.completed).toBe(1);
      expect(result.in_progress).toBe(1);
      expect(result.launched).toBe(0);
      expect(result.abandoned).toBe(0);
    });
  });
});
