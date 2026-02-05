/**
 * useAllTodos Hook
 * Story 5.2 - Subtask 3.1-3.6: Fetch all active todos for Actions screen
 *
 * AC2, AC3: Unified list of all todos from all captures
 * - React Query for caching and loading states
 * - TodoRepository.findAll() with SQL sorting
 * - Pull-to-refresh refetch support
 * - 5 minutes staleTime for data caching
 */

import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';

const QUERY_KEY = ['todos', 'all'];

export const useAllTodos = () => {
  const todoRepository = container.resolve<ITodoRepository>('ITodoRepository');

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => todoRepository.findAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
  });
};
