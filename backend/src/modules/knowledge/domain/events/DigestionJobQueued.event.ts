/**
 * DigestionJobQueued Domain Event
 * Published when a digestion job is successfully queued to RabbitMQ
 *
 * Covers Subtask 2.5: Publish Domain Event "DigestionJobQueued" for observability
 */

export class DigestionJobQueued {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly queuedAt: Date,
    public readonly priority: 'high' | 'normal',
  ) {}
}
