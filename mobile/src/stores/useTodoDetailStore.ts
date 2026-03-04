/**
 * Todo Detail Store (ADR-038 — Zustand Pattern 10)
 * Story 8.23 — Gestion des mutations sur une tâche individuelle
 *
 * RÈGLES ADR-038 + ADR-031 :
 * - Les mutations appellent d'abord la méthode métier sur l'entité (ADR-031)
 *   puis repository.save(entity) — JAMAIS repository.update(id, rawFields)
 * - onMutationCallback notifie le List Store après chaque mutation
 * - Résolution DI lazy dans les actions — JAMAIS au niveau module
 * - JAMAIS de React Query dans ce fichier
 *
 * Flux abandon() :
 *   1. snapshot pré-mutation sauvegardé       → rollback en cas d'échec save()
 *   2. entity.abandon()          → valide la règle métier (ADR-031)
 *   3. repo.save(entity)         → persiste l'entité mutée (ADR-031 R8)
 *   4. set({ todo: Todo.fromSnapshot(...) })  → nouvelle référence → Zustand re-render
 *   5. _onMutationCallback(id)   → notifie le List Store
 *   6. return success(undefined)
 */

import { create } from 'zustand';
import { container } from 'tsyringe';
import {
  RepositoryResultType,
  notFound,
  success,
} from '../contexts/shared/domain/Result';
import type { RepositoryResult } from '../contexts/shared/domain/Result';
import { Todo } from '../contexts/action/domain/Todo.model';
import type { ITodoRepository } from '../contexts/action/domain/ITodoRepository';
import { TOKENS } from '../infrastructure/di/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// State du store
// ─────────────────────────────────────────────────────────────────────────────

interface TodoDetailState {
  // Données
  todoId: string | null;
  todo: Todo | null;
  isLoading: boolean;

  // Callback vers le List Store (injecté par le composant parent)
  _onMutationCallback: ((id: string) => void) | null;

  // Actions
  load(id: string): Promise<void>;
  setOnMutationCallback(cb: (id: string) => void): void;
  abandon(): Promise<RepositoryResult<void>>;
  reactivate(): Promise<RepositoryResult<void>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store singleton
// ─────────────────────────────────────────────────────────────────────────────

export const useTodoDetailStore = create<TodoDetailState>((set, get) => ({
  todoId: null,
  todo: null,
  isLoading: false,
  _onMutationCallback: null,

  load: async (id: string) => {
    set({ isLoading: true, todoId: id });
    // Résolution DI lazy — jamais à l'initialisation du module
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
    const found = await repo.findById(id);
    set({ todo: found, isLoading: false });
  },

  setOnMutationCallback: (cb) => set({ _onMutationCallback: cb }),

  abandon: async () => {
    const { todo, _onMutationCallback } = get();
    if (!todo) return notFound('No todo loaded in detail store');

    // Snapshot avant mutation — rollback possible si save() échoue (fix H2)
    const preSnapshot = todo.toSnapshot();

    // 1. Règle métier sur l'entité (ADR-031) — valide la transition d'état
    const transitionResult = todo.abandon();
    if (transitionResult.type !== RepositoryResultType.SUCCESS) return transitionResult;

    // 2. Persistence (ADR-031 R8) — repository reçoit l'entité, pas des champs bruts
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
    const saveResult = await repo.save(todo);
    if (saveResult.type !== RepositoryResultType.SUCCESS) {
      // Rollback : restaurer l'entité à son état pré-mutation (fix H2)
      set({ todo: Todo.fromSnapshot(preSnapshot) });
      return saveResult;
    }

    // 3. Nouvelle référence objet → déclenche le re-render Zustand (fix H1)
    set({ todo: Todo.fromSnapshot(todo.toSnapshot()) });

    // 4. Notifier le List Store parent
    _onMutationCallback?.(todo.id);

    return success(undefined);
  },

  reactivate: async () => {
    const { todo, _onMutationCallback } = get();
    if (!todo) return notFound('No todo loaded in detail store');

    // Snapshot avant mutation — rollback possible si save() échoue (fix H2)
    const preSnapshot = todo.toSnapshot();

    // 1. Règle métier sur l'entité (ADR-031)
    const transitionResult = todo.reactivate();
    if (transitionResult.type !== RepositoryResultType.SUCCESS) return transitionResult;

    // 2. Persistence (ADR-031 R8)
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
    const saveResult = await repo.save(todo);
    if (saveResult.type !== RepositoryResultType.SUCCESS) {
      // Rollback : restaurer l'entité à son état pré-mutation (fix H2)
      set({ todo: Todo.fromSnapshot(preSnapshot) });
      return saveResult;
    }

    // 3. Nouvelle référence objet → déclenche le re-render Zustand (fix H1)
    set({ todo: Todo.fromSnapshot(todo.toSnapshot()) });

    // 4. Notifier le List Store parent
    _onMutationCallback?.(todo.id);

    return success(undefined);
  },
}));
