/**
 * useToggleTodoStatus Hook - Toggle todo completion status
 *
 * Story 5.1 - Task 5: Todo Checkbox Toggle Logic (AC8, FR19)
 * Subtask 5.1: Implement toggleTodoStatus mutation (React Query)
 * Subtask 5.8: Handle optimistic UI updates (instant feedback)
 * Subtask 5.9: Add rollback on mutation error
 */

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { Todo } from "../domain/Todo.model";
import { TOKENS } from "../../../infrastructure/di/tokens";
import { RepositoryResultType } from "../../shared/domain/Result";

/**
 * Toggle todo status between 'todo' and 'completed'
 * AC8, FR19: Checkbox toggle with optimistic UI and rollback
 *
 * @returns React Query mutation with optimistic updates
 */
export const useToggleTodoStatus = (): UseMutationResult<
  Todo,
  Error,
  string
> => {
  const queryClient = useQueryClient();
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  return useMutation({
    mutationFn: async (todoId: string) => {
      const result = await todoRepository.toggleStatus(todoId);
      if (result.type !== RepositoryResultType.SUCCESS || !result.data) {
        throw new Error(result.error ?? 'Toggle failed');
      }
      return result.data;
    },

    // Optimistic update (Subtask 5.8)
    onMutate: async (todoId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["todos"] });

      // Snapshot previous state for rollback
      const previousTodos = queryClient.getQueryData<Todo[]>(["todos"]);

      // Optimistically update all 'todos' queries
      queryClient.setQueriesData<Todo[]>({ queryKey: ["todos"] }, (old) => {
        if (!old) return old;

        return old.map((todo) =>
          todo.id === todoId
            ? {
                ...todo,
                status:
                  todo.status === "completed"
                    ? ("todo" as const)
                    : ("completed" as const),
                completedAt:
                  todo.status === "completed" ? undefined : Date.now(),
                updatedAt: Date.now(),
              }
            : todo,
        );
      });

      return { previousTodos };
    },

    // Rollback on error (Subtask 5.9)
    onError: (err, todoId, context) => {
      if (context?.previousTodos) {
        queryClient.setQueriesData(["todos"], context.previousTodos);
      }

      console.error("[useToggleTodoStatus] Error toggling todo:", err);
    },

    // Refetch to ensure consistency (Subtask 5.7)
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });
};
