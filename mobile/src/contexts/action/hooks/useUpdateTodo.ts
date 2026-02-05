/**
 * useUpdateTodo Hook - Update todo details (description, deadline, priority)
 *
 * Story 5.1 - Task 6: Todo Detail Popover (AC6, FR20)
 * Support inline editing of todo fields
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { Todo } from '../domain/Todo.model';
import { TOKENS } from '../../../infrastructure/di/tokens';

interface UpdateTodoParams {
  id: string;
  changes: Partial<Todo>;
}

/**
 * Update todo details (description, deadline, priority)
 * AC6: Enable editing todo fields in detail popover
 *
 * @returns React Query mutation
 */
export const useUpdateTodo = (): UseMutationResult<void, Error, UpdateTodoParams> => {
  const queryClient = useQueryClient();
  const todoRepository = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

  return useMutation({
    mutationFn: ({ id, changes }: UpdateTodoParams) => todoRepository.update(id, changes),

    onSuccess: () => {
      // Invalidate all todos queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },

    onError: (err) => {
      console.error('[useUpdateTodo] Error updating todo:', err);
    },
  });
};
