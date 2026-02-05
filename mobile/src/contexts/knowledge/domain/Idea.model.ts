/**
 * Idea Model
 * Individual key idea extracted from capture
 *
 * Story 5.1 - Subtask 1.2: Create TypeScript interfaces for Idea
 * Based on backend entity: backend/src/modules/knowledge/domain/entities/idea.entity.ts
 */

export interface Idea {
  id: string;
  thoughtId: string;
  userId: string;
  text: string;
  orderIndex?: number; // Preserve order from GPT response
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}
