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
 *   Composant → useFocusEffect → store.hydrate() → ITodoRepository.findAllWithSource()
 *   Mutation  → store.onMutation(id) → ITodoRepository.findById(id) → update local
 */

import { create } from 'zustand';
import { container } from 'tsyringe';
// ASYNC_STORAGE_OK: UI preferences only (filter/sort state) — not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TodoWithSource } from '../contexts/action/domain/ITodoRepository';
import type { ITodoRepository } from '../contexts/action/domain/ITodoRepository';
import { TOKENS } from '../infrastructure/di/tokens';
import type { FilterType } from '../contexts/action/utils/filterTodos';
import type { SortType } from '../contexts/action/utils/sortTodos';

// ─────────────────────────────────────────────────────────────────────────────
// Storage keys (same as useFilterState for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
const FILTER_STORAGE_KEY = '@pensine/actions_filter';
const SORT_STORAGE_KEY = '@pensine/actions_sort';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TodoCounts {
  all: number;
  active: number;
  completed: number;
  abandoned: number;
  deleted: number;
}

interface TodosListState {
  // Données
  todos: TodoWithSource[];
  deletedTodos: TodoWithSource[];
  isLoading: boolean;
  hasHydrated: boolean;
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
  bulkDeleteCompleted(): Promise<number>;
  emptyTrash(): Promise<number>;
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
  deletedTodos: [],
  isLoading: false,
  hasHydrated: false,
  error: null,
  filter: 'active',
  sort: 'default',
  counts: { all: 0, active: 0, completed: 0, abandoned: 0, deleted: 0 },

  hydrate: async () => {
    const seq = ++_hydrateSeq;
    set({ isLoading: true, error: null });
    try {
      // Charger les préférences UI persistées (même clés que useFilterState)
      const [savedFilter, savedSort] = await Promise.all([
        AsyncStorage.getItem(FILTER_STORAGE_KEY),
        AsyncStorage.getItem(SORT_STORAGE_KEY),
      ]);
      if (savedFilter) set({ filter: savedFilter as FilterType });
      if (savedSort) set({ sort: savedSort as SortType });

      // Résolution DI lazy — jamais à l'initialisation du module
      const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);

      const [todos, deletedTodos, counts] = await Promise.all([
        repo.findAllWithSource(),
        repo.findAllDeletedWithSource(),
        repo.countAllByStatus(),
      ]);

      // Ignorer si un appel plus récent est en cours (fix M5 — race condition)
      if (seq === _hydrateSeq) {
        set({ todos, deletedTodos, counts, isLoading: false, hasHydrated: true });
      }
    } catch (e) {
      if (seq === _hydrateSeq) {
        set({
          isLoading: false,
          hasHydrated: true,
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
        todos: s.todos.map((t) => {
          if (t.id !== todoId) return t;
          // Preserve source context (thought/idea) — domain mutations ne les changent pas
          return Object.assign(found, { thought: t.thought, idea: t.idea }) as TodoWithSource;
        }),
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

  setFilter: (filter: FilterType) => {
    set({ filter });
    AsyncStorage.setItem(FILTER_STORAGE_KEY, filter).catch(() => {});
  },

  setSort: (sort: SortType) => {
    set({ sort });
    AsyncStorage.setItem(SORT_STORAGE_KEY, sort).catch(() => {});
  },

  bulkDeleteCompleted: async (): Promise<number> => {
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
    const count = await repo.deleteCompleted();
    if (count > 0) {
      await get().hydrate();
    }
    return count;
  },

  emptyTrash: async (): Promise<number> => {
    const repo = container.resolve<ITodoRepository>(TOKENS.ITodoRepository);
    const count = await repo.deleteAllDeleted();
    await get().hydrate();
    return count;
  },
}));

// Exporter les types pour usage externe (ex: useFocusEffect dans les screens)
export type { FilterType, SortType, TodoCounts };
