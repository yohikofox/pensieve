import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';

/**
 * Hook to get filtered todo counts for filter badges
 * Story 5.3 - AC1, Task 3: Count todos for filter badges
 * Uses React Query for caching and automatic refetch on cache invalidation
 */
export interface UseFilteredTodoCountsReturn {
  all: number;
  active: number;
  completed: number;
  isLoading: boolean;
}

export const useFilteredTodoCounts = (): UseFilteredTodoCountsReturn => {
  const todoRepository = container.resolve<ITodoRepository>('TodoRepository');

  // Query all todos count
  const allCount = useQuery({
    queryKey: ['todos', 'count', 'all'],
    queryFn: async () => {
      const todos = await todoRepository.findAll();
      return todos.length;
    },
    staleTime: 1 * 60 * 1000, // 1 minute cache
  });

  // Query active todos count
  const activeCount = useQuery({
    queryKey: ['todos', 'count', 'active'],
    queryFn: () => todoRepository.countByStatus('todo'),
    staleTime: 1 * 60 * 1000, // 1 minute cache
  });

  // Query completed todos count
  const completedCount = useQuery({
    queryKey: ['todos', 'count', 'completed'],
    queryFn: () => todoRepository.countByStatus('completed'),
    staleTime: 1 * 60 * 1000, // 1 minute cache
  });

  return {
    all: allCount.data ?? 0,
    active: activeCount.data ?? 0,
    completed: completedCount.data ?? 0,
    isLoading: allCount.isLoading || activeCount.isLoading || completedCount.isLoading,
  };
};
