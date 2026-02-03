/**
 * DigestionJobStarted Domain Event
 * Published when a worker picks up a digestion job for processing
 *
 * Used for AC4: Real-Time Progress Updates
 */

export class DigestionJobStarted {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly startedAt: Date,
  ) {}
}
