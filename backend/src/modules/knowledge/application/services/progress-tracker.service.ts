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
 * ✅ SCALABILITY: Pluggable storage backend
 *
 * Uses IProgressStore interface with 2 implementations:
 *   1. InMemoryProgressStore (dev, single-instance) - default
 *   2. RedisProgressStore (prod, multi-instance clusters)
 *
 * Switch via env var: PROGRESS_STORE_TYPE=redis|memory (default: memory)
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IProgressStore } from '../../domain/interfaces/progress-store.interface';

@Injectable()
export class ProgressTrackerService {
  private readonly logger = new Logger(ProgressTrackerService.name);

  constructor(
    @Inject('PROGRESS_STORE')
    private readonly progressStore: IProgressStore,
  ) {}

  /**
   * Start tracking a new digestion job
   * Subtask 4.1 & 4.2: Initialize status and timestamp
   *
   * @param captureId - Capture being processed
   * @param userId - User who owns the capture
   */
  async startTracking(captureId: string, userId: string): Promise<void> {
    await this.progressStore.startTracking(captureId, userId);
    this.logger.debug(`📊 Started tracking: ${captureId} (user: ${userId})`);
  }

  /**
   * Update progress percentage for a job
   * Subtask 4.5: Progress percentage calculation
   *
   * @param captureId - Capture being processed
   * @param percentage - Progress percentage (0-100)
   */
  async updateProgress(captureId: string, percentage: number): Promise<void> {
    // Clamp percentage between 0 and 100
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    await this.progressStore.updateProgress(captureId, clampedPercentage);
    this.logger.debug(
      `📈 Progress update: ${captureId} - ${clampedPercentage}%`,
    );
  }

  /**
   * Mark a job as completed
   *
   * @param captureId - Capture that finished processing
   */
  async completeTracking(captureId: string): Promise<void> {
    await this.progressStore.completeTracking(captureId);

    const progress = await this.progressStore.getProgress(captureId);
    if (progress) {
      this.logger.log(
        `✅ Completed tracking: ${captureId} (took ${progress.durationMs}ms)`,
      );
    }
  }

  /**
   * Mark a job as failed
   *
   * @param captureId - Capture that failed processing
   * @param errorMessage - Error description
   */
  async failTracking(captureId: string, errorMessage: string): Promise<void> {
    await this.progressStore.failTracking(captureId, errorMessage);

    const progress = await this.progressStore.getProgress(captureId);
    if (progress) {
      this.logger.error(
        `❌ Failed tracking: ${captureId} - ${errorMessage} (after ${progress.durationMs}ms)`,
      );
    }
  }

  /**
   * Get current progress for a job
   *
   * @param captureId - Capture to get progress for
   * @returns Job progress or null if not found
   */
  async getProgress(captureId: string) {
    return await this.progressStore.getProgress(captureId);
  }

  /**
   * Get all active jobs for a user
   *
   * @param userId - User to get jobs for
   * @returns List of user's active jobs
   */
  async getUserActiveJobs(userId: string) {
    return await this.progressStore.getUserActiveJobs(userId);
  }

  /**
   * Manual cleanup of old completed/failed jobs
   */
  async cleanupOldJobs(): Promise<void> {
    await this.progressStore.cleanup();
    this.logger.log(`🗑️  Cleanup completed`);
  }
}
