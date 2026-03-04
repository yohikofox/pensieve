/**
 * PATTERN: Zustand List Store (ADR-038)
 *
 * Source: ADR-038 — Zustand Stores, Pattern List/Detail
 *
 * RÈGLES:
 * - Singleton `create` — cohérent avec settingsStore, capturesStore, SyncStatusStore
 * - hydrate() appelé via useFocusEffect à chaque visite de l'écran
 * - onMutation(id) pour rafraîchir sélectivement un élément sans tout recharger
 * - Résolution DI lazy (container.resolve) dans les actions, jamais au niveau module
 * - Le store exprime des INTENTIONS, le repository choisit la source (SQLite / API / hybride)
 * - JAMAIS de queryClient dans le store — React Query est hors de la couche store
 *
 * Flux :
 *   Composant → useFocusEffect → store.hydrate() → ITodoRepository.findAll()
 *   Mutation  → store.onMutation(id) → ITodoRepository.findById(id) → update local
 *
 * Prérequis : entités doivent être des classes riches (ADR-031, voir 08-domain-entity.ts)
 */

import { create } from 'zustand';
import { container } from 'tsyringe';
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RepositoryResultType } from '../src/contexts/shared/domain/Result';
import type { RepositoryResult } from '../src/contexts/shared/domain/Result';
// Remplacer par TOKENS depuis '../src/infrastructure/di/tokens'
const TOKENS = { IExampleRepository: Symbol.for('IExampleRepository') };

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types — adapter à l'entité concernée (remplacer ExampleEntity)
// ─────────────────────────────────────────────────────────────────────────────

// Interface du repository (dans domain/IExampleRepository.ts)
interface IExampleRepository {
  findAll(): Promise<RepositoryResult<ExampleEntity[]>>;
  findById(id: string): Promise<RepositoryResult<ExampleEntity>>;
}

// Entité de domaine (classe riche ADR-031, voir 08-domain-entity.ts)
declare class ExampleEntity {
  readonly id: string;
  readonly title: string;
}

type FilterType = 'all' | 'active' | 'completed';
type SortType = 'createdAt' | 'updatedAt';

// ─────────────────────────────────────────────────────────────────────────────
// 2. State du store
// ─────────────────────────────────────────────────────────────────────────────

interface ExampleListState {
  // Données
  items: ExampleEntity[];
  isLoading: boolean;

  // État d'affichage
  filter: FilterType;
  sort: SortType;

  // Actions
  hydrate(): Promise<void>;
  onMutation(id: string): Promise<void>;
  setFilter(filter: FilterType): void;
  setSort(sort: SortType): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Store — singleton exporté
// ─────────────────────────────────────────────────────────────────────────────

export const useExampleListStore = create<ExampleListState>((set, get) => ({
  items: [],
  isLoading: false,
  filter: 'all',
  sort: 'createdAt',

  hydrate: async () => {
    set({ isLoading: true });
    // Résolution DI lazy — jamais à l'initialisation du module
    const repo = container.resolve<IExampleRepository>(TOKENS.IExampleRepository);
    const result = await repo.findAll();
    if (result.type === RepositoryResultType.SUCCESS) {
      set({ items: result.data!, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  onMutation: async (id: string) => {
    // Rafraîchit seulement l'élément concerné — évite un rechargement complet
    const repo = container.resolve<IExampleRepository>(TOKENS.IExampleRepository);
    const result = await repo.findById(id);
    if (result.type === RepositoryResultType.SUCCESS) {
      set((s) => ({
        items: s.items.map((item) => (item.id === id ? result.data! : item)),
      }));
    } else {
      // Élément supprimé ou introuvable → le retirer de la liste
      set((s) => ({ items: s.items.filter((item) => item.id !== id) }));
    }
  },

  setFilter: (filter) => set({ filter }),
  setSort: (sort) => set({ sort }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Exemple d'utilisation dans le screen parent
// ─────────────────────────────────────────────────────────────────────────────

/*
export function ExampleListScreen() {
  // ✅ useFocusEffect — hydrate à chaque visite, pas seulement au premier mount
  useFocusEffect(
    useCallback(() => {
      useExampleListStore.getState().hydrate();
    }, [])
  );

  const items    = useExampleListStore((s) => s.items);
  const filter   = useExampleListStore((s) => s.filter);
  const isLoading = useExampleListStore((s) => s.isLoading);

  return (
    <View>
      {items.map((item) => (
        <ExampleCard
          key={item.id}
          item={item}
          // Passer le callback onMutation au composant enfant qui effectue des mutations
          onMutation={(id) => useExampleListStore.getState().onMutation(id)}
        />
      ))}
    </View>
  );
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// 5. Exemple d'utilisation dans un composant enfant (lecture seule)
// ─────────────────────────────────────────────────────────────────────────────

/*
function ExampleCard({ item, onMutation }: { item: ExampleEntity; onMutation: (id: string) => void }) {
  // ✅ Selector granulaire — re-render uniquement si filter change
  const filter = useExampleListStore((s) => s.filter);

  return <View>...</View>;
}
*/
