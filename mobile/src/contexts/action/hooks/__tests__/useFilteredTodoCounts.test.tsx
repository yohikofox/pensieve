/**
 * useFilteredTodoCounts Hook Tests
 * Story 5.3 - Task 3: Filter badge count tests
 */

import 'reflect-metadata';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { container } from 'tsyringe';
import { ITodoRepository } from '../../domain/ITodoRepository';
import { useFilteredTodoCounts } from '../useFilteredTodoCounts';
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
  findAll: jest.fn(),
  countActive: jest.fn(),
  countByStatus: jest.fn(),
  findAllWithSource: jest.fn(),
};

// Register mock in DI container
container.registerInstance<ITodoRepository>('TodoRepository', mockTodoRepository);

// Test wrapper with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useFilteredTodoCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all counts from repository', async () => {
    // Arrange
    const mockTodos: Todo[] = [
      {
        id: '1',
        thoughtId: 'thought-1',
        ideaId: 'idea-1',
        captureId: 'capture-1',
        userId: 'user-1',
        description: 'Todo 1',
        status: 'todo',
        priority: 'high',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: '2',
        thoughtId: 'thought-2',
        ideaId: 'idea-2',
        captureId: 'capture-2',
        userId: 'user-1',
        description: 'Todo 2',
        status: 'completed',
        priority: 'medium',
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    mockTodoRepository.findAll.mockResolvedValue(mockTodos);
    mockTodoRepository.countByStatus.mockImplementation(async (status) => {
      if (status === 'todo') return 1;
      if (status === 'completed') return 1;
      return 0;
    });

    // Act
    const { result } = renderHook(() => useFilteredTodoCounts(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(2);
    expect(result.current.active).toBe(1);
    expect(result.current.completed).toBe(1);
    expect(mockTodoRepository.findAll).toHaveBeenCalledTimes(1);
    expect(mockTodoRepository.countByStatus).toHaveBeenCalledWith('todo');
    expect(mockTodoRepository.countByStatus).toHaveBeenCalledWith('completed');
  });

  it('should return 0 for all counts when no todos', async () => {
    // Arrange
    mockTodoRepository.findAll.mockResolvedValue([]);
    mockTodoRepository.countByStatus.mockResolvedValue(0);

    // Act
    const { result } = renderHook(() => useFilteredTodoCounts(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(0);
    expect(result.current.active).toBe(0);
    expect(result.current.completed).toBe(0);
  });

  it('should handle only active todos', async () => {
    // Arrange
    const mockActiveTodos: Todo[] = [
      {
        id: '1',
        thoughtId: 'thought-1',
        ideaId: 'idea-1',
        captureId: 'capture-1',
        userId: 'user-1',
        description: 'Todo 1',
        status: 'todo',
        priority: 'high',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: '2',
        thoughtId: 'thought-2',
        ideaId: 'idea-2',
        captureId: 'capture-2',
        userId: 'user-1',
        description: 'Todo 2',
        status: 'todo',
        priority: 'medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    mockTodoRepository.findAll.mockResolvedValue(mockActiveTodos);
    mockTodoRepository.countByStatus.mockImplementation(async (status) => {
      if (status === 'todo') return 2;
      if (status === 'completed') return 0;
      return 0;
    });

    // Act
    const { result } = renderHook(() => useFilteredTodoCounts(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(2);
    expect(result.current.active).toBe(2);
    expect(result.current.completed).toBe(0);
  });

  it('should handle only completed todos', async () => {
    // Arrange
    const mockCompletedTodos: Todo[] = [
      {
        id: '1',
        thoughtId: 'thought-1',
        ideaId: 'idea-1',
        captureId: 'capture-1',
        userId: 'user-1',
        description: 'Todo 1',
        status: 'completed',
        priority: 'high',
        completedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    mockTodoRepository.findAll.mockResolvedValue(mockCompletedTodos);
    mockTodoRepository.countByStatus.mockImplementation(async (status) => {
      if (status === 'todo') return 0;
      if (status === 'completed') return 1;
      return 0;
    });

    // Act
    const { result } = renderHook(() => useFilteredTodoCounts(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.all).toBe(1);
    expect(result.current.active).toBe(0);
    expect(result.current.completed).toBe(1);
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    mockTodoRepository.findAll.mockRejectedValue(new Error('Database error'));
    mockTodoRepository.countByStatus.mockRejectedValue(new Error('Database error'));

    // Act
    const { result } = renderHook(() => useFilteredTodoCounts(), {
      wrapper: createWrapper(),
    });

    // Assert
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Should return 0 on error (default values)
    expect(result.current.all).toBe(0);
    expect(result.current.active).toBe(0);
    expect(result.current.completed).toBe(0);
  });
});
