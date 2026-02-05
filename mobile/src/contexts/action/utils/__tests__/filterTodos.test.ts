import { filterTodos, FilterType } from '../filterTodos';
import { Todo } from '../../domain/Todo.model';

describe('filterTodos', () => {
  const now = Date.now();
  const mockTodos: Todo[] = [
    {
      id: '1',
      thoughtId: 'thought-1',
      ideaId: 'idea-1',
      captureId: 'capture-1',
      userId: 'user-1',
      description: 'Active todo 1',
      status: 'todo',
      priority: 'high',
      createdAt: now - 3000,
      updatedAt: now,
    },
    {
      id: '2',
      thoughtId: 'thought-2',
      ideaId: 'idea-2',
      captureId: 'capture-2',
      userId: 'user-1',
      description: 'Completed todo 1',
      status: 'completed',
      priority: 'medium',
      completedAt: now - 1000, // More recent
      createdAt: now - 4000,
      updatedAt: now,
    },
    {
      id: '3',
      thoughtId: 'thought-3',
      ideaId: 'idea-3',
      captureId: 'capture-3',
      userId: 'user-1',
      description: 'Active todo 2',
      status: 'todo',
      priority: 'low',
      createdAt: now - 2000,
      updatedAt: now,
    },
    {
      id: '4',
      thoughtId: 'thought-4',
      ideaId: 'idea-4',
      captureId: 'capture-4',
      userId: 'user-1',
      description: 'Completed todo 2',
      status: 'completed',
      priority: 'high',
      completedAt: now - 2000, // Older
      createdAt: now - 5000,
      updatedAt: now,
    },
  ];

  describe('Filter: all', () => {
    it('should return active todos first, then completed todos', () => {
      const result = filterTodos(mockTodos, 'all');

      expect(result).toHaveLength(4);
      // Active todos first
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
      // Then completed todos
      expect(result[2].id).toBe('2');
      expect(result[3].id).toBe('4');
    });

    it('should handle only active todos', () => {
      const activeTodos = mockTodos.filter((t) => t.status === 'todo');
      const result = filterTodos(activeTodos, 'all');

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'todo')).toBe(true);
    });

    it('should handle only completed todos', () => {
      const completedTodos = mockTodos.filter((t) => t.status === 'completed');
      const result = filterTodos(completedTodos, 'all');

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'completed')).toBe(true);
    });

    it('should handle empty array', () => {
      const result = filterTodos([], 'all');
      expect(result).toEqual([]);
    });
  });

  describe('Filter: active', () => {
    it('should return only active todos', () => {
      const result = filterTodos(mockTodos, 'active');

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'todo')).toBe(true);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });

    it('should return empty array when no active todos', () => {
      const completedTodos = mockTodos.filter((t) => t.status === 'completed');
      const result = filterTodos(completedTodos, 'active');

      expect(result).toEqual([]);
    });

    it('should handle empty array', () => {
      const result = filterTodos([], 'active');
      expect(result).toEqual([]);
    });
  });

  describe('Filter: completed', () => {
    it('should return only completed todos sorted by completedAt DESC', () => {
      const result = filterTodos(mockTodos, 'completed');

      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status === 'completed')).toBe(true);
      // Most recent first (id='2' has completedAt = now - 1000)
      expect(result[0].id).toBe('2');
      expect(result[0].completedAt).toBe(now - 1000);
      // Older second (id='4' has completedAt = now - 2000)
      expect(result[1].id).toBe('4');
      expect(result[1].completedAt).toBe(now - 2000);
    });

    it('should return empty array when no completed todos', () => {
      const activeTodos = mockTodos.filter((t) => t.status === 'todo');
      const result = filterTodos(activeTodos, 'completed');

      expect(result).toEqual([]);
    });

    it('should handle completed todos without completedAt', () => {
      const todosWithoutCompletedAt: Todo[] = [
        {
          id: '5',
          thoughtId: 'thought-5',
          ideaId: 'idea-5',
          captureId: 'capture-5',
          userId: 'user-1',
          description: 'Completed without timestamp',
          status: 'completed',
          priority: 'medium',
          completedAt: undefined, // Missing completedAt
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '6',
          thoughtId: 'thought-6',
          ideaId: 'idea-6',
          captureId: 'capture-6',
          userId: 'user-1',
          description: 'Completed with timestamp',
          status: 'completed',
          priority: 'high',
          completedAt: now - 1000,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const result = filterTodos(todosWithoutCompletedAt, 'completed');

      expect(result).toHaveLength(2);
      // Todos with completedAt should come before those without (DESC sort)
      expect(result[0].id).toBe('6');
      expect(result[1].id).toBe('5');
    });

    it('should handle empty array', () => {
      const result = filterTodos([], 'completed');
      expect(result).toEqual([]);
    });
  });

  describe('Default case', () => {
    it('should return todos unchanged for unknown filter', () => {
      // @ts-expect-error Testing invalid filter type
      const result = filterTodos(mockTodos, 'invalid' as FilterType);

      expect(result).toEqual(mockTodos);
    });
  });

  describe('Edge Cases', () => {
    it('should not mutate original array', () => {
      const originalTodos = [...mockTodos];
      filterTodos(mockTodos, 'all');

      expect(mockTodos).toEqual(originalTodos);
    });

    it('should handle single todo', () => {
      const singleTodo = [mockTodos[0]];

      const resultAll = filterTodos(singleTodo, 'all');
      expect(resultAll).toHaveLength(1);

      const resultActive = filterTodos(singleTodo, 'active');
      expect(resultActive).toHaveLength(1);

      const resultCompleted = filterTodos(singleTodo, 'completed');
      expect(resultCompleted).toHaveLength(0);
    });

    it('should handle large number of todos', () => {
      const largeTodoList: Todo[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `todo-${i}`,
        thoughtId: `thought-${i}`,
        ideaId: `idea-${i}`,
        captureId: `capture-${i}`,
        userId: 'user-1',
        description: `Todo ${i}`,
        status: i % 2 === 0 ? ('todo' as const) : ('completed' as const),
        priority: 'medium' as const,
        completedAt: i % 2 === 0 ? undefined : now - i * 1000,
        createdAt: now - i * 2000,
        updatedAt: now,
      }));

      const resultAll = filterTodos(largeTodoList, 'all');
      expect(resultAll).toHaveLength(1000);
      expect(resultAll.filter((t) => t.status === 'todo')).toHaveLength(500);
      expect(resultAll.filter((t) => t.status === 'completed')).toHaveLength(500);

      const resultActive = filterTodos(largeTodoList, 'active');
      expect(resultActive).toHaveLength(500);

      const resultCompleted = filterTodos(largeTodoList, 'completed');
      expect(resultCompleted).toHaveLength(500);
      // Check sort order (DESC by completedAt)
      for (let i = 1; i < resultCompleted.length; i++) {
        const prevCompletedAt = resultCompleted[i - 1].completedAt ?? 0;
        const currCompletedAt = resultCompleted[i].completedAt ?? 0;
        expect(prevCompletedAt).toBeGreaterThanOrEqual(currCompletedAt);
      }
    });
  });
});
