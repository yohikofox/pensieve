/**
 * Redis Progress Store
 * Stores job progress in Redis
 *
 * Suitable for:
 * - Production environments
 * - Multi-instance clusters
 * - Distributed deployments
 *
 * Benefits:
 * - Progress persists across restarts
 * - Shared across all instances
 * - Supports pub/sub for real-time updates (future)
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import type {
  IProgressStore,
  JobProgress,
} from '../../domain/interfaces/progress-store.interface';

@Injectable()
export class RedisProgressStore
  implements IProgressStore, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisProgressStore.name);
  private client: RedisClientType;
  private readonly RETENTION_SECONDS = 5 * 60; // 5 minutes TTL
  private readonly KEY_PREFIX = 'progress:';

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    this.client = createClient({ url: redisUrl });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('✓ Redis Progress Store connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis Progress Store disconnected');
  }

  private getKey(captureId: string): string {
    return `${this.KEY_PREFIX}${captureId}`;
  }

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

    await this.client.set(
      this.getKey(captureId),
      JSON.stringify(progress),
      { EX: this.RETENTION_SECONDS * 2 }, // 10 min TTL for active jobs
    );

    // Add to user's active jobs set
    await this.client.sAdd(`user:${userId}:active`, captureId);

    this.logger.debug(`Started tracking: ${captureId} (Redis)`);
  }

  async updateProgress(captureId: string, percentage: number): Promise<void> {
    const key = this.getKey(captureId);
    const data = await this.client.get(key);

    if (!data) {
      this.logger.warn(
        `Cannot update progress: ${captureId} not found in Redis`,
      );
      return;
    }

    const progress: JobProgress = JSON.parse(data);
    progress.percentage = percentage;
    progress.lastUpdatedAt = new Date();

    await this.client.set(key, JSON.stringify(progress), {
      KEEPTTL: true, // Keep existing TTL
    });
  }

  async completeTracking(captureId: string): Promise<void> {
    const key = this.getKey(captureId);
    const data = await this.client.get(key);

    if (!data) {
      this.logger.warn(
        `Cannot complete tracking: ${captureId} not found in Redis`,
      );
      return;
    }

    const progress: JobProgress = JSON.parse(data);
    const now = new Date();

    progress.status = 'completed';
    progress.percentage = 100;
    progress.completedAt = now;
    progress.lastUpdatedAt = now;
    progress.durationMs =
      now.getTime() - new Date(progress.startedAt).getTime();

    // Store with shorter TTL for completed jobs
    await this.client.set(key, JSON.stringify(progress), {
      EX: this.RETENTION_SECONDS,
    });

    // Remove from user's active jobs
    await this.client.sRem(`user:${progress.userId}:active`, captureId);
  }

  async failTracking(captureId: string, error: string): Promise<void> {
    const key = this.getKey(captureId);
    const data = await this.client.get(key);

    if (!data) {
      this.logger.warn(`Cannot fail tracking: ${captureId} not found in Redis`);
      return;
    }

    const progress: JobProgress = JSON.parse(data);
    const now = new Date();

    progress.status = 'failed';
    progress.error = error;
    progress.completedAt = now;
    progress.lastUpdatedAt = now;
    progress.durationMs =
      now.getTime() - new Date(progress.startedAt).getTime();

    // Store with shorter TTL for failed jobs
    await this.client.set(key, JSON.stringify(progress), {
      EX: this.RETENTION_SECONDS,
    });

    // Remove from user's active jobs
    await this.client.sRem(`user:${progress.userId}:active`, captureId);
  }

  async getProgress(captureId: string): Promise<JobProgress | null> {
    const data = await this.client.get(this.getKey(captureId));

    if (!data) {
      return null;
    }

    const progress: JobProgress = JSON.parse(data);

    // Deserialize Date objects
    progress.startedAt = new Date(progress.startedAt);
    progress.lastUpdatedAt = new Date(progress.lastUpdatedAt);
    if (progress.completedAt) {
      progress.completedAt = new Date(progress.completedAt);
    }

    return progress;
  }

  async getUserActiveJobs(userId: string): Promise<JobProgress[]> {
    const captureIds = await this.client.sMembers(`user:${userId}:active`);

    const activeJobs: JobProgress[] = [];

    for (const captureId of captureIds) {
      const progress = await this.getProgress(captureId);
      if (progress && progress.status === 'digesting') {
        activeJobs.push(progress);
      } else if (progress && progress.status !== 'digesting') {
        // Clean up stale entry
        await this.client.sRem(`user:${userId}:active`, captureId);
      }
    }

    return activeJobs;
  }

  async cleanup(): Promise<void> {
    // Redis handles cleanup automatically via TTL (EX parameter)
    // No manual cleanup needed
    this.logger.debug('Redis cleanup (automatic via TTL)');
  }
}
