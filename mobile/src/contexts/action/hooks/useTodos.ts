/**
 * useTodos Hook - Fetch todos by ideaId with React Query
 *
 * Story 5.1 - Task 2: Fetch Todos by Idea (AC1, AC2)
 * Subtask 2.1: Create useTodos hook (React Query) to fetch todos by ideaId
 * Subtask 2.2: Implement getTodosByIdeaId query with sorting (priority desc, createdAt asc)
 * Subtask 2.3: Add loading and error states
 * Subtask 2.4: Cache todos locally with React Query (staleTime: 5 minutes)
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { Todo } from "../domain/Todo.model";
import { TOKENS } from "../../../infrastructure/di/tokens";

/**
 * Fetch todos for a specific idea
 * AC1, AC2: Retrieve todos with sorting (active first, then priority)
 *
 * IMPORTANT (Issue #5 fix):
 * - This hook fetches todos linked to a specific ideaId
 * - Orphan todos (idea_id = NULL) are NOT fetched by this hook
 * - enabled: !!ideaId ensures query only runs if ideaId is truthy (non-empty string)
 * - For empty string, React Query will not execute the query (returns empty data)
 *
 * @param ideaId - Idea UUID (must be non-empty string)
 * @returns React Query result with todos array, loading and error states
 */
export const useTodos = (ideaId: string): UseQueryResult<Todo[], Error> => {
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  return useQuery({
    queryKey: ["todos", ideaId],
    queryFn: () => todoRepository.findByIdeaId(ideaId),
    staleTime: 5 * 60 * 1000, // 5 minutes cache (AC: Subtask 2.4)
    enabled: !!ideaId && ideaId.trim().length > 0, // Only run if ideaId is valid (Issue #5 fix)
  });
};
