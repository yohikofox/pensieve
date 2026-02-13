import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLog } from '../../domain/entities/sync-log.entity';

/**
 * Sync Metrics Service (AC7 - Task 6.3)
 *
 * Collects and aggregates sync metrics for monitoring dashboard.
 * Metrics: duration, success rate, failure patterns, volume.
 */

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  successRate: number; // Percentage
  avgDurationMs: number;
  p95DurationMs: number; // 95th percentile
  totalRecordsSynced: number;
  syncsLast24h: number;
  syncsLast7d: number;
  recentFailures: RecentFailure[];
}

export interface RecentFailure {
  userId: string;
  syncType: 'pull' | 'push';
  failedAt: Date;
  errorMessage: string | null;
  consecutiveFailures: number;
}

export interface UserSyncStats {
  userId: string;
  totalSyncs: number;
  failedSyncs: number;
  lastSyncAt: Date | null;
  avgDurationMs: number;
  consecutiveFailures: number; // For alerting
}

@Injectable()
export class SyncMetricsService {
  private readonly logger = new Logger(SyncMetricsService.name);

  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  /**
   * Get global sync metrics (all users)
   */
  async getGlobalMetrics(): Promise<SyncMetrics> {
    this.logger.debug('Computing global sync metrics');

    // Total syncs
    const totalSyncs = await this.syncLogRepository.count();

    // Success/failure counts
    const successfulSyncs = await this.syncLogRepository.count({
      where: { status: 'success' },
    });
    const failedSyncs = await this.syncLogRepository.count({
      where: { status: 'error' },
    });

    // Success rate
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    // Average duration (only successful syncs)
    const avgDurationResult = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('AVG(log.durationMs)', 'avg')
      .where('log.status = :status', { status: 'success' })
      .andWhere('log.durationMs IS NOT NULL')
      .getRawOne();

    const avgDurationMs = avgDurationResult?.avg ? Math.round(parseFloat(avgDurationResult.avg)) : 0;

    // 95th percentile duration (for performance monitoring)
    const p95DurationResult = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY log.durationMs)', 'p95')
      .where('log.status = :status', { status: 'success' })
      .andWhere('log.durationMs IS NOT NULL')
      .getRawOne();

    const p95DurationMs = p95DurationResult?.p95 ? Math.round(parseFloat(p95DurationResult.p95)) : 0;

    // Total records synced
    const recordsResult = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.recordsSynced)', 'total')
      .getRawOne();

    const totalRecordsSynced = recordsResult?.total ? parseInt(recordsResult.total, 10) : 0;

    // Syncs in last 24 hours
    const syncsLast24h = await this.syncLogRepository
      .createQueryBuilder('log')
      .where('log.startedAt > NOW() - INTERVAL \'24 hours\'')
      .getCount();

    // Syncs in last 7 days
    const syncsLast7d = await this.syncLogRepository
      .createQueryBuilder('log')
      .where('log.startedAt > NOW() - INTERVAL \'7 days\'')
      .getCount();

    // Recent failures (last 24h, for alerting)
    const recentFailures = await this.getRecentFailures();

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      successRate: Math.round(successRate * 100) / 100, // 2 decimals
      avgDurationMs,
      p95DurationMs,
      totalRecordsSynced,
      syncsLast24h,
      syncsLast7d,
      recentFailures,
    };
  }

  /**
   * Get sync stats for a specific user
   */
  async getUserStats(userId: string): Promise<UserSyncStats> {
    this.logger.debug(`Computing sync stats for user ${userId}`);

    const totalSyncs = await this.syncLogRepository.count({
      where: { userId },
    });

    const failedSyncs = await this.syncLogRepository.count({
      where: { userId, status: 'error' },
    });

    // Last sync timestamp
    const lastSync = await this.syncLogRepository.findOne({
      where: { userId },
      order: { startedAt: 'DESC' },
    });

    const lastSyncAt = lastSync?.startedAt || null;

    // Average duration for this user
    const avgDurationResult = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('AVG(log.durationMs)', 'avg')
      .where('log.userId = :userId', { userId })
      .andWhere('log.status = :status', { status: 'success' })
      .andWhere('log.durationMs IS NOT NULL')
      .getRawOne();

    const avgDurationMs = avgDurationResult?.avg ? Math.round(parseFloat(avgDurationResult.avg)) : 0;

    // Consecutive failures (for alerting - Task 6.5)
    const consecutiveFailures = await this.countConsecutiveFailures(userId);

    return {
      userId,
      totalSyncs,
      failedSyncs,
      lastSyncAt,
      avgDurationMs,
      consecutiveFailures,
    };
  }

  /**
   * Get recent sync failures (last 24h)
   */
  private async getRecentFailures(): Promise<RecentFailure[]> {
    const failures = await this.syncLogRepository
      .createQueryBuilder('log')
      .where('log.status = :status', { status: 'error' })
      .andWhere('log.startedAt > NOW() - INTERVAL \'24 hours\'')
      .orderBy('log.startedAt', 'DESC')
      .limit(50)
      .getMany();

    // Count consecutive failures per user
    const failuresWithCount: RecentFailure[] = [];

    for (const failure of failures) {
      const consecutiveFailures = await this.countConsecutiveFailures(failure.userId);

      failuresWithCount.push({
        userId: failure.userId,
        syncType: failure.syncType,
        failedAt: failure.startedAt,
        errorMessage: failure.errorMessage,
        consecutiveFailures,
      });
    }

    return failuresWithCount;
  }

  /**
   * Count consecutive failures for a user (for alerting - Task 6.5)
   *
   * Returns number of failures since last success.
   * Used to trigger alerts if > 3 consecutive failures.
   */
  private async countConsecutiveFailures(userId: string): Promise<number> {
    // Get recent sync logs for user (newest first)
    const recentLogs = await this.syncLogRepository.find({
      where: { userId },
      order: { startedAt: 'DESC' },
      take: 10, // Check last 10 syncs
    });

    let consecutiveFailures = 0;

    for (const log of recentLogs) {
      if (log.status === 'error') {
        consecutiveFailures++;
      } else {
        // Stop counting at first success
        break;
      }
    }

    return consecutiveFailures;
  }

  /**
   * Get users with repeated failures (> threshold)
   * For alerting system (Task 6.5)
   */
  async getUsersWithRepeatedFailures(
    threshold: number = 3,
  ): Promise<UserSyncStats[]> {
    this.logger.debug(`Finding users with >${threshold} consecutive failures`);

    // Get all users with recent failures
    const usersWithFailures = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.userId', 'userId')
      .where('log.status = :status', { status: 'error' })
      .andWhere('log.startedAt > NOW() - INTERVAL \'24 hours\'')
      .getRawMany();

    const usersAboveThreshold: UserSyncStats[] = [];

    for (const { userId } of usersWithFailures) {
      const stats = await this.getUserStats(userId);

      if (stats.consecutiveFailures >= threshold) {
        usersAboveThreshold.push(stats);
      }
    }

    return usersAboveThreshold;
  }

  /**
   * Get daily sync volume trend (last 7 days)
   * For monitoring dashboard charts
   */
  async getDailySyncTrend(): Promise<Array<{ date: string; syncs: number; failures: number }>> {
    const trend = await this.syncLogRepository
      .createQueryBuilder('log')
      .select('DATE(log.startedAt)', 'date')
      .addSelect('COUNT(*)', 'syncs')
      .addSelect('SUM(CASE WHEN log.status = \'error\' THEN 1 ELSE 0 END)', 'failures')
      .where('log.startedAt > NOW() - INTERVAL \'7 days\'')
      .groupBy('DATE(log.startedAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return trend.map((row) => ({
      date: row.date,
      syncs: parseInt(row.syncs, 10),
      failures: parseInt(row.failures, 10),
    }));
  }
}
