/**
 * PATTERN: Repository OP-SQLite (ADR-022)
 *
 * Source: src/contexts/capture/data/CaptureRepository.ts
 *
 * RÈGLES:
 * - @injectable() obligatoire sur la classe
 * - @inject(TOKEN) pour chaque dépendance dans le constructeur
 * - Toutes les mutations retournent RepositoryResult<T>
 * - Les lectures simples peuvent retourner T | null (findById, findAll)
 * - Chaque méthode a son propre try/catch
 * - Publier les events APRÈS l'opération DB, dans un try/catch séparé
 * - Les events ne doivent JAMAIS faire échouer l'opération principale
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../src/database';
import {
  type RepositoryResult,
  success,
  notFound,
  databaseError,
} from '../src/contexts/shared/domain/Result';
import { TOKENS } from '../src/infrastructure/di/tokens';
import type { EventBus } from '../src/contexts/shared/events/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Interface du repository (dans src/contexts/<ctx>/domain/I<Entity>Repository.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface IExampleEntity {
  id: string;
  name: string;
  createdAt: number;
}

interface IExampleRepository {
  create(name: string): Promise<RepositoryResult<IExampleEntity>>;
  findById(id: string): Promise<IExampleEntity | null>;
  findAll(): Promise<IExampleEntity[]>;
  delete(id: string): Promise<RepositoryResult<void>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : Implémentation repository
// ─────────────────────────────────────────────────────────────────────────────

@injectable()
export class ExampleRepository implements IExampleRepository {
  constructor(
    @inject('EventBus') private eventBus: EventBus,
    // Ajouter les autres dépendances avec leurs tokens
  ) {}

  async create(name: string): Promise<RepositoryResult<IExampleEntity>> {
    const id = uuidv4();
    const now = Date.now();

    try {
      database.execute(
        `INSERT INTO examples (id, name, created_at, _changed) VALUES (?, ?, ?, 1)`,
        [id, name, now],
      );

      const result = database.execute('SELECT * FROM examples WHERE id = ?', [id]);
      const row = result.rows?.[0] as { id: string; name: string; created_at: number } | undefined;

      if (!row) {
        return databaseError('Failed to create example: record not found after INSERT');
      }

      const entity: IExampleEntity = { id: row.id, name: row.name, createdAt: row.created_at };

      // Publier l'event APRÈS l'opération DB (best-effort)
      try {
        this.eventBus.publish({
          type: 'ExampleCreated',
          timestamp: Date.now(),
          payload: { entityId: entity.id },
        });
      } catch (eventError) {
        console.error('[ExampleRepository] Failed to publish ExampleCreated:', eventError);
        // ← Ne pas re-throw
      }

      return success(entity);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return databaseError(`Failed to create example: ${message}`);
    }
  }

  async findById(id: string): Promise<IExampleEntity | null> {
    // Lecture simple : null si absent (pas de RepositoryResult nécessaire)
    const result = database.execute('SELECT * FROM examples WHERE id = ?', [id]);
    const row = result.rows?.[0] as { id: string; name: string; created_at: number } | undefined;
    return row ? { id: row.id, name: row.name, createdAt: row.created_at } : null;
  }

  async findAll(): Promise<IExampleEntity[]> {
    const result = database.execute(
      `SELECT * FROM examples WHERE (_status IS NULL OR _status != 'deleted') ORDER BY created_at DESC`
    );
    const rows = (result.rows ?? []) as Array<{ id: string; name: string; created_at: number }>;
    return rows.map(row => ({ id: row.id, name: row.name, createdAt: row.created_at }));
  }

  async delete(id: string): Promise<RepositoryResult<void>> {
    try {
      database.execute('DELETE FROM examples WHERE id = ?', [id]);
      return success(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return databaseError(`Failed to delete example: ${message}`);
    }
  }
}
