/**
 * Todo Model
 * Actionable task extracted from user captures
 *
 * Story 5.1 - Subtask 1.2: Create TypeScript interfaces for Todo
 * Based on backend entity: backend/src/modules/action/domain/entities/todo.entity.ts
 * AC1, AC2, AC4: Todo entity with all required fields
 */

export type TodoStatus = 'todo' | 'completed' | 'abandoned';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface Todo {
  id: string;
  thoughtId: string;
  ideaId?: string; // Optional - todo may be linked to specific idea
  captureId: string;
  userId: string;
  description: string;
  status: TodoStatus;
  deadline?: number; // Unix timestamp (ms), optional suggested deadline
  contact?: string; // Optional contact name associated with the action
  priority: TodoPriority;
  completedAt?: number; // Unix timestamp (ms), set when status = 'completed'
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}
