/**
 * useAllTodosWithSource Hook
 * Story 5.2 - Task 7: Fetch all todos with source context (Thought + Idea)
 *
 * AC6: Source preview with Thought summary and Idea text
 * - Optimized query with LEFT JOIN (single query, no N+1)
 * - Returns todos with thought.summary and idea.text for preview
 * - 5 minutes staleTime for data caching
 */

import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { TOKENS } from '../../../infrastructure/di/tokens';

const QUERY_KEY = ['todos', 'all', 'withSource'];

export const useAllTodosWithSource = () => {
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => todoRepository.findAllWithSource(),
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
  });
};
