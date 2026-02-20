import { useMutation, useQueryClient } from "@tanstack/react-query";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { TOKENS } from "../../../infrastructure/di/tokens";

/**
 * Hook to permanently delete all soft-deleted todos
 * Vider la corbeille
 */
export const useEmptyTrash = () => {
  const queryClient = useQueryClient();
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  return useMutation({
    mutationFn: () => todoRepository.deleteAllDeleted(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });
};
