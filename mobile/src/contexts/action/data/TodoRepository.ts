/**
 * Todo Repository Implementation (OP-SQLite)
 * CRUD operations for Todo entity
 *
 * Story 5.1 - Subtask 1.3: Implement TodoRepository with CRUD operations
 * AC1, AC2: Query todos by ideaId with sorting (priority desc, createdAt asc)
 */

import { injectable, inject } from "tsyringe";
import { database } from "../../../database";
import { Todo, TodoStatus } from "../domain/Todo.model";
import { ITodoRepository, TodoWithSource } from "../domain/ITodoRepository";
import { Thought } from "../../knowledge/domain/Thought.model";
import { Idea } from "../../knowledge/domain/Idea.model";
import { SyncTrigger } from "../../../infrastructure/sync/SyncTrigger";
import {
  RepositoryResult,
  RepositoryResultType,
  success,
  notFound,
  databaseError,
} from "../../shared/domain/Result";

@injectable()
export class TodoRepository implements ITodoRepository {
  constructor(@inject(SyncTrigger) private syncTrigger: SyncTrigger) {}

  /**
   * Create a new todo
   * AC1: Store todos in OP-SQLite
   */
  async create(todo: Todo): Promise<void> {
    // Story 6.2 Task 4.2: SET _changed = 1 for sync tracking
    database.execute(
      `INSERT INTO todos (
        id, thought_id, idea_id, capture_id, user_id,
        status, description, deadline, contact, priority, completed_at,
        created_at, updated_at, _changed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        todo.id,
        todo.thoughtId,
        todo.ideaId ?? null,
        todo.captureId,
        todo.userId,
        todo.status,
        todo.description,
        todo.deadline ?? null,
        todo.contact ?? null,
        todo.priority,
        todo.completedAt ?? null,
        todo.createdAt,
        todo.updatedAt,
      ],
    );

    // Story 6.2 Task 3.3: Trigger real-time sync after create (AC3)
    // ADR-023 Fix: SyncTrigger now returns Result<void>
    const syncResult = this.syncTrigger.queueSync({ entity: 'todos' });
    if (syncResult.type !== RepositoryResultType.SUCCESS) {
      console.error("[TodoRepository] Failed to trigger sync:", syncResult.error);
    }
  }

  /**
   * Find todo by ID
   * @returns Todo or null if not found
   */
  async findById(id: string): Promise<Todo | null> {
    const result = database.execute("SELECT * FROM todos WHERE id = ?", [id]);

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
    if (!ideaId || ideaId.trim() === "") {
      // Return empty array if ideaId is invalid (prevents SQL errors)
      console.warn("[TodoRepository] findByIdeaId called with empty ideaId");
      return [];
    }

    const result = database.execute(
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
      [ideaId],
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
    const result = database.execute(
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
      [thoughtId],
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
      fields.push("description = ?");
      values.push(changes.description);
    }

    if (changes.deadline !== undefined) {
      fields.push("deadline = ?");
      values.push(changes.deadline ?? null);
    }

    if (changes.contact !== undefined) {
      fields.push("contact = ?");
      values.push(changes.contact ?? null);
    }

    if (changes.priority !== undefined) {
      fields.push("priority = ?");
      values.push(changes.priority);
    }

    if (changes.status !== undefined) {
      fields.push("status = ?");
      values.push(changes.status);
    }

    if (changes.completedAt !== undefined) {
      fields.push("completed_at = ?");
      values.push(changes.completedAt ?? null);
    }

    // Always update updatedAt
    fields.push("updated_at = ?");
    values.push(Date.now());

    // Story 6.2 Task 4.2: SET _changed = 1 for sync tracking
    fields.push("_changed = 1");

    // Add id to the end
    values.push(id);

    if (fields.length === 1) {
      // Only updatedAt was set, no actual changes (Issue #9 fix: return false)
      console.debug(
        "[TodoRepository] update() called with no actual changes for todo:",
        id,
      );
      return false;
    }

    database.execute(
      `UPDATE todos SET ${fields.join(", ")} WHERE id = ?`,
      values,
    );

    // Story 6.2 Task 3.3: Trigger real-time sync after update (AC3)
    // ADR-023 Fix: SyncTrigger now returns Result<void>
    const syncResult = this.syncTrigger.queueSync({ entity: 'todos' });
    if (syncResult.type !== RepositoryResultType.SUCCESS) {
      console.error("[TodoRepository] Failed to trigger sync:", syncResult.error);
    }

    return true;
  }

  /**
   * Delete a todo
   * @param id - Todo UUID
   */
  async delete(id: string): Promise<void> {
    database.execute("DELETE FROM todos WHERE id = ?", [id]);
  }

  /**
   * Delete all completed todos (bulk delete)
   * Story 5.4 - AC10, Task 11: Bulk delete completed todos
   * @returns Number of todos deleted
   */
  async deleteCompleted(): Promise<number> {
    const result = database.execute(`DELETE FROM todos WHERE status = ?`, [
      "completed",
    ]);

    return result.rowsAffected || 0;
  }

  /**
   * Toggle todo status between 'todo' and 'completed'
   * AC8, FR19: Checkbox toggle with optimistic UI
   * @param id - Todo UUID
   * @returns Result with updated todo, or not_found / database_error
   */
  async toggleStatus(id: string): Promise<RepositoryResult<Todo>> {
    // Fetch current todo
    const current = await this.findById(id);

    if (!current) {
      return notFound(`Todo not found: ${id}`);
    }

    // Determine new status and completedAt
    const newStatus: TodoStatus =
      current.status === "completed" ? "todo" : "completed";
    const completedAt = newStatus === "completed" ? Date.now() : null;

    // Update status and completedAt
    // Story 6.2 Task 4.2: SET _changed = 1 for sync tracking
    database.execute(
      `UPDATE todos
       SET status = ?, completed_at = ?, updated_at = ?, _changed = 1
       WHERE id = ?`,
      [newStatus, completedAt, Date.now(), id],
    );

    // Story 6.2 Task 3.3: Trigger real-time sync after toggle (AC3)
    // ADR-023 Fix: SyncTrigger now returns Result<void>
    const syncResult = this.syncTrigger.queueSync({ entity: 'todos' });
    if (syncResult.type !== RepositoryResultType.SUCCESS) {
      console.error("[TodoRepository] Failed to trigger sync:", syncResult.error);
    }

    // Fetch and return updated todo
    const updated = await this.findById(id);

    if (!updated) {
      return databaseError(`Todo disappeared after toggle: ${id}`);
    }

    return success(updated);
  }

  /**
   * Get all todos (for debugging/testing)
   * @returns All todos in database
   */
  async getAll(): Promise<Todo[]> {
    const result = database.execute(
      "SELECT * FROM todos ORDER BY created_at DESC",
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Find all todos sorted for Actions screen
   * Story 5.3 - Task 3: Fetch all todos (filtering happens client-side)
   * Sorted by: deadline (ASC nulls last), priority (DESC)
   * @returns Array of all todos (active + completed)
   */
  async findAll(): Promise<Todo[]> {
    const result = database.execute(
      `SELECT * FROM todos
       ORDER BY
         CASE WHEN status = 'todo' THEN 0 ELSE 1 END ASC,
         CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC,
         deadline ASC,
         CASE priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END ASC,
         created_at ASC`,
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Count active todos (status = 'todo')
   * Story 5.2 - AC1: Badge count for Actions tab
   * @returns Number of active todos
   */
  async countActive(): Promise<number> {
    const result = database.execute(
      `SELECT COUNT(*) as count FROM todos WHERE status = 'todo'`,
    );

    const rows = result.rows || [];
    if (rows.length === 0) {
      return 0;
    }

    return rows[0].count as number;
  }

  /**
   * Count todos by status
   * Story 5.3 - AC1, Task 3: Count todos for filter badges
   * @param status - Status to count ('todo' or 'completed')
   * @returns Number of todos with given status
   */
  async countByStatus(status: "todo" | "completed"): Promise<number> {
    const result = database.execute(
      `SELECT COUNT(*) as count FROM todos WHERE status = ?`,
      [status],
    );

    const rows = result.rows || [];
    if (rows.length === 0) {
      return 0;
    }

    return rows[0].count as number;
  }

  /**
   * Count all todos grouped by status (optimized single query)
   * Story 5.3 - Code Review Fix #5: Performance optimization
   * @returns Object with counts: { all, active, completed }
   */
  async countAllByStatus(): Promise<{
    all: number;
    active: number;
    completed: number;
  }> {
    const result = database.execute(
      `SELECT
        COUNT(*) as all_count,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count
       FROM todos`,
    );

    const rows = result.rows || [];
    if (rows.length === 0) {
      return { all: 0, active: 0, completed: 0 };
    }

    const row = rows[0];
    return {
      all: (row.all_count as number) || 0,
      active: (row.active_count as number) || 0,
      completed: (row.completed_count as number) || 0,
    };
  }

  /**
   * Find all todos with source context (Thought + Idea)
   * Story 5.2 - AC6, Task 7: Source preview in Actions tab
   * Story 5.3 - Fix: Return ALL todos (active + completed) for filters
   *
   * Optimized query with LEFT JOIN to fetch Thought and Idea in one query
   * Avoids N+1 queries for better performance
   *
   * @returns Array of ALL todos with thought and idea data (active + completed)
   */
  async findAllWithSource(): Promise<TodoWithSource[]> {
    const result = database.execute(
      `SELECT
        t.*,
        th.id as thought_id_data,
        th.capture_id as thought_capture_id,
        th.user_id as thought_user_id,
        th.summary as thought_summary,
        th.confidence_score as thought_confidence_score,
        th.processing_time_ms as thought_processing_time_ms,
        th.created_at as thought_created_at,
        th.updated_at as thought_updated_at,
        i.id as idea_id_data,
        i.thought_id as idea_thought_id,
        i.user_id as idea_user_id,
        i.text as idea_text,
        i.order_index as idea_order_index,
        i.created_at as idea_created_at,
        i.updated_at as idea_updated_at
       FROM todos t
       LEFT JOIN thoughts th ON t.thought_id = th.id
       LEFT JOIN ideas i ON t.idea_id = i.id
       ORDER BY
         CASE WHEN t.status = 'todo' THEN 0 ELSE 1 END ASC,
         CASE WHEN t.deadline IS NULL THEN 1 ELSE 0 END ASC,
         t.deadline ASC,
         CASE t.priority
           WHEN 'high' THEN 0
           WHEN 'medium' THEN 1
           WHEN 'low' THEN 2
         END ASC,
         t.created_at ASC`,
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodoWithSource(row));
  }

  /**
   * Find all todos linked to a specific analysis via analysis_todos
   * @param analysisId - CaptureAnalysis UUID
   * @returns Array of todos ordered by action_item_index ASC
   */
  async findByAnalysisId(analysisId: string): Promise<Todo[]> {
    const result = database.execute(
      `SELECT t.* FROM todos t
       JOIN analysis_todos at ON at.todo_id = t.id
       WHERE at.analysis_id = ?
       ORDER BY at.action_item_index ASC`,
      [analysisId],
    );

    const rows = result.rows || [];
    return rows.map((row: any) => this.mapRowToTodo(row));
  }

  /**
   * Map SQLite row to TodoWithSource model
   * Handles joined Thought and Idea data
   */
  private mapRowToTodoWithSource(row: any): TodoWithSource {
    const todo = this.mapRowToTodo(row);

    // Map Thought if exists
    const thought: Thought | undefined = row.thought_id_data
      ? {
          id: row.thought_id_data,
          captureId: row.thought_capture_id,
          userId: row.thought_user_id,
          summary: row.thought_summary,
          confidenceScore: row.thought_confidence_score ?? undefined,
          processingTimeMs: row.thought_processing_time_ms,
          createdAt: row.thought_created_at,
          updatedAt: row.thought_updated_at,
        }
      : undefined;

    // Map Idea if exists
    const idea: Idea | undefined = row.idea_id_data
      ? {
          id: row.idea_id_data,
          thoughtId: row.idea_thought_id,
          userId: row.idea_user_id,
          text: row.idea_text,
          orderIndex: row.idea_order_index ?? undefined,
          createdAt: row.idea_created_at,
          updatedAt: row.idea_updated_at,
        }
      : undefined;

    return {
      ...todo,
      thought,
      idea,
    };
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
      contact: row.contact ?? undefined,
      priority: row.priority,
      completedAt: row.completed_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
