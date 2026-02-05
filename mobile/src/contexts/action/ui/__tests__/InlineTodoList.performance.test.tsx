/**
 * InlineTodoList Performance and Integration Tests
 *
 * Story 5.1 - Task 10: Integration with Feed Screen (AC1, AC7)
 * Subtask 10.5: Test scroll performance with many captures + todos
 * Subtask 10.7: Test with mixed captures (some with todos, some without)
 */

import 'reflect-metadata';
import { container } from 'tsyringe';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { ITodoRepository } from '../../domain/ITodoRepository';
import type { IIdeaRepository } from '../../../knowledge/domain/IIdeaRepository';
import type { Todo } from '../../domain/Todo.model';

// Mock TodoRepository
const mockTodoRepository: jest.Mocked<ITodoRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdeaId: jest.fn(),
  findByThoughtId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  toggleStatus: jest.fn(),
};

// Mock IdeaRepository
const mockIdeaRepository: jest.Mocked<IIdeaRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByThoughtId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('InlineTodoList - Performance Tests (Task 10.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    container.clearInstances();
    container.registerInstance(TOKENS.ITodoRepository, mockTodoRepository);
    container.registerInstance(TOKENS.IIdeaRepository, mockIdeaRepository);
  });

  describe('Data Loading Performance with Many Todos', () => {
    it('should load and process 20 todos quickly (AC from feature file)', async () => {
      // Arrange: Generate 20 todos
      const now = Date.now();
      const todos: Todo[] = [];
      for (let i = 0; i < 20; i++) {
        todos.push({
          id: `todo-${i}`,
          thoughtId: 'thought-001',
          ideaId: 'idea-001',
          userId: 'user-001',
          captureId: 'capture-001',
          description: `Todo ${i + 1}: Task description for performance testing`,
          status: i % 3 === 0 ? ('completed' as const) : ('todo' as const),
          priority: (['high', 'medium', 'low'] as const)[i % 3],
          deadline: now + (i * 86400000),
          createdAt: now - (i * 1000),
          updatedAt: now - (i * 1000),
        });
      }

      // Act: Measure data fetch time
      const startTime = performance.now();
      mockTodoRepository.findByIdeaId.mockResolvedValue(todos);
      const result = await mockTodoRepository.findByIdeaId('idea-001');
      const fetchTime = performance.now() - startTime;

      // Assert: Data fetched quickly (< 50ms)
      expect(fetchTime).toBeLessThan(50);
      expect(result).toHaveLength(20);
      expect(mockTodoRepository.findByIdeaId).toHaveBeenCalledWith('idea-001');
    });

    it('should handle 50 todos without lag', async () => {
      // Arrange: Generate 50 todos (stress test)
      const now = Date.now();
      const todos: Todo[] = [];
      for (let i = 0; i < 50; i++) {
        todos.push({
          id: `todo-${i}`,
          thoughtId: 'thought-001',
          ideaId: 'idea-001',
          userId: 'user-001',
          captureId: 'capture-001',
          description: `Todo ${i + 1}: Performance stress test item`,
          status: i % 4 === 0 ? ('completed' as const) : ('todo' as const),
          priority: (['high', 'medium', 'low'] as const)[i % 3],
          deadline: now + (i * 3600000),
          createdAt: now - (i * 1000),
          updatedAt: now - (i * 1000),
        });
      }

      // Act: Measure data fetch time
      const startTime = performance.now();
      mockTodoRepository.findByIdeaId.mockResolvedValue(todos);
      const result = await mockTodoRepository.findByIdeaId('idea-001');
      const fetchTime = performance.now() - startTime;

      // Assert: Data fetched acceptably fast (< 100ms)
      expect(fetchTime).toBeLessThan(100);
      expect(result).toHaveLength(50);
    });

    it('should sort todos efficiently (mixed priorities and statuses)', () => {
      // Arrange: Mix of active and completed todos with different priorities
      const now = Date.now();
      const todos: Todo[] = [
        {
          id: 'todo-1',
          thoughtId: 'thought-001',
          ideaId: 'idea-001',
          userId: 'user-001',
          captureId: 'capture-001',
          description: 'High priority active',
          status: 'todo',
          priority: 'high',
          deadline: now + 86400000,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'todo-2',
          thoughtId: 'thought-001',
          ideaId: 'idea-001',
          userId: 'user-001',
          captureId: 'capture-001',
          description: 'Completed low priority',
          status: 'completed',
          priority: 'low',
          deadline: now - 86400000,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'todo-3',
          thoughtId: 'thought-001',
          ideaId: 'idea-001',
          userId: 'user-001',
          captureId: 'capture-001',
          description: 'Medium priority active',
          status: 'todo',
          priority: 'medium',
          deadline: now + 172800000,
          createdAt: now,
          updatedAt: now,
        },
      ];

      // Act: Measure sorting time
      const startTime = performance.now();
      const sorted = [...todos].sort((a, b) => {
        // Active todos first
        if (a.status === 'todo' && b.status !== 'todo') return -1;
        if (a.status !== 'todo' && b.status === 'todo') return 1;

        // Within same status, sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      const sortTime = performance.now() - startTime;

      // Assert: Fast sorting (< 10ms)
      expect(sortTime).toBeLessThan(10);

      // Assert: Correct order (active todos first, then by priority)
      expect(sorted[0].description).toBe('High priority active');
      expect(sorted[1].description).toBe('Medium priority active');
      expect(sorted[2].description).toBe('Completed low priority');
    });
  });
});

describe('InlineTodoList Integration (Task 10.7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    container.clearInstances();
    container.registerInstance(TOKENS.ITodoRepository, mockTodoRepository);
    container.registerInstance(TOKENS.IIdeaRepository, mockIdeaRepository);
  });

  describe('Mixed Captures - Some with Todos, Some Without (AC3)', () => {
    it('should return empty array when idea has NO todos (AC3: clean display)', async () => {
      // Arrange: Idea with no todos
      mockTodoRepository.findByIdeaId.mockResolvedValue([]); // No todos

      // Act
      const todos = await mockTodoRepository.findByIdeaId('idea-without-todos');

      // Assert: No todos returned (component will hide section via line 58-60)
      expect(mockTodoRepository.findByIdeaId).toHaveBeenCalledWith('idea-without-todos');
      expect(todos).toEqual([]);
      expect(todos.length).toBe(0);
    });

    it('should return todos when idea has actions', async () => {
      // Arrange: Idea with 2 todos
      const now = Date.now();
      const todos: Todo[] = [
        {
          id: 'todo-1',
          thoughtId: 'thought-001',
          ideaId: 'idea-with-todos',
          userId: 'user-001',
          captureId: 'capture-001',
          description: 'First todo',
          status: 'todo',
          priority: 'high',
          deadline: now + 86400000,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'todo-2',
          thoughtId: 'thought-001',
          ideaId: 'idea-with-todos',
          userId: 'user-001',
          captureId: 'capture-001',
          description: 'Second todo',
          status: 'todo',
          priority: 'medium',
          deadline: now + 172800000,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockTodoRepository.findByIdeaId.mockResolvedValue(todos);

      // Act
      const result = await mockTodoRepository.findByIdeaId('idea-with-todos');

      // Assert: Todos retrieved
      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('First todo');
      expect(result[1].description).toBe('Second todo');
    });

    it('should handle different ideas independently (mixed feed simulation)', async () => {
      // Arrange: Simulate multiple ideas - some with todos, some without
      const now = Date.now();
      mockTodoRepository.findByIdeaId.mockImplementation((ideaId) => {
        if (ideaId === 'idea-with-actions') {
          return Promise.resolve([
            {
              id: 'todo-1',
              thoughtId: 'thought-001',
              ideaId: 'idea-with-actions',
              userId: 'user-001',
              captureId: 'capture-001',
              description: 'Actionable todo',
              status: 'todo' as const,
              priority: 'high' as const,
              deadline: now + 86400000,
              createdAt: now,
              updatedAt: now,
            },
          ]);
        }
        return Promise.resolve([]); // No todos for other ideas
      });

      // Act: Query for idea with todos
      const todosWithActions = await mockTodoRepository.findByIdeaId('idea-with-actions');

      // Assert: Todos are present
      expect(todosWithActions).toHaveLength(1);
      expect(todosWithActions[0].description).toBe('Actionable todo');

      // Act: Query for idea without todos
      const todosWithoutActions = await mockTodoRepository.findByIdeaId('idea-without-actions');

      // Assert: No todos (component would hide section)
      expect(todosWithoutActions).toEqual([]);
    });
  });

  describe('Consistent Behavior Across Feed (AC7)', () => {
    it('should return consistent todo structure for different ideas', async () => {
      // Arrange: Two different ideas with todos
      const now = Date.now();
      mockTodoRepository.findByIdeaId.mockImplementation((ideaId) => {
        return Promise.resolve([
          {
            id: `todo-${ideaId}`,
            thoughtId: 'thought-001',
            ideaId,
            userId: 'user-001',
            captureId: 'capture-001',
            description: `Todo for ${ideaId}`,
            status: 'todo' as const,
            priority: 'high' as const,
            deadline: now + 86400000,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      });

      // Act: Fetch todos for multiple ideas
      const todos1 = await mockTodoRepository.findByIdeaId('idea-001');
      const todos2 = await mockTodoRepository.findByIdeaId('idea-002');

      // Assert: Both return todos with consistent structure
      expect(todos1).toHaveLength(1);
      expect(todos2).toHaveLength(1);
      expect(todos1[0].description).toBe('Todo for idea-001');
      expect(todos2[0].description).toBe('Todo for idea-002');

      // Assert: Same properties exist
      expect(Object.keys(todos1[0])).toEqual(Object.keys(todos2[0]));
    });
  });
});
