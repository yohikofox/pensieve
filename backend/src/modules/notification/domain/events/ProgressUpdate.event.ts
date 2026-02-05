/**
 * Progress Update Domain Event
 * Published when digestion job progress changes
 *
 * Story 4.4: Notifications de Progression IA
 * Task 2, Subtask 2.5: Create ProgressUpdate event with notification payload
 *
 * Covers:
 * - AC1: Queue Status Notification
 * - AC2: Active Processing Indicator
 * - AC6: Multi-Capture Progress Tracking
 *
 * This event is consumed by:
 * - NotificationService (to send local/push notifications)
 * - KnowledgeEventsGateway (to emit WebSocket progress updates)
 */

export class ProgressUpdate {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly status: 'queued' | 'processing' | 'completed' | 'failed',
    public readonly elapsed: number, // milliseconds since job started
    public readonly queuePosition?: number, // null if processing
    public readonly estimatedRemaining?: number, // milliseconds
    public readonly timestamp: Date = new Date(),
  ) {}

  toJSON() {
    return {
      captureId: this.captureId,
      userId: this.userId,
      status: this.status,
      elapsed: this.elapsed,
      queuePosition: this.queuePosition,
      estimatedRemaining: this.estimatedRemaining,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
