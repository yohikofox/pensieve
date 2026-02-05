/**
 * ThoughtRepository Interface
 *
 * Story 5.1 - Task 10.4: Integration with CaptureDetailScreen
 * Repository for managing Thoughts (AI-generated summaries) with OP-SQLite
 */

import type { Thought } from './Thought.model';

export interface IThoughtRepository {
  /**
   * Find thought by capture ID
   * @param captureId - Capture UUID
   * @returns Thought or null if not found
   */
  findByCaptureId(captureId: string): Promise<Thought | null>;

  /**
   * Create a new thought
   * @param thought - Thought entity
   */
  create(thought: Thought): Promise<void>;

  /**
   * Find thought by ID
   * @param id - Thought UUID
   * @returns Thought or null if not found
   */
  findById(id: string): Promise<Thought | null>;
}
