/**
 * useDeleteTodo Hook
 * Delete a single todo by ID (hard delete)
 */

import {
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { Alert } from "react-native";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { TOKENS } from "../../../infrastructure/di/tokens";

/**
 * Delete a single todo
 *
 * @returns React Query mutation
 */
export const useDeleteTodo = (): UseMutationResult<void, Error, string> => {
  const queryClient = useQueryClient();
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  return useMutation({
    mutationFn: (todoId: string) => todoRepository.delete(todoId),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },

    onError: (err) => {
      console.error("[useDeleteTodo] Error deleting todo:", err);
      Alert.alert(
        'Erreur',
        'Impossible de supprimer la tâche. Veuillez réessayer.',
        [{ text: 'OK', style: 'default' }],
      );
    },
  });
};
