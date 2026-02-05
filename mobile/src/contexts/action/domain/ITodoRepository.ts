/**
 * Todo Repository Interface
 * Defines CRUD operations for Todo entity (OP-SQLite)
 *
 * Story 5.1 - Subtask 1.3: Define TodoRepository interface
 * AC1, AC2: Support querying todos by ideaId with sorting
 */

import { Todo } from './Todo.model';

export interface ITodoRepository {
  /**
   * Create a new todo
   * AC1: Store todos in OP-SQLite
   */
  create(todo: Todo): Promise<void>;

  /**
   * Find todo by ID
   * @returns Todo or null if not found
   */
  findById(id: string): Promise<Todo | null>;

  /**
   * Find all todos for a specific idea
   * AC1, AC2: Fetch todos for inline display, sorted by priority
   * @param ideaId - Idea UUID
   * @returns Array of todos sorted by: active first, then priority (high → medium → low)
   */
  findByIdeaId(ideaId: string): Promise<Todo[]>;

  /**
   * Find all todos for a specific thought
   * @param thoughtId - Thought UUID
   * @returns Array of todos sorted by: active first, then priority
   */
  findByThoughtId(thoughtId: string): Promise<Todo[]>;

  /**
   * Update an existing todo
   * AC6: Support editing description, deadline, priority
   * @param id - Todo UUID
   * @param changes - Partial todo fields to update
   */
  update(id: string, changes: Partial<Todo>): Promise<void>;

  /**
   * Delete a todo
   * @param id - Todo UUID
   */
  delete(id: string): Promise<void>;

  /**
   * Toggle todo status between 'todo' and 'completed'
   * AC8, FR19: Checkbox toggle with optimistic UI
   * @param id - Todo UUID
   * @returns Updated todo
   */
  toggleStatus(id: string): Promise<Todo>;

  /**
   * Get all todos (for debugging/testing)
   * @returns All todos in database
   */
  getAll(): Promise<Todo[]>;
}
