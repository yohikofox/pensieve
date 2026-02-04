/**
 * Progress Tracker Service
 * Tracks real-time progress of digestion jobs
 *
 * Covers:
 * - Subtask 4.1: Update Capture status to "digesting"
 * - Subtask 4.2: Add processing_started_at timestamp
 * - Subtask 4.5: Calculate progress percentage
 *
 * AC4: Real-Time Progress Updates
 *
 * ⚠️ SCALABILITY LIMITATION: In-memory storage
 *
 * CURRENT: Uses Map<captureId, JobProgress> in memory
 * WORKS FOR: Single-instance deployments, moderate load
 * FAILS FOR: Multi-instance clusters (different memory per instance)
 * IMPACT: Progress lost on restart, inconsistent across instances
 *
 * TODO Story 4.7: Migrate to external progress store
 * OPTIONS:
 *   1. Redis (recommended): Fast, distributed, supports pub/sub for real-time
 *   2. PostgreSQL: Persistent, transactional, but slower for real-time
 *   3. MongoDB: Document-based, good for flexible progress schema
 * MIGRATION: Keep Map as fallback, add RedisProgressStore with same interface
 */

import { Injectable, Logger } from '@nestjs/common';

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

@Injectable()
export class ProgressTrackerService {
  private readonly logger = new Logger(ProgressTrackerService.name);
  private readonly progressMap = new Map<string, JobProgress>();
  private readonly RETENTION_MS = 5 * 60 * 1000; // Keep completed jobs for 5 minutes

  /**
   * Start tracking a new digestion job
   * Subtask 4.1 & 4.2: Initialize status and timestamp
   *
   * @param captureId - Capture being processed
   * @param userId - User who owns the capture
   */
  startTracking(captureId: string, userId: string): void {
    const now = new Date();

    const progress: JobProgress = {
      captureId,
      userId,
      status: 'digesting',
      percentage: 0,
      startedAt: now,
      lastUpdatedAt: now,
    };

    this.progressMap.set(captureId, progress);

    this.logger.debug(`📊 Started tracking: ${captureId} (user: ${userId})`);
  }

  /**
   * Update progress percentage for a job
   * Subtask 4.5: Progress percentage calculation
   *
   * @param captureId - Capture being processed
   * @param percentage - Progress percentage (0-100)
   */
  updateProgress(captureId: string, percentage: number): void {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot update progress for unknown job: ${captureId}`);
      return;
    }

    // Clamp percentage between 0 and 100
    progress.percentage = Math.max(0, Math.min(100, percentage));
    progress.lastUpdatedAt = new Date();

    this.logger.debug(`📈 Progress update: ${captureId} - ${progress.percentage}%`);
  }

  /**
   * Mark a job as completed
   *
   * @param captureId - Capture that finished processing
   */
  completeTracking(captureId: string): void {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot complete tracking for unknown job: ${captureId}`);
      return;
    }

    const now = new Date();
    progress.status = 'completed';
    progress.percentage = 100;
    progress.completedAt = now;
    progress.durationMs = now.getTime() - progress.startedAt.getTime();
    progress.lastUpdatedAt = now;

    this.logger.log(
      `✅ Completed tracking: ${captureId} (took ${progress.durationMs}ms)`,
    );

    // Schedule cleanup after retention period
    setTimeout(() => {
      this.progressMap.delete(captureId);
      this.logger.debug(`🗑️  Cleaned up completed job: ${captureId}`);
    }, this.RETENTION_MS);
  }

  /**
   * Mark a job as failed
   *
   * @param captureId - Capture that failed processing
   * @param errorMessage - Error description
   */
  failTracking(captureId: string, errorMessage: string): void {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot fail tracking for unknown job: ${captureId}`);
      return;
    }

    const now = new Date();
    progress.status = 'failed';
    progress.error = errorMessage;
    progress.completedAt = now;
    progress.durationMs = now.getTime() - progress.startedAt.getTime();
    progress.lastUpdatedAt = now;

    this.logger.error(
      `❌ Failed tracking: ${captureId} - ${errorMessage} (after ${progress.durationMs}ms)`,
    );

    // Schedule cleanup after retention period
    setTimeout(() => {
      this.progressMap.delete(captureId);
      this.logger.debug(`🗑️  Cleaned up failed job: ${captureId}`);
    }, this.RETENTION_MS);
  }

  /**
   * Get current progress for a job
   *
   * @param captureId - Capture to get progress for
   * @returns Job progress or null if not found
   */
  getProgress(captureId: string): JobProgress | null {
    return this.progressMap.get(captureId) || null;
  }

  /**
   * Get all active (in-progress) jobs
   *
   * @returns List of jobs currently being processed
   */
  getAllActiveJobs(): JobProgress[] {
    return Array.from(this.progressMap.values()).filter(
      (progress) => progress.status === 'digesting',
    );
  }

  /**
   * Get all jobs for a specific user
   *
   * @param userId - User to get jobs for
   * @returns List of user's jobs (active, completed, failed)
   */
  getUserJobs(userId: string): JobProgress[] {
    return Array.from(this.progressMap.values()).filter(
      (progress) => progress.userId === userId,
    );
  }

  /**
   * Manual cleanup of old completed/failed jobs
   * Used for testing or manual maintenance
   *
   * @param retentionMs - Age threshold in milliseconds (default: RETENTION_MS)
   */
  cleanupOldJobs(retentionMs: number = this.RETENTION_MS): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [captureId, progress] of this.progressMap.entries()) {
      // Only cleanup completed or failed jobs
      if (progress.status !== 'digesting' && progress.completedAt) {
        const age = now - progress.completedAt.getTime();
        if (age >= retentionMs) {
          this.progressMap.delete(captureId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🗑️  Cleaned up ${cleanedCount} old jobs`);
    }
  }

  /**
   * Get service statistics
   * Useful for monitoring and debugging
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
  } {
    const all = Array.from(this.progressMap.values());

    return {
      total: all.length,
      active: all.filter((p) => p.status === 'digesting').length,
      completed: all.filter((p) => p.status === 'completed').length,
      failed: all.filter((p) => p.status === 'failed').length,
    };
  }
}
