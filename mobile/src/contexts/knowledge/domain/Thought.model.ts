/**
 * Thought Model
 * Core entity in Knowledge Context containing AI-generated summary
 *
 * Story 5.1 - Subtask 1.2: Create TypeScript interfaces for Thought
 * Based on backend entity: backend/src/modules/knowledge/domain/entities/thought.entity.ts
 */

export interface Thought {
  id: string;
  captureId: string;
  userId: string;
  summary: string;
  confidenceScore?: number; // 0-1, for low confidence detection
  processingTimeMs: number; // Performance monitoring
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}
