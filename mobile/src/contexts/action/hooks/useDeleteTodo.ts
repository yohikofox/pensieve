/**
 * useDeleteTodo Hook
 * Delete a single todo by ID (hard delete)
 * Migrated from React Query to Zustand (ADR-038) — ActionsScreen migration
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { useTodosListStore } from '../../../stores/useTodosListStore';

type DeleteCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Delete a single todo — notifie le Zustand List Store après succès
 */
export const useDeleteTodo = () => {
  const onMutation = useTodosListStore((s) => s.onMutation);

  const mutate = useCallback(async (todoId: string, callbacks?: DeleteCallbacks): Promise<void> => {
    try {
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
      await repo.delete(todoId);

      // onMutation détecte que le todo est introuvable → le retire de la liste
      await onMutation(todoId);

      callbacks?.onSuccess?.();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Delete failed');
      console.error('[useDeleteTodo] Error deleting todo:', err);
      Alert.alert(
        'Erreur',
        'Impossible de supprimer la tâche. Veuillez réessayer.',
        [{ text: 'OK', style: 'default' }],
      );
      callbacks?.onError?.(err);
    }
  }, [onMutation]);

  return { mutate };
};
