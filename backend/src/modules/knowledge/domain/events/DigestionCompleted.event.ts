/**
 * Digestion Completed Event
 * Published when AI digestion completes successfully
 *
 * Story 4.2 AC5: Real-Time Feed Update Notification
 * Subtask 5.4: Publish DigestionCompleted domain event
 */

export class DigestionCompleted {
  constructor(
    public readonly thoughtId: string,
    public readonly captureId: string,
    public readonly userId: string,
    public readonly summary: string,
    public readonly ideasCount: number,
    public readonly processingTimeMs: number,
    public readonly completedAt: Date,
  ) {}

  toJSON() {
    return {
      thoughtId: this.thoughtId,
      captureId: this.captureId,
      userId: this.userId,
      summary: this.summary,
      ideasCount: this.ideasCount,
      processingTimeMs: this.processingTimeMs,
      completedAt: this.completedAt.toISOString(),
    };
  }
}
