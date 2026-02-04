/**
 * In-Memory Progress Store
 * Stores job progress in memory (Map)
 *
 * Suitable for:
 * - Development environments
 * - Single-instance deployments
 * - Testing
 *
 * Limitations:
 * - Progress lost on restart
 * - Not shared across instances (cluster-unsafe)
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IProgressStore, JobProgress } from '../../domain/interfaces/progress-store.interface';

@Injectable()
export class InMemoryProgressStore implements IProgressStore {
  private readonly logger = new Logger(InMemoryProgressStore.name);
  private readonly progressMap = new Map<string, JobProgress>();
  private readonly RETENTION_MS = 5 * 60 * 1000; // Keep completed jobs for 5 minutes

  async startTracking(captureId: string, userId: string): Promise<void> {
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
    this.logger.debug(`Started tracking: ${captureId}`);
  }

  async updateProgress(captureId: string, percentage: number): Promise<void> {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot update progress: ${captureId} not found`);
      return;
    }

    progress.percentage = percentage;
    progress.lastUpdatedAt = new Date();

    this.progressMap.set(captureId, progress);
  }

  async completeTracking(captureId: string): Promise<void> {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot complete tracking: ${captureId} not found`);
      return;
    }

    const now = new Date();
    progress.status = 'completed';
    progress.percentage = 100;
    progress.completedAt = now;
    progress.lastUpdatedAt = now;
    progress.durationMs = now.getTime() - progress.startedAt.getTime();

    this.progressMap.set(captureId, progress);

    // Schedule cleanup after retention period
    setTimeout(() => {
      this.progressMap.delete(captureId);
      this.logger.debug(`Cleaned up completed job: ${captureId}`);
    }, this.RETENTION_MS);
  }

  async failTracking(captureId: string, error: string): Promise<void> {
    const progress = this.progressMap.get(captureId);

    if (!progress) {
      this.logger.warn(`Cannot fail tracking: ${captureId} not found`);
      return;
    }

    const now = new Date();
    progress.status = 'failed';
    progress.error = error;
    progress.completedAt = now;
    progress.lastUpdatedAt = now;
    progress.durationMs = now.getTime() - progress.startedAt.getTime();

    this.progressMap.set(captureId, progress);

    // Schedule cleanup after retention period
    setTimeout(() => {
      this.progressMap.delete(captureId);
      this.logger.debug(`Cleaned up failed job: ${captureId}`);
    }, this.RETENTION_MS);
  }

  async getProgress(captureId: string): Promise<JobProgress | null> {
    return this.progressMap.get(captureId) || null;
  }

  async getUserActiveJobs(userId: string): Promise<JobProgress[]> {
    const activeJobs: JobProgress[] = [];

    for (const progress of this.progressMap.values()) {
      if (progress.userId === userId && progress.status === 'digesting') {
        activeJobs.push(progress);
      }
    }

    return activeJobs;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();

    for (const [captureId, progress] of this.progressMap.entries()) {
      if (progress.status !== 'digesting' && progress.completedAt) {
        const age = now - progress.completedAt.getTime();
        if (age > this.RETENTION_MS) {
          this.progressMap.delete(captureId);
          this.logger.debug(`Cleaned up old job: ${captureId}`);
        }
      }
    }
  }
}
