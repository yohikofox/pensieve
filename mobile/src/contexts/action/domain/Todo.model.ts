/**
 * Todo Model — Rich Domain Entity (ADR-031)
 * Actionable task extracted from user captures
 *
 * Story 5.1 - Subtask 1.2: Create TypeScript interfaces for Todo
 * Story 8.23 - Task 1: Migrate Todo from interface to rich class (ADR-031)
 *
 * Règles ADR-031 :
 * - Constructeur privé — utiliser fromSnapshot() pour la désérialisation
 * - Transitions d'état via méthodes métier retournant Result<void>
 * - toSnapshot() pour la sérialisation vers la persistence
 */

import {
  type RepositoryResult,
  success,
  businessError,
} from '../../shared/domain/Result';

export type TodoStatus = "todo" | "completed" | "abandoned";
export type TodoPriority = "low" | "medium" | "high";

/**
 * Snapshot — type plain pour la persistence et la sérialisation
 * Le repository gère le mapping DB row ↔ Snapshot
 * L'entité gère la sérialisation Snapshot ↔ Entity
 */
export interface TodoSnapshot {
  readonly id: string;
  readonly thoughtId: string;
  readonly ideaId: string | null;
  readonly captureId: string;
  readonly userId: string;
  readonly description: string;
  readonly status: TodoStatus;
  readonly deadline: number | null;
  readonly contact: string | null;
  readonly priority: TodoPriority;
  readonly completedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Todo — entité de domaine riche (ADR-031)
 * Encapsule les règles métier d'abandon, réactivation et complétion
 */
export class Todo {
  // ── Constructeur privé — jamais appelé directement ──────────────────────
  private constructor(
    readonly id: string,
    readonly thoughtId: string,
    readonly ideaId: string | null,
    readonly captureId: string,
    readonly userId: string,
    private _description: string,
    private _status: TodoStatus,
    private _deadline: number | null,
    private _contact: string | null,
    readonly priority: TodoPriority,
    private _completedAt: number | null,
    readonly createdAt: number,
    private _updatedAt: number,
  ) {}

  // ── Désérialisation depuis un Snapshot (pas de validation métier) ────────
  static fromSnapshot(s: TodoSnapshot): Todo {
    return new Todo(
      s.id,
      s.thoughtId,
      s.ideaId,
      s.captureId,
      s.userId,
      s.description,
      s.status,
      s.deadline,
      s.contact,
      s.priority,
      s.completedAt,
      s.createdAt,
      s.updatedAt,
    );
  }

  // ── Getters (lecture seule) ──────────────────────────────────────────────
  get description(): string { return this._description; }
  get status(): TodoStatus { return this._status; }
  get deadline(): number | null { return this._deadline; }
  get contact(): string | null { return this._contact; }
  get completedAt(): number | null { return this._completedAt; }
  get updatedAt(): number { return this._updatedAt; }

  // ── Transitions d'état (métier) ──────────────────────────────────────────

  /**
   * Abandonne la tâche — transition irréversible (sauf via reactivate)
   * AC1, AC3 : abandon doux, préserve l'historique
   */
  abandon(): RepositoryResult<void> {
    if (this._status === 'abandoned') {
      return businessError('Todo is already abandoned');
    }
    this._status = 'abandoned';
    this._updatedAt = Date.now();
    return success(undefined);
  }

  /**
   * Réactive une tâche abandonnée → status = 'todo'
   * AC5 : réactivation depuis la vue détail
   */
  reactivate(): RepositoryResult<void> {
    if (this._status !== 'abandoned') {
      return businessError(
        `Cannot reactivate: current status is '${this._status}', expected 'abandoned'`,
      );
    }
    this._status = 'todo';
    this._updatedAt = Date.now();
    return success(undefined);
  }

  /**
   * Complète la tâche — transition depuis 'todo' uniquement
   */
  complete(): RepositoryResult<void> {
    if (this._status === 'completed') {
      return businessError('Todo is already completed');
    }
    if (this._status === 'abandoned') {
      return businessError('Cannot complete an abandoned todo');
    }
    this._status = 'completed';
    this._completedAt = Date.now();
    this._updatedAt = Date.now();
    return success(undefined);
  }

  // ── Sérialisation vers la couche persistence ─────────────────────────────

  toSnapshot(): TodoSnapshot {
    return {
      id: this.id,
      thoughtId: this.thoughtId,
      ideaId: this.ideaId,
      captureId: this.captureId,
      userId: this.userId,
      description: this._description,
      status: this._status,
      deadline: this._deadline,
      contact: this._contact,
      priority: this.priority,
      completedAt: this._completedAt,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
