/**
 * PATTERN: Rich Domain Entity (ADR-031)
 *
 * Source: Ce fichier est le golden path pour toute entité de domaine.
 *
 * RÈGLE: Les entités de domaine DOIVENT être des classes avec :
 * - Constructeur privé
 * - Factory create() retournant Result<T> (création métier avec validation)
 * - Factory reconstitute() pour la désérialisation depuis un Snapshot
 * - Propriétés readonly ou getters
 * - Transitions d'état via méthodes métier retournant Result<void>
 * - toSnapshot() pour la sérialisation
 *
 * Séparation sérialisation / mapping :
 * - L'ENTITÉ gère : Snapshot ↔ Entity (toSnapshot / reconstitute)
 * - LE REPOSITORY gère : DB row ↔ Snapshot (mapping colonnes, types, conventions)
 *
 * JAMAIS d'interface comme entité principale d'un *.model.ts.
 * JAMAIS de mutation directe de l'état depuis l'extérieur.
 */

import {
  type RepositoryResult,
  success,
  validationError,
  businessError,
} from '../src/contexts/shared/domain/Result';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Constantes d'état (inchangé par rapport au pattern existant)
// ─────────────────────────────────────────────────────────────────────────────

export const EXAMPLE_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

export type ExampleStatus = (typeof EXAMPLE_STATUSES)[keyof typeof EXAMPLE_STATUSES];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Snapshot — type plain pour la persistence et la sérialisation
// ─────────────────────────────────────────────────────────────────────────────

export interface ExampleEntitySnapshot {
  readonly id: string;
  readonly title: string;
  readonly status: ExampleStatus;
  readonly ownerId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Props de création — ce que le use case fournit
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateExampleEntityProps {
  readonly id: string;
  readonly title: string;
  readonly ownerId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Entité de domaine (classe)
// ─────────────────────────────────────────────────────────────────────────────

export class ExampleEntity {
  // ── Constructeur privé — jamais appelé directement ──────────────────────
  private constructor(
    readonly id: string,
    private _title: string,
    private _status: ExampleStatus,
    readonly ownerId: string,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  // ── Factory: création métier (valide les invariants) ────────────────────
  static create(props: CreateExampleEntityProps): RepositoryResult<ExampleEntity> {
    if (!props.title.trim()) {
      return validationError('Title cannot be empty');
    }
    if (!props.ownerId) {
      return validationError('OwnerId is required');
    }

    const now = new Date();
    return success(new ExampleEntity(
      props.id,
      props.title.trim(),
      EXAMPLE_STATUSES.DRAFT,
      props.ownerId,
      now,
      now,
    ));
  }

  // ── Désérialisation depuis un Snapshot (pas de validation métier) ────────
  static reconstitute(snapshot: ExampleEntitySnapshot): ExampleEntity {
    return new ExampleEntity(
      snapshot.id,
      snapshot.title,
      snapshot.status,
      snapshot.ownerId,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  // ── Getters (lecture seule) ─────────────────────────────────────────────
  get title(): string { return this._title; }
  get status(): ExampleStatus { return this._status; }
  get updatedAt(): Date { return this._updatedAt; }

  // ── Transitions d'état (métier) ─────────────────────────────────────────

  activate(): RepositoryResult<void> {
    if (this._status !== EXAMPLE_STATUSES.DRAFT) {
      return businessError(
        `Cannot activate: current status is '${this._status}', expected 'draft'`
      );
    }
    this._status = EXAMPLE_STATUSES.ACTIVE;
    this._updatedAt = new Date();
    return success(undefined);
  }

  complete(): RepositoryResult<void> {
    if (this._status !== EXAMPLE_STATUSES.ACTIVE) {
      return businessError(
        `Cannot complete: current status is '${this._status}', expected 'active'`
      );
    }
    this._status = EXAMPLE_STATUSES.COMPLETED;
    this._updatedAt = new Date();
    return success(undefined);
  }

  archive(): RepositoryResult<void> {
    const allowed: ExampleStatus[] = [
      EXAMPLE_STATUSES.COMPLETED,
      EXAMPLE_STATUSES.DRAFT,
    ];
    if (!allowed.includes(this._status)) {
      return businessError(
        `Cannot archive: current status is '${this._status}'`
      );
    }
    this._status = EXAMPLE_STATUSES.ARCHIVED;
    this._updatedAt = new Date();
    return success(undefined);
  }

  // ── Mutations simples (avec validation) ─────────────────────────────────

  updateTitle(newTitle: string): RepositoryResult<void> {
    if (!newTitle.trim()) {
      return validationError('Title cannot be empty');
    }
    if (this._status === EXAMPLE_STATUSES.ARCHIVED) {
      return businessError('Cannot update archived entity');
    }
    this._title = newTitle.trim();
    this._updatedAt = new Date();
    return success(undefined);
  }

  // ── Méthodes de requête (comportement métier) ───────────────────────────

  isDraft(): boolean {
    return this._status === EXAMPLE_STATUSES.DRAFT;
  }

  isTerminal(): boolean {
    return this._status === EXAMPLE_STATUSES.ARCHIVED;
  }

  // ── Sérialisation vers la couche persistence ────────────────────────────

  toSnapshot(): ExampleEntitySnapshot {
    return {
      id: this.id,
      title: this._title,
      status: this._status,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Exemple d'utilisation dans un Repository
//    Le repository gère le MAPPING (DB row ↔ Snapshot).
//    L'entité gère la SÉRIALISATION (Snapshot ↔ Entity).
// ─────────────────────────────────────────────────────────────────────────────

/*
class ExampleRepository implements IExampleRepository {
  async findById(id: string): Promise<RepositoryResult<ExampleEntity>> {
    try {
      const row = db.execute('SELECT * FROM examples WHERE id = ?', [id]);
      if (!row) return notFound(`Example not found: ${id}`);

      // 1. MAPPING (responsabilité du repository) : DB row → Snapshot
      const snapshot: ExampleEntitySnapshot = {
        id: row.id,
        title: row.title,
        status: row.status,
        ownerId: row.owner_id,           // snake_case → camelCase
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
      // 2. DÉSÉRIALISATION (responsabilité de l'entité) : Snapshot → Entity
      return success(ExampleEntity.reconstitute(snapshot));
    } catch (error) {
      return databaseError(`Failed to find example: ${error}`);
    }
  }

  async save(entity: ExampleEntity): Promise<RepositoryResult<void>> {
    try {
      // 1. SÉRIALISATION (responsabilité de l'entité) : Entity → Snapshot
      const s = entity.toSnapshot();
      // 2. MAPPING (responsabilité du repository) : Snapshot → DB row
      db.execute(
        'INSERT OR REPLACE INTO examples (id, title, status, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [s.id, s.title, s.status, s.ownerId, s.createdAt.toISOString(), s.updatedAt.toISOString()]
      );
      return success(undefined);
    } catch (error) {
      return databaseError(`Failed to save example: ${error}`);
    }
  }
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// 6. Exemple d'utilisation dans un Use Case
// ─────────────────────────────────────────────────────────────────────────────

/*
async function completeExample(id: string): Promise<RepositoryResult<void>> {
  const findResult = await repository.findById(id);
  if (findResult.type !== RepositoryResultType.SUCCESS) return findResult;

  const entity = findResult.data!;

  // Transition protégée — retourne businessError si état invalide
  const transitionResult = entity.complete();
  if (transitionResult.type !== RepositoryResultType.SUCCESS) return transitionResult;

  return repository.save(entity);
}
*/
