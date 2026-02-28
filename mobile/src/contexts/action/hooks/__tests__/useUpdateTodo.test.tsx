/**
 * useUpdateTodo Hook Unit Tests
 *
 * Regression tests for:
 * - Issue #21: Return type must be boolean (not void)
 * - AC6, FR20: Support inline editing of todo fields
 */

import 'reflect-metadata'; // Required for TSyringe
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUpdateTodo } from '../useUpdateTodo';
import { container } from 'tsyringe';
import { TOKENS } from '../../../../infrastructure/di/tokens';
import type { ITodoRepository } from '../../domain/ITodoRepository';

// Mock TodoRepository
const mockTodoRepository: jest.Mocked<ITodoRepository> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdeaId: jest.fn(),
  findByThoughtId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deleteCompleted: jest.fn(),
  toggleStatus: jest.fn(),
  getAll: jest.fn(),
  findAll: jest.fn(),
  countActive: jest.fn(),
  countByStatus: jest.fn(),
  countAllByStatus: jest.fn(),
  findAllDeletedWithSource: jest.fn(),
  deleteAllDeleted: jest.fn(),
  findAllWithSource: jest.fn(),
  findByAnalysisId: jest.fn(),
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useUpdateTodo', () => {
  beforeAll(() => {
    container.registerInstance(TOKENS.ITodoRepository, mockTodoRepository);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    container.clearInstances();
  });

  // Regression test for Issue #21 — return type must be boolean not void
  it('should return true when update was applied', async () => {
    mockTodoRepository.update.mockResolvedValue(true);

    const { result } = renderHook(() => useUpdateTodo(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'todo-1', changes: { description: 'Updated' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Regression for Issue #21: mutation data must be boolean true
    expect(result.current.data).toBe(true);
    expect(mockTodoRepository.update).toHaveBeenCalledWith('todo-1', { description: 'Updated' });
  });

  // Regression test for Issue #21 — false return when no changes detected
  it('should return false when no changes were applied', async () => {
    mockTodoRepository.update.mockResolvedValue(false);

    const { result } = renderHook(() => useUpdateTodo(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'todo-2', changes: { description: 'Same description' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The boolean false must be preserved (not treated as void/undefined)
    expect(result.current.data).toBe(false);
  });

  it('should handle update errors gracefully', async () => {
    mockTodoRepository.update.mockRejectedValue(new Error('DB write error'));

    const { result } = renderHook(() => useUpdateTodo(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'todo-3', changes: { description: 'Test' } });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
