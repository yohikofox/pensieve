/**
 * IdeaRepository - OP-SQLite implementation
 *
 * Story 5.1 - Task 10: Integration with Feed Screen
 * Repository for managing Ideas with OP-SQLite local storage
 */

import { injectable } from 'tsyringe';
import { AbstractRepository } from '../../../shared/data/AbstractRepository';
import type { IIdeaRepository } from '../domain/IIdeaRepository';
import type { Idea } from '../domain/Idea.model';

@injectable()
export class IdeaRepository extends AbstractRepository implements IIdeaRepository {

  async create(idea: Idea): Promise<void> {
    const query = `
      INSERT INTO ideas (id, thought_id, user_id, text, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this.executeQuery(query, [
      idea.id,
      idea.thoughtId,
      idea.userId,
      idea.text,
      idea.orderIndex ?? null,
      idea.createdAt,
      idea.updatedAt,
    ]);
  }

  async findById(id: string): Promise<Idea | null> {
    const row = this.executeQueryOne<any>('SELECT * FROM ideas WHERE id = ?', [id]);
    return row ? this.mapRowToIdea(row) : null;
  }

  async findByThoughtId(thoughtId: string): Promise<Idea[]> {
    const { rows } = this.executeQuery<any>(
      `SELECT * FROM ideas
       WHERE thought_id = ?
       ORDER BY order_index ASC, created_at ASC`,
      [thoughtId]
    );
    return rows.map((row) => this.mapRowToIdea(row));
  }

  async update(id: string, changes: Partial<Idea>): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (changes.text !== undefined) {
      updates.push('text = ?');
      values.push(changes.text);
    }

    if (changes.orderIndex !== undefined) {
      updates.push('order_index = ?');
      values.push(changes.orderIndex);
    }

    // Always update updatedAt
    updates.push('updated_at = ?');
    values.push(Date.now());

    values.push(id); // For WHERE clause

    const query = `UPDATE ideas SET ${updates.join(', ')} WHERE id = ?`;
    this.executeQuery(query, values);
  }

  async delete(id: string): Promise<void> {
    this.executeQuery('DELETE FROM ideas WHERE id = ?', [id]);
  }

  async getAll(userId: string): Promise<Idea[]> {
    const { rows } = this.executeQuery<any>(
      `SELECT * FROM ideas
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((row) => this.mapRowToIdea(row));
  }

  private mapRowToIdea(row: any): Idea {
    return {
      id: row.id,
      thoughtId: row.thought_id,
      userId: row.user_id,
      text: row.text,
      orderIndex: row.order_index,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
