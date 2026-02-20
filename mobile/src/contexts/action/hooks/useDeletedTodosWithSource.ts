import { useQuery } from "@tanstack/react-query";
import { container } from "tsyringe";
import { ITodoRepository } from "../domain/ITodoRepository";
import { TOKENS } from "../../../infrastructure/di/tokens";

/**
 * Hook to fetch all soft-deleted todos (_status = 'deleted') with source context
 * Corbeille: Todos supprimés par le sync PULL
 */
export const useDeletedTodosWithSource = () => {
  const todoRepository = container.resolve<ITodoRepository>(
    TOKENS.ITodoRepository,
  );

  return useQuery({
    queryKey: ["todos", "deleted", "withSource"],
    queryFn: () => todoRepository.findAllDeletedWithSource(),
    staleTime: 1 * 60 * 1000,
    refetchOnMount: "always",
  });
};
