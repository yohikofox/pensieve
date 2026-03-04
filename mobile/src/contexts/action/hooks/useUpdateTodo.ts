/**
 * useUpdateTodo Hook - Update todo details (description, deadline, priority)
 *
 * Story 5.1 - Task 6: Todo Detail Popover (AC6, FR20)
 * Migrated from React Query to Zustand (ADR-038) — ActionsScreen migration
 */

import { useCallback } from 'react';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { Todo } from '../domain/Todo.model';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { useTodosListStore } from '../../../stores/useTodosListStore';
import { useCaptureDetailStore } from '../../../stores/captureDetailStore';
import { loadActionItemsFromTodos } from '../../../hooks/useActionItems';

interface UpdateTodoParams {
  id: string;
  changes: Partial<Todo>;
}

type UpdateCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Update todo details (description, deadline, priority)
 * AC6: Enable editing todo fields in detail popover
 * Notifie le Zustand List Store après succès
 */
export const useUpdateTodo = () => {
  const onMutation = useTodosListStore((s) => s.onMutation);

  const mutate = useCallback(async (
    { id, changes }: UpdateTodoParams,
    callbacks?: UpdateCallbacks,
  ): Promise<void> => {
    try {
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
      await repo.update(id, changes);

      // Notifier le List Store pour rafraîchir l'élément
      await onMutation(id);

      // Refresh action items in capture detail store if a capture is active
      const captureId = useCaptureDetailStore.getState().captureId;
      if (captureId) {
        loadActionItemsFromTodos(captureId).then((items) => {
          if (items) {
            useCaptureDetailStore.getState().setActionItems(items);
          }
        }).catch((err) => {
          console.error('[useUpdateTodo] Failed to refresh action items:', err);
        });
      }

      callbacks?.onSuccess?.();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Update failed');
      console.error('[useUpdateTodo] Error updating todo:', err);
      callbacks?.onError?.(err);
    }
  }, [onMutation]);

  return { mutate };
};
