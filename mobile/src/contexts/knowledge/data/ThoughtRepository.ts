/**
 * ThoughtRepository - OP-SQLite implementation
 *
 * Story 5.1 - Task 10.4: Integration with CaptureDetailScreen
 * Repository for managing Thoughts with OP-SQLite local storage
 */

import { injectable } from 'tsyringe';
import { AbstractRepository } from '../../../shared/data/AbstractRepository';
import type { IThoughtRepository } from '../domain/IThoughtRepository';
import type { Thought } from '../domain/Thought.model';

@injectable()
export class ThoughtRepository extends AbstractRepository implements IThoughtRepository {

  async findByCaptureId(captureId: string): Promise<Thought | null> {
    const row = this.executeQueryOne<any>(
      'SELECT * FROM thoughts WHERE capture_id = ? LIMIT 1',
      [captureId]
    );

    return row ? this.mapRowToThought(row) : null;
  }

  async create(thought: Thought): Promise<void> {
    const query = `
      INSERT INTO thoughts (
        id, capture_id, user_id, summary, confidence_score,
        processing_time_ms, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.executeQuery(query, [
      thought.id,
      thought.captureId,
      thought.userId,
      thought.summary,
      thought.confidenceScore ?? null,
      thought.processingTimeMs,
      thought.createdAt,
      thought.updatedAt,
    ]);
  }

  async findById(id: string): Promise<Thought | null> {
    const row = this.executeQueryOne<any>('SELECT * FROM thoughts WHERE id = ?', [id]);
    return row ? this.mapRowToThought(row) : null;
  }

  private mapRowToThought(row: any): Thought {
    return {
      id: row.id,
      captureId: row.capture_id,
      userId: row.user_id,
      summary: row.summary,
      confidenceScore: row.confidence_score,
      processingTimeMs: row.processing_time_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
