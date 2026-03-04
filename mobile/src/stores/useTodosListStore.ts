/**
 * Todos List Store (ADR-038 — Zustand Pattern 09)
 * Story 8.23 — Source de vérité pour la liste des tâches (Actions screen)
 *
 * RÈGLES ADR-038 :
 * - Singleton create() — pas de Context
 * - hydrate() appelé via useFocusEffect à chaque visite de l'écran
 * - onMutation(id) pour rafraîchir sélectivement un élément
 * - Résolution DI lazy (container.resolve) dans les actions — JAMAIS au niveau module
 * - JAMAIS de React Query dans ce fichier
 *
 * Flux :
 *   Composant → useFocusEffect → store.hydrate() → ITodoRepository.findAll()
 *   Mutation  → store.onMutation(id) → ITodoRepository.findById(id) → update local
 */

import { create } from 'zustand';
import { container } from 'tsyringe';
import { RepositoryResultType } from '../contexts/shared/domain/Result';
import type { Todo } from '../contexts/action/domain/Todo.model';
import type { ITodoRepository } from '../contexts/action/domain/ITodoRepository';
import { TOKENS } from '../infrastructure/di/tokens';
import type { FilterType } from '../contexts/action/utils/filterTodos';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SortType = 'default' | 'priority' | 'createdAt' | 'alpha';

interface TodoCounts {
  all: number;
  active: number;
  completed: number;
  abandoned: number;
  deleted: number;
}

interface TodosListState {
  // Données
  todos: Todo[];
  isLoading: boolean;
  error: string | null;

  // État d'affichage
  filter: FilterType;
  sort: SortType;
  counts: TodoCounts;

  // Actions
  hydrate(): Promise<void>;
  onMutation(todoId: string): Promise<void>;
  setFilter(filter: FilterType): void;
  setSort(sort: SortType): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compteur de séquence — ignore les réponses obsolètes (race condition fix M5)
// ─────────────────────────────────────────────────────────────────────────────
let _hydrateSeq = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Store singleton
// ─────────────────────────────────────────────────────────────────────────────

export const useTodosListStore = create<TodosListState>((set, get) => ({
  todos: [],
  isLoading: false,
  error: null,
  filter: 'all',
  sort: 'default',
  counts: { all: 0, active: 0, completed: 0, abandoned: 0, deleted: 0 },

  hydrate: async () => {
    const seq = ++_hydrateSeq;
    set({ isLoading: true, error: null });
    try {
      // Résolution DI lazy — jamais à l'initialisation du module
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

      const [todos, counts] = await Promise.all([
        repo.findAll(),
        repo.countAllByStatus(),
      ]);

      // Ignorer si un appel plus récent est en cours (fix M5 — race condition)
      if (seq === _hydrateSeq) {
        set({ todos, counts, isLoading: false });
      }
    } catch (e) {
      if (seq === _hydrateSeq) {
        set({
          isLoading: false,
          error: e instanceof Error ? e.message : 'Erreur de chargement',
        });
      }
    }
  },

  onMutation: async (todoId: string) => {
    // Rafraîchit seulement l'élément concerné — évite un rechargement complet
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

    const [found, counts] = await Promise.all([
      repo.findById(todoId),
      repo.countAllByStatus(),
    ]);

    if (found !== null) {
      set((s) => ({
        todos: s.todos.map((t) => (t.id === todoId ? found : t)),
        counts,
      }));
    } else {
      // Élément supprimé ou introuvable → le retirer de la liste
      set((s) => ({
        todos: s.todos.filter((t) => t.id !== todoId),
        counts,
      }));
    }
  },

  setFilter: (filter) => set({ filter }),
  setSort: (sort) => set({ sort }),
}));

// Exporter le type pour usage externe (ex: useFocusEffect dans les screens)
export type { FilterType, SortType, TodoCounts };
