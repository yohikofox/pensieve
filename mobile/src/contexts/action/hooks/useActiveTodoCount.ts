/**
 * useActiveTodoCount Hook
 * Story 5.2 - Subtask 8.1-8.5: Real-time active todo count for badge
 *
 * AC1: Badge shows count of active (incomplete) todos
 * - React Query with auto-refetch on cache invalidation
 * - Updates when todos are completed/created
 * - Shorter staleTime (1 min) for frequent updates
 */

import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';

const QUERY_KEY = ['todos', 'count', 'active'];

export const useActiveTodoCount = () => {
  const todoRepository = container.resolve<ITodoRepository>('ITodoRepository');

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => todoRepository.countActive(),
    staleTime: 1 * 60 * 1000, // 1 minute cache (frequent updates for badge)
    refetchOnMount: 'always', // Always refetch when tab opens
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
  });
};
