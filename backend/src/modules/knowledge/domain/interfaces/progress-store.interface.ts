/**
 * Progress Store Interface
 * Abstraction for progress tracking storage (in-memory or Redis)
 *
 * Allows switching between:
 * - InMemoryProgressStore (development, single-instance)
 * - RedisProgressStore (production, multi-instance clusters)
 */

export interface JobProgress {
  captureId: string;
  userId: string;
  status: 'digesting' | 'completed' | 'failed';
  percentage: number;
  startedAt: Date;
  lastUpdatedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

export interface IProgressStore {
  /**
   * Start tracking a new job
   */
  startTracking(captureId: string, userId: string): Promise<void>;

  /**
   * Update job progress percentage
   */
  updateProgress(captureId: string, percentage: number): Promise<void>;

  /**
   * Mark job as completed
   */
  completeTracking(captureId: string): Promise<void>;

  /**
   * Mark job as failed
   */
  failTracking(captureId: string, error: string): Promise<void>;

  /**
   * Get progress for a specific job
   */
  getProgress(captureId: string): Promise<JobProgress | null>;

  /**
   * Get all active jobs for a user
   */
  getUserActiveJobs(userId: string): Promise<JobProgress[]>;

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(): Promise<void>;
}
