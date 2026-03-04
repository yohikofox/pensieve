/**
 * useToggleTodoStatus Hook - Toggle todo completion status
 *
 * Story 5.1 - Task 5: Todo Checkbox Toggle Logic (AC8, FR19)
 * Migrated from React Query to Zustand (ADR-038) — ActionsScreen migration
 */

import { useCallback } from 'react';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { Todo } from '../domain/Todo.model';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { RepositoryResultType } from '../../shared/domain/Result';
import { useTodosListStore } from '../../../stores/useTodosListStore';

type ToggleCallbacks = {
  onSuccess?: (todo: Todo) => void;
  onError?: (error: Error) => void;
};

/**
 * Toggle todo status between 'todo' and 'completed'
 * AC8, FR19: Checkbox toggle — notifie le Zustand List Store après succès
 */
export const useToggleTodoStatus = () => {
  const onMutation = useTodosListStore((s) => s.onMutation);

  const mutate = useCallback(async (todoId: string, callbacks?: ToggleCallbacks): Promise<void> => {
    try {
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
      const result = await repo.toggleStatus(todoId);

      if (result.type !== RepositoryResultType.SUCCESS || !result.data) {
        throw new Error(result.error ?? 'Toggle failed');
      }

      // Notifier le List Store pour rafraîchir l'élément
      await onMutation(todoId);

      callbacks?.onSuccess?.(result.data);
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Toggle failed');
      console.error('[useToggleTodoStatus] Error toggling todo:', err);
      callbacks?.onError?.(err);
    }
  }, [onMutation]);

  return { mutate };
};
