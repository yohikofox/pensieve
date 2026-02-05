/**
 * Todo Repository Implementation (OP-SQLite)
 * CRUD operations for Todo entity
 *
 * Story 5.1 - Subtask 1.3: Implement TodoRepository with CRUD operations
 * AC1, AC2: Query todos by ideaId with sorting (priority desc, createdAt asc)
 */

import { injectable, inject } from 'tsyringe';
import type { DB } from '@op-engineering/op-sqlite';
import { Todo, TodoStatus } from '../domain/Todo.model';
import { ITodoRepository } from '../domain/ITodoRepository';

@injectable()
export class TodoRepository implements ITodoRepository {
  constructor(@inject('DB') private readonly db: DB) {}

  /**
   * Create a new todo
   * AC1: Store todos in OP-SQLite
   */
  async create(todo: Todo): Promise<void> {
    this.db.executeSync(
      `INSERT INTO todos (
        id, thought_id, idea_id, capture_id, user_id,
        status, description, deadline, priority, completed_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        todo.id,
        todo.thoughtId,
        todo.ideaId ?? null,
        todo.captureId,
        todo.userId,
        todo.status,
        todo.description,
        todo.deadline ?? null,
        todo.priority,
        todo.completedAt ?? null,
        todo.createdAt,
        todo.updatedAt,
      ]
    );
  }

  /**
   * Find todo by ID
   * @returns Todo or null if not found
   */
  async findById(id: string): Promise<Todo | null> {
    const result = this.db.executeSync('SELECT * FROM todos WHERE id = ?', [id]);

    const rows = result.rows || [];
    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToTodo(rows[0]);
  }

  /**
   * Find all todos for a specific idea
   * AC1, AC2: Fetch todos for inline display, sorted by priority
   * Active todos first (status = 'todo'), then completed todos
   * Within each group: sorted by priority (high → medium → low)
   *
   * IMPORTANT (Issue #4 fix):
   * This query ONLY returns todos explicitly linked to the given ideaId.
   * Orphan todos (idea_id = NULL) are NOT returned by this query.
   * To fetch orphan todos, use findByThoughtId() or a dedicated findOrphanTodos() method.
   *
   * @param ideaId - Idea UUID (must not be null/empty)
   * @returns Array of todos sorted by: active first, then priority (high → medium → low)
   */
  async findByIdeaId(ideaId: string): Promise<Todo[]> {
    if (!ideaId || ideaId.trim() === '') {
      // Return empty array if ideaId is invalid (prevents SQL errors)
      console.warn('[TodoRepository] findByIdeaId called with empty ideaId');
      return [];
    }

    const result = this.db.executeSync(
      `SELECT * FROM todos
       WHERE idea_id = ?
       ORDER BY
         CASE WHEN status = 'todo' THEN 0 ELSE 1 END ASC,
         CASE priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END ASC,
         created_at ASC`,
      [ideaId]
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Find all todos for a specific thought
   * @param thoughtId - Thought UUID
   * @returns Array of todos sorted by: active first, then priority
   */
  async findByThoughtId(thoughtId: string): Promise<Todo[]> {
    const result = this.db.executeSync(
      `SELECT * FROM todos
       WHERE thought_id = ?
       ORDER BY
         CASE WHEN status = 'todo' THEN 0 ELSE 1 END ASC,
         CASE priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END ASC,
         created_at ASC`,
      [thoughtId]
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Update an existing todo
   * AC6: Support editing description, deadline, priority
   * @param id - Todo UUID
   * @param changes - Partial todo fields to update
   * @returns true if update was applied, false if no changes detected (Issue #9 fix)
   */
  async update(id: string, changes: Partial<Todo>): Promise<boolean> {
    // Build dynamic UPDATE statement based on provided changes
    const fields: string[] = [];
    const values: any[] = [];

    if (changes.description !== undefined) {
      fields.push('description = ?');
      values.push(changes.description);
    }

    if (changes.deadline !== undefined) {
      fields.push('deadline = ?');
      values.push(changes.deadline ?? null);
    }

    if (changes.priority !== undefined) {
      fields.push('priority = ?');
      values.push(changes.priority);
    }

    if (changes.status !== undefined) {
      fields.push('status = ?');
      values.push(changes.status);
    }

    if (changes.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(changes.completedAt ?? null);
    }

    // Always update updatedAt
    fields.push('updated_at = ?');
    values.push(Date.now());

    // Add id to the end
    values.push(id);

    if (fields.length === 1) {
      // Only updatedAt was set, no actual changes (Issue #9 fix: return false)
      console.debug('[TodoRepository] update() called with no actual changes for todo:', id);
      return false;
    }

    this.db.executeSync(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values);
    return true;
  }

  /**
   * Delete a todo
   * @param id - Todo UUID
   */
  async delete(id: string): Promise<void> {
    this.db.executeSync('DELETE FROM todos WHERE id = ?', [id]);
  }

  /**
   * Toggle todo status between 'todo' and 'completed'
   * AC8, FR19: Checkbox toggle with optimistic UI
   * @param id - Todo UUID
   * @returns Updated todo
   */
  async toggleStatus(id: string): Promise<Todo> {
    // Fetch current todo
    const current = await this.findById(id);

    if (!current) {
      throw new Error(`Todo not found: ${id}`);
    }

    // Determine new status and completedAt
    const newStatus: TodoStatus = current.status === 'completed' ? 'todo' : 'completed';
    const completedAt = newStatus === 'completed' ? Date.now() : null;

    // Update status and completedAt
    this.db.executeSync(
      `UPDATE todos
       SET status = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      [newStatus, completedAt, Date.now(), id]
    );

    // Fetch and return updated todo
    const updated = await this.findById(id);

    if (!updated) {
      throw new Error(`Todo disappeared after toggle: ${id}`);
    }

    return updated;
  }

  /**
   * Get all todos (for debugging/testing)
   * @returns All todos in database
   */
  async getAll(): Promise<Todo[]> {
    const result = this.db.executeSync('SELECT * FROM todos ORDER BY created_at DESC');

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Map SQLite row to Todo model
   * Handles snake_case to camelCase conversion and type mapping
   */
  private mapRowToTodo(row: any): Todo {
    return {
      id: row.id,
      thoughtId: row.thought_id,
      ideaId: row.idea_id ?? undefined,
      captureId: row.capture_id,
      userId: row.user_id,
      description: row.description,
      status: row.status as TodoStatus,
      deadline: row.deadline ?? undefined,
      priority: row.priority,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
