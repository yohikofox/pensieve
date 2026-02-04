/**
 * TodosExtracted Domain Event
 * Published when todos are successfully extracted and created from a capture
 *
 * Story 4.3 - Subtask 6.1: Create TodosExtracted event class
 * AC8: Todo Extraction Event Publishing
 */

export class TodosExtracted {
  constructor(
    public readonly captureId: string,
    public readonly thoughtId: string,
    public readonly userId: string,
    public readonly todoIds: string[],
    public readonly todosCount: number,
    public readonly extractedAt: Date,
  ) {}

  /**
   * Convert to JSON for event publishing
   */
  toJSON() {
    return {
      captureId: this.captureId,
      thoughtId: this.thoughtId,
      userId: this.userId,
      todoIds: this.todoIds,
      todosCount: this.todosCount,
      extractedAt: this.extractedAt,
    };
  }
}
