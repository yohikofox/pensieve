/**
 * IIdeaRepository Interface
 * Repository for managing Ideas in local storage
 *
 * Story 5.1 - Task 10: Integration with Feed Screen
 * Repository interface for fetching ideas to display with todos
 */

import type { Idea } from './Idea.model';

export interface IIdeaRepository {
  /**
   * Create a new idea
   */
  create(idea: Idea): Promise<void>;

  /**
   * Find idea by ID
   */
  findById(id: string): Promise<Idea | null>;

  /**
   * Find all ideas for a specific thought
   * Used to display ideas in CaptureDetailScreen
   */
  findByThoughtId(thoughtId: string): Promise<Idea[]>;

  /**
   * Update an existing idea
   */
  update(id: string, changes: Partial<Idea>): Promise<void>;

  /**
   * Delete an idea
   */
  delete(id: string): Promise<void>;

  /**
   * Get all ideas for a user
   */
  getAll(userId: string): Promise<Idea[]>;
}
