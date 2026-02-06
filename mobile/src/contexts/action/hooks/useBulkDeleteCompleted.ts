/**
 * useBulkDeleteCompleted Hook
 * Story 5.4 - Task 11: Bulk Delete Completed Todos (AC10)
 *
 * Delete all completed todos with confirmation and success feedback
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { TOKENS } from '../../../infrastructure/di/tokens';

/**
 * Bulk delete all completed todos
 * AC10: Delete all completed actions with confirmation
 *
 * @returns React Query mutation with count of deleted todos
 */
export const useBulkDeleteCompleted = (): UseMutationResult<number, Error, void> => {
  const queryClient = useQueryClient();
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useMutation({
    mutationFn: () => todoRepository.deleteCompleted(),

    onSuccess: (deletedCount) => {
      // CODE REVIEW FIX #10: Early return if no todos were deleted (avoid unnecessary invalidation)
      if (deletedCount === 0) {
        console.log('[useBulkDeleteCompleted] No completed todos to delete');
        return;
      }

      // Invalidate all todos queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['todos'] });

      console.log(`[useBulkDeleteCompleted] Deleted ${deletedCount} completed todos`);
    },

    onError: (err) => {
      console.error('[useBulkDeleteCompleted] Error deleting completed todos:', err);
    },
  });
};
