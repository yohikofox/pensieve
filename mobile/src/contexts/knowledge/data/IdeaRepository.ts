/**
 * IdeaRepository - OP-SQLite implementation
 *
 * Story 5.1 - Task 10: Integration with Feed Screen
 * Repository for managing Ideas with OP-SQLite local storage
 */

import { injectable } from 'tsyringe';
import { open } from '@op-engineering/op-sqlite';
import type { IIdeaRepository } from '../domain/IIdeaRepository';
import type { Idea } from '../domain/Idea.model';

const DB_NAME = 'pensieve.db';

@injectable()
export class IdeaRepository implements IIdeaRepository {
  private db = open({ name: DB_NAME });

  async create(idea: Idea): Promise<void> {
    const query = `
      INSERT INTO ideas (id, thought_id, user_id, text, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.executeSync(query, [
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
    const result = this.db.executeSync('SELECT * FROM ideas WHERE id = ?', [id]);
    const rows = result.rows || [];

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToIdea(rows[0] as any);
  }

  async findByThoughtId(thoughtId: string): Promise<Idea[]> {
    const result = this.db.executeSync(
      `SELECT * FROM ideas
       WHERE thought_id = ?
       ORDER BY order_index ASC, created_at ASC`,
      [thoughtId]
    );
    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToIdea(row));
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
    this.db.executeSync(query, values);
  }

  async delete(id: string): Promise<void> {
    this.db.executeSync('DELETE FROM ideas WHERE id = ?', [id]);
  }

  async getAll(userId: string): Promise<Idea[]> {
    const result = this.db.executeSync(
      `SELECT * FROM ideas
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );
    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToIdea(row));
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
