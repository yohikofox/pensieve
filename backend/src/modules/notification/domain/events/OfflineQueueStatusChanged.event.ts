/**
 * Offline Queue Status Changed Domain Event
 * Published when network status changes affect offline queue
 *
 * Story 4.4: Notifications de Progression IA
 * Task 10, Subtask 10.4: Emit notification when network returns
 *
 * Covers:
 * - AC8: Offline Queue Notification
 */

export class OfflineQueueStatusChanged {
  constructor(
    public readonly userId: string,
    public readonly queuedCount: number,
    public readonly isOnline: boolean,
    public readonly timestamp: Date = new Date(),
  ) {}

  toJSON() {
    return {
      userId: this.userId,
      queuedCount: this.queuedCount,
      isOnline: this.isOnline,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
