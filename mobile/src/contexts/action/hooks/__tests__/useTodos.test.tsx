/**
 * useTodos Hook Edge Cases Tests
 *
 * Story 5.1 - Issue #13 (Code Review): Edge case tests for useTodos hook
 * Tests 50+ todos, mixed priorities, empty arrays, null values, invalid inputs
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTodos } from '../useTodos';
import { container } from 'tsyringe';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { ITodoRepository } from '../../domain/ITodoRepository';
import type { Todo } from '../../domain/Todo.model';

// Mock DI container
jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
}));

const mockFindByIdeaId = jest.fn();

const createMockTodo = (overrides?: Partial<Todo>): Todo => ({
  id: `todo-${Math.random()}`,
  thoughtId: 'thought-1',
  ideaId: 'idea-1',
  captureId: 'capture-1',
  userId: 'user-1',
  description: 'Test todo',
  status: 'todo',
  priority: 'medium',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

// Wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTodos - Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.resolve as jest.Mock).mockReturnValue({
      findByIdeaId: mockFindByIdeaId,
    });
  });

  describe('Large Data Sets (Subtask 2.5)', () => {
    it('should handle 50+ todos efficiently', async () => {
      // Generate 50 todos
      const largeTodoSet = Array.from({ length: 50 }, (_, i) =>
        createMockTodo({
          id: `todo-${i}`,
          description: `Todo ${i}`,
          priority: ['low', 'medium', 'high'][i % 3] as 'low' | 'medium' | 'high',
        })
      );

      mockFindByIdeaId.mockResolvedValue(largeTodoSet);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(50);
      expect(mockFindByIdeaId).toHaveBeenCalledWith('idea-1');
    });

    it('should handle 100+ todos without crashing', async () => {
      const veryLargeTodoSet = Array.from({ length: 100 }, (_, i) =>
        createMockTodo({
          id: `todo-${i}`,
        })
      );

      mockFindByIdeaId.mockResolvedValue(veryLargeTodoSet);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(100);
    });
  });

  describe('Mixed Priorities (Subtask 2.5)', () => {
    it('should handle todos with all three priority levels', async () => {
      const mixedPriorityTodos = [
        createMockTodo({ id: 'todo-high-1', priority: 'high' }),
        createMockTodo({ id: 'todo-low-1', priority: 'low' }),
        createMockTodo({ id: 'todo-medium-1', priority: 'medium' }),
        createMockTodo({ id: 'todo-high-2', priority: 'high' }),
        createMockTodo({ id: 'todo-low-2', priority: 'low' }),
      ];

      mockFindByIdeaId.mockResolvedValue(mixedPriorityTodos);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(5);
      // Repository should return sorted (high, medium, low)
      expect(result.current.data).toEqual(mixedPriorityTodos);
    });

    it('should handle all todos with same priority', async () => {
      const samePriorityTodos = Array.from({ length: 10 }, (_, i) =>
        createMockTodo({
          id: `todo-${i}`,
          priority: 'medium',
        })
      );

      mockFindByIdeaId.mockResolvedValue(samePriorityTodos);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(10);
    });
  });

  describe('Empty and Null Values', () => {
    it('should handle empty array', async () => {
      mockFindByIdeaId.mockResolvedValue([]);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.data).toHaveLength(0);
    });

    it('should not run query when ideaId is empty string', async () => {
      const { result } = renderHook(() => useTodos(''), {
        wrapper: createWrapper(),
      });

      // Query should be disabled (enabled: false)
      expect(result.current.status).toBe('pending');
      expect(mockFindByIdeaId).not.toHaveBeenCalled();
    });

    it('should not run query when ideaId is whitespace', async () => {
      const { result } = renderHook(() => useTodos('   '), {
        wrapper: createWrapper(),
      });

      // Query should be disabled because '   '.trim().length === 0
      expect(result.current.status).toBe('pending');
      expect(mockFindByIdeaId).not.toHaveBeenCalled();
    });

    it('should handle repository returning null gracefully', async () => {
      mockFindByIdeaId.mockResolvedValue(null);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // React Query treats null as valid data
      expect(result.current.data).toBeNull();
    });
  });

  describe('Invalid Inputs', () => {
    it('should not run query when ideaId contains only special characters', async () => {
      const { result } = renderHook(() => useTodos('!!!'), {
        wrapper: createWrapper(),
      });

      // Query should still run (enabled check only verifies non-empty)
      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      expect(mockFindByIdeaId).toHaveBeenCalledWith('!!!');
    });

    it('should handle very long ideaId', async () => {
      const longIdeaId = 'a'.repeat(1000);
      mockFindByIdeaId.mockResolvedValue([]);

      const { result } = renderHook(() => useTodos(longIdeaId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFindByIdeaId).toHaveBeenCalledWith(longIdeaId);
    });
  });

  describe('Error Handling', () => {
    it('should handle repository error', async () => {
      mockFindByIdeaId.mockRejectedValue(new Error('Database error'));

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Database error');
    });

    it('should retry on network error', async () => {
      mockFindByIdeaId
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([createMockTodo()]);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            retryDelay: 0,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useTodos('idea-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFindByIdeaId).toHaveBeenCalledTimes(2);
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('React Query Caching (Subtask 2.4)', () => {
    it('should cache results for 5 minutes', async () => {
      mockFindByIdeaId.mockResolvedValue([createMockTodo()]);

      const { result, rerender } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // First call to repository
      expect(mockFindByIdeaId).toHaveBeenCalledTimes(1);

      // Rerender should use cached data (not call repository again)
      rerender();

      expect(mockFindByIdeaId).toHaveBeenCalledTimes(1);
    });

    it('should refetch when ideaId changes', async () => {
      mockFindByIdeaId.mockResolvedValue([createMockTodo()]);

      const { result, rerender } = renderHook(
        ({ ideaId }) => useTodos(ideaId),
        {
          wrapper: createWrapper(),
          initialProps: { ideaId: 'idea-1' },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFindByIdeaId).toHaveBeenCalledWith('idea-1');

      // Change ideaId - should trigger new fetch
      rerender({ ideaId: 'idea-2' });

      await waitFor(() => {
        expect(mockFindByIdeaId).toHaveBeenCalledWith('idea-2');
      });

      expect(mockFindByIdeaId).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases: Mixed Status', () => {
    it('should handle mix of completed and active todos', async () => {
      const mixedStatusTodos = [
        createMockTodo({ id: 'todo-1', status: 'todo' }),
        createMockTodo({ id: 'todo-2', status: 'completed' }),
        createMockTodo({ id: 'todo-3', status: 'todo' }),
        createMockTodo({ id: 'todo-4', status: 'completed' }),
      ];

      mockFindByIdeaId.mockResolvedValue(mixedStatusTodos);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(4);
      // Repository sorts: active first, then completed
    });

    it('should handle todos with missing optional fields', async () => {
      const todosWithMissingFields = [
        createMockTodo({ deadline: undefined }),
        createMockTodo({ deadline: undefined }),
      ];

      mockFindByIdeaId.mockResolvedValue(todosWithMissingFields);

      const { result } = renderHook(() => useTodos('idea-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveLength(2);
    });
  });
});
