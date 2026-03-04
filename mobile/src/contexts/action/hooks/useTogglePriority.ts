/**
 * useTogglePriority Hook — Toggle priority high ↔ medium
 *
 * Story 8.15 — Subtask 3.1
 * AC5: Toggle rapide "Prioritaire" depuis la liste (binaire high/medium)
 *
 * Pattern Zustand (ADR-038) : réutilise useTodosListStore.onMutation()
 * ADR-021 (DI Transient First) : lazy resolve dans le callback
 */

import { useCallback } from 'react';
import { container } from 'tsyringe';
import { ITodoRepository } from '../domain/ITodoRepository';
import type { TodoPriority } from '../domain/Todo.model';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { useTodosListStore } from '../../../stores/useTodosListStore';

type TogglePriorityCallbacks = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Toggle la priorité d'un todo entre 'high' et 'medium'.
 * (Simplification UX: le toggle rapide est binaire — la vue détail garde le sélecteur 3-niveaux)
 */
export const useTogglePriority = () => {
  const onMutation = useTodosListStore((s) => s.onMutation);

  const mutate = useCallback(async (
    { todoId, currentPriority }: { todoId: string; currentPriority: TodoPriority },
    callbacks?: TogglePriorityCallbacks,
  ): Promise<void> => {
    const newPriority: TodoPriority = currentPriority === 'high' ? 'medium' : 'high';

    // Optimistic update — UI responds immediately (AC5: barre orange apparaît sans délai)
    useTodosListStore.setState((s) => ({
      todos: s.todos.map((t) =>
        t.id === todoId ? { ...t, priority: newPriority } : t,
      ),
    }));

    try {
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
      await repo.update(todoId, { priority: newPriority });

      // Confirmer avec la valeur DB authoritative
      await onMutation(todoId);

      callbacks?.onSuccess?.();
    } catch (e) {
      // Rollback de l'update optimiste
      useTodosListStore.setState((s) => ({
        todos: s.todos.map((t) =>
          t.id === todoId ? { ...t, priority: currentPriority } : t,
        ),
      }));
      const err = e instanceof Error ? e : new Error('Toggle priority failed');
      console.error('[useTogglePriority] Error:', err.message);
      callbacks?.onError?.(err);
    }
  }, [onMutation]);

  return { mutate };
};
