/**
 * DigestionJobFailed Domain Event
 * Published when a digestion job fails after max retry attempts
 *
 * Covers:
 * - Subtask 5.5: Publish Domain Event "DigestionJobFailed" for alerting
 *
 * AC5: Retry Logic and Error Handling
 */

export class DigestionJobFailed {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly errorMessage: string,
    public readonly stackTrace: string,
    public readonly retryCount: number,
    public readonly failedAt: Date,
    public readonly jobPayload: Record<string, any>,
  ) {}

  /**
   * Serialize event for logging or external systems
   */
  toJSON() {
    return {
      eventType: 'DigestionJobFailed',
      captureId: this.captureId,
      userId: this.userId,
      errorMessage: this.errorMessage,
      stackTrace: this.stackTrace,
      retryCount: this.retryCount,
      failedAt: this.failedAt.toISOString(),
      jobPayload: this.jobPayload,
    };
  }
}
