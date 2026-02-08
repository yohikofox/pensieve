/**
 * Todo Repository Interface
 * Defines CRUD operations for Todo entity (OP-SQLite)
 *
 * Story 5.1 - Subtask 1.3: Define TodoRepository interface
 * AC1, AC2: Support querying todos by ideaId with sorting
 * Story 5.2 - Task 7: Source preview with Thought/Idea context
 */

import { Todo } from './Todo.model';
import { Thought } from '../../knowledge/domain/Thought.model';
import { Idea } from '../../knowledge/domain/Idea.model';

/**
 * Todo with source context (Thought + Idea)
 * Story 5.2 - AC6: Source preview in Actions tab
 */
export interface TodoWithSource extends Todo {
  thought?: Thought;
  idea?: Idea;
}

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
   * @returns true if update was applied, false if no changes detected
   */
  update(id: string, changes: Partial<Todo>): Promise<boolean>;

  /**
   * Delete a todo
   * @param id - Todo UUID
   */
  delete(id: string): Promise<void>;

  /**
   * Delete all completed todos (bulk delete)
   * Story 5.4 - AC10, Task 11: Bulk delete completed todos
   * @returns Number of todos deleted
   */
  deleteCompleted(): Promise<number>;

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

  /**
   * Find all todos sorted for Actions screen
   * Story 5.3 - Task 3: Fetch all todos (filtering happens client-side)
   * @returns Array of all todos (active + completed) sorted by status, deadline, priority
   */
  findAll(): Promise<Todo[]>;

  /**
   * Count active todos (status = 'todo')
   * Story 5.2 - AC1: Badge count for Actions tab
   * @returns Number of active todos
   */
  countActive(): Promise<number>;

  /**
   * Count todos by status
   * Story 5.3 - AC1, Task 3: Count todos for filter badges
   * @param status - Status to count ('todo' or 'completed')
   * @returns Number of todos with given status
   */
  countByStatus(status: 'todo' | 'completed'): Promise<number>;

  /**
   * Count all todos grouped by status (optimized single query)
   * Story 5.3 - Code Review Fix #5: Performance optimization
   * @returns Object with counts: { all, active, completed }
   */
  countAllByStatus(): Promise<{ all: number; active: number; completed: number }>;

  /**
   * Find all todos with source context (Thought + Idea)
   * Story 5.2 - AC6, Task 7: Source preview in Actions tab
   * Story 5.3 - Fix: Returns ALL todos (active + completed) for filters
   * Optimized query with LEFT JOIN to avoid N+1 queries
   * @returns Array of ALL todos with thought and idea data
   */
  findAllWithSource(): Promise<TodoWithSource[]>;

  /**
   * Find all todos linked to a specific analysis via analysis_todos
   * @param analysisId - CaptureAnalysis UUID
   * @returns Array of todos ordered by action_item_index ASC
   */
  findByAnalysisId(analysisId: string): Promise<Todo[]>;
}
