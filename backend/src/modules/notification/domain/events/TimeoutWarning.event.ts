/**
 * Timeout Warning Domain Event
 * Published when digestion job approaches timeout threshold
 *
 * Story 4.4: Notifications de Progression IA
 * Task 11, Subtask 11.2: Emit TimeoutWarning event when threshold approached
 *
 * Covers:
 * - AC9: Timeout Warning Notification
 *
 * Threshold: 30s (approaching NFR3 target of <30s for standard captures)
 */

export class TimeoutWarning {
  constructor(
    public readonly captureId: string,
    public readonly userId: string,
    public readonly elapsed: number, // milliseconds
    public readonly threshold: number, // 30000ms
    public readonly timestamp: Date = new Date(),
  ) {}

  toJSON() {
    return {
      captureId: this.captureId,
      userId: this.userId,
      elapsed: this.elapsed,
      threshold: this.threshold,
      timestamp: this.timestamp.toISOString(),
    };
  }
}
