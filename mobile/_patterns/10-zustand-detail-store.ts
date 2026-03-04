/**
 * PATTERN: Zustand Detail Store (ADR-038)
 *
 * Source: ADR-038 — Zustand Stores, Pattern List/Detail
 *
 * RÈGLES:
 * - Singleton `create` — même pattern que le List Store
 * - load(id) est le point d'entrée unifié (liste, deep link, notification push)
 * - Les mutations appellent d'abord la méthode métier sur l'entité (ADR-031)
 *   puis repository.save(entity) — JAMAIS repository.update(id, rawFields)
 * - onMutationCallback notifie le List Store parent après chaque mutation
 * - Le callback est passé en prop par le composant parent au moment du rendu
 * - Résolution DI lazy dans les actions
 *
 * Flux mutation :
 *   composant.abandon()
 *     → store.abandon()
 *       → entity.abandon()          (ADR-031 : règle métier sur l'entité)
 *       → repo.save(entity)         (ADR-031 R8 : repository accepte l'entité)
 *       → onMutationCallback(id)    (notifie le List Store)
 *
 * Prérequis : entité DOIT être une classe riche (ADR-031, voir 08-domain-entity.ts)
 */

import { create } from 'zustand';
import { container } from 'tsyringe';
import { RepositoryResultType, success, notFound } from '../src/contexts/shared/domain/Result';
import type { RepositoryResult } from '../src/contexts/shared/domain/Result';
// Remplacer par TOKENS depuis '../src/infrastructure/di/tokens'
const TOKENS = { IExampleRepository: Symbol.for('IExampleRepository') };

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types — adapter à l'entité concernée
// ─────────────────────────────────────────────────────────────────────────────

interface IExampleRepository {
  findById(id: string): Promise<RepositoryResult<ExampleEntity>>;
  save(entity: ExampleEntity): Promise<RepositoryResult<void>>;
}

// Entité de domaine (classe riche ADR-031)
declare class ExampleEntity {
  readonly id: string;
  // Transitions d'état retournant Result<void>
  abandon(): RepositoryResult<void>;
  reactivate(): RepositoryResult<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. State du store
// ─────────────────────────────────────────────────────────────────────────────

interface ExampleDetailState {
  // Données
  entityId: string | null;
  entity: ExampleEntity | null;
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
// 3. Store — singleton exporté
// ─────────────────────────────────────────────────────────────────────────────

export const useExampleDetailStore = create<ExampleDetailState>((set, get) => ({
  entityId: null,
  entity: null,
  isLoading: false,
  _onMutationCallback: null,

  load: async (id: string) => {
    set({ isLoading: true, entityId: id });
    const repo = container.resolve<IExampleRepository>(TOKENS.IExampleRepository);
    const result = await repo.findById(id);
    if (result.type === RepositoryResultType.SUCCESS) {
      set({ entity: result.data!, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  setOnMutationCallback: (cb) => set({ _onMutationCallback: cb }),

  abandon: async () => {
    const { entity, _onMutationCallback } = get();
    if (!entity) return notFound('No entity loaded in detail store');

    // 1. Règle métier sur l'entité (ADR-031) — valide la transition d'état
    const transitionResult = entity.abandon();
    if (transitionResult.type !== RepositoryResultType.SUCCESS) return transitionResult;

    // 2. Persistence (ADR-031 R8) — repository reçoit l'entité, pas des champs bruts
    const repo = container.resolve<IExampleRepository>(TOKENS.IExampleRepository);
    const saveResult = await repo.save(entity);
    if (saveResult.type !== RepositoryResultType.SUCCESS) return saveResult;

    // 3. Mise à jour du state local
    set({ entity });

    // 4. Notifier le List Store parent (callback, pas EventEmitter — YAGNI)
    _onMutationCallback?.(entity.id);

    return success(undefined);
  },

  reactivate: async () => {
    const { entity, _onMutationCallback } = get();
    if (!entity) return notFound('No entity loaded in detail store');

    const transitionResult = entity.reactivate();
    if (transitionResult.type !== RepositoryResultType.SUCCESS) return transitionResult;

    const repo = container.resolve<IExampleRepository>(TOKENS.IExampleRepository);
    const saveResult = await repo.save(entity);
    if (saveResult.type !== RepositoryResultType.SUCCESS) return saveResult;

    set({ entity });
    _onMutationCallback?.(entity.id);

    return success(undefined);
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Exemple d'utilisation dans le composant parent (popover / modal / screen)
// ─────────────────────────────────────────────────────────────────────────────

/*
function ExampleDetailPopover({ entityId, onClose }: { entityId: string; onClose: () => void }) {

  useEffect(() => {
    // Charger l'entité par ID
    useExampleDetailStore.getState().load(entityId);

    // Enregistrer le callback vers le List Store parent
    useExampleDetailStore.getState().setOnMutationCallback(
      (id) => useExampleListStore.getState().onMutation(id)
    );
  }, [entityId]);

  const entity    = useExampleDetailStore((s) => s.entity);
  const isLoading = useExampleDetailStore((s) => s.isLoading);
  const abandon   = useExampleDetailStore((s) => s.abandon);

  const handleAbandon = async () => {
    const result = await abandon();
    if (result.type === RepositoryResultType.SUCCESS) {
      onClose(); // Fermer le popover après mutation réussie
    }
  };

  return <View>...</View>;
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// 5. ❌ ANTI-PATTERN à ne jamais reproduire
// ─────────────────────────────────────────────────────────────────────────────

/*
// ❌ Violation ADR-031 : règle métier dans la couche UI, mutation de données brutes
mutationFn: async (entityId: string) => {
  await repository.update(entityId, {
    status: 'abandoned',       // ← règle métier encodée ici
    updatedAt: Date.now(),     // ← responsabilité de l'entité
  });
}

// ✅ Correct : intention métier déléguée au store → entité → repository
await useExampleDetailStore.getState().abandon();
*/
