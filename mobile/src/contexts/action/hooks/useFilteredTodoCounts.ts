import { useQuery } from "@tanstack/react-query";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { TOKENS } from "../../../infrastructure/di/tokens";

/**
 * Hook to get filtered todo counts for filter badges
 * Story 5.3 - AC1, Task 3: Count todos for filter badges
 * Story 5.3 - Code Review Fix #5: Optimized with single SQL query
 * Uses React Query for caching and automatic refetch on cache invalidation
 */
export interface UseFilteredTodoCountsReturn {
  all: number;
  active: number;
  completed: number;
  deleted: number;
  isLoading: boolean;
}

export const useFilteredTodoCounts = (): UseFilteredTodoCountsReturn => {
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  // Single optimized query for all counts (Story 5.3 - Fix #5)
  const counts = useQuery({
    queryKey: ["todos", "count", "all-grouped"],
    queryFn: () => todoRepository.countAllByStatus(),
    staleTime: 1 * 60 * 1000, // 1 minute cache
  });

  return {
    all: counts.data?.all ?? 0,
    active: counts.data?.active ?? 0,
    completed: counts.data?.completed ?? 0,
    deleted: counts.data?.deleted ?? 0,
    isLoading: counts.isLoading,
  };
};
