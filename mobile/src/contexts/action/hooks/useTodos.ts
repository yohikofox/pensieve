/**
 * useTodos Hook - Fetch todos by ideaId with React Query
 *
 * Story 5.1 - Task 2: Fetch Todos by Idea (AC1, AC2)
 * Subtask 2.1: Create useTodos hook (React Query) to fetch todos by ideaId
 * Subtask 2.2: Implement getTodosByIdeaId query with sorting (priority desc, createdAt asc)
 * Subtask 2.3: Add loading and error states
 * Subtask 2.4: Cache todos locally with React Query (staleTime: 5 minutes)
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { Todo } from '../domain/Todo.model';
import { TOKENS } from '../../../infrastructure/di/tokens';

/**
 * Fetch todos for a specific idea
 * AC1, AC2: Retrieve todos with sorting (active first, then priority)
 *
 * @param ideaId - Idea UUID
 * @returns React Query result with todos array, loading and error states
 */
export const useTodos = (ideaId: string): UseQueryResult<Todo[], Error> => {
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useQuery({
    queryKey: ['todos', ideaId],
    queryFn: () => todoRepository.findByIdeaId(ideaId),
    staleTime: 5 * 60 * 1000, // 5 minutes cache (AC: Subtask 2.4)
    enabled: !!ideaId, // Only run if ideaId is provided
  });
};
