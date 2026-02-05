/**
 * useToggleTodoStatus Hook Unit Tests
 *
 * Story 5.1 - Subtask 5.10: Add unit tests for toggleTodoStatus
 * AC8, FR19: Checkbox toggle with optimistic UI and rollback
 */

import 'reflect-metadata'; // Required for TSyringe
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useToggleTodoStatus } from '../useToggleTodoStatus';
import { container } from 'tsyringe';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { ITodoRepository } from '../../domain/ITodoRepository';
import { Todo } from '../../domain/Todo.model';

// Mock TodoRepository
const mockTodoRepository: jest.Mocked<ITodoRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdeaId: jest.fn(),
  findByThoughtId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  toggleStatus: jest.fn(),
  getAll: jest.fn(),
};

// Setup QueryClient for tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component with QueryClientProvider
function createWrapper() {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useToggleTodoStatus', () => {
  beforeAll(() => {
    // Register mock repository in container
    container.registerInstance(TOKENS.ITodoRepository, mockTodoRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.clearInstances();
  });

  it('should toggle todo status from todo to completed', async () => {
    const todoId = 'test-todo-id';
    const mockTodo: Todo = {
      id: todoId,
      thoughtId: 'thought-1',
      ideaId: 'idea-1',
      captureId: 'capture-1',
      userId: 'user-1',
      description: 'Test todo',
      status: 'completed',
      priority: 'medium',
      completedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockTodoRepository.toggleStatus.mockResolvedValue(mockTodo);

    const { result } = renderHook(() => useToggleTodoStatus(), {
      wrapper: createWrapper(),
    });

    // Trigger mutation
    result.current.mutate(todoId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify toggleStatus was called with correct todoId
    expect(mockTodoRepository.toggleStatus).toHaveBeenCalledWith(todoId);
    expect(mockTodoRepository.toggleStatus).toHaveBeenCalledTimes(1);

    // Verify mutation data
    expect(result.current.data).toEqual(mockTodo);
  });

  it('should toggle todo status from completed to todo', async () => {
    const todoId = 'test-todo-id-2';
    const mockTodo: Todo = {
      id: todoId,
      thoughtId: 'thought-1',
      ideaId: 'idea-1',
      captureId: 'capture-1',
      userId: 'user-1',
      description: 'Test todo',
      status: 'todo',
      priority: 'high',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockTodoRepository.toggleStatus.mockResolvedValue(mockTodo);

    const { result } = renderHook(() => useToggleTodoStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(todoId);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockTodoRepository.toggleStatus).toHaveBeenCalledWith(todoId);
    expect(result.current.data).toEqual(mockTodo);
  });

  it('should handle error when toggle fails', async () => {
    const todoId = 'test-todo-id-3';
    const mockError = new Error('Todo not found');

    mockTodoRepository.toggleStatus.mockRejectedValue(mockError);

    const { result } = renderHook(() => useToggleTodoStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(todoId);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockTodoRepository.toggleStatus).toHaveBeenCalledWith(todoId);
    expect(result.current.error).toEqual(mockError);
  });

  it('should call onError callback on mutation failure', async () => {
    const todoId = 'test-todo-id-4';
    const mockError = new Error('Database error');
    const onErrorSpy = jest.fn();

    mockTodoRepository.toggleStatus.mockRejectedValue(mockError);

    const { result } = renderHook(() => useToggleTodoStatus(), {
      wrapper: createWrapper(),
    });

    result.current.mutate(todoId, {
      onError: onErrorSpy,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // onError is called with (error, variables, context, meta)
    // context contains previousTodos from onMutate
    expect(onErrorSpy).toHaveBeenCalled();
    expect(onErrorSpy.mock.calls[0][0]).toEqual(mockError);
    expect(onErrorSpy.mock.calls[0][1]).toBe(todoId);
  });

  it('should have reset method available', async () => {
    const { result } = renderHook(() => useToggleTodoStatus(), {
      wrapper: createWrapper(),
    });

    // Verify reset method exists (testing React Query integration)
    expect(typeof result.current.reset).toBe('function');
  });
});
