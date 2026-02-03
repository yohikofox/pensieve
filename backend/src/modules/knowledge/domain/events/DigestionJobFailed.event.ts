/**
 * DigestionJobFailed Domain Event
 * Published when a digestion job fails after max retries
 *
 * Used for AC5: Retry Logic and Error Handling
 */

export class DigestionJobFailed {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly error: string,
    public readonly retryCount: number,
    public readonly failedAt: Date,
  ) {}
}
