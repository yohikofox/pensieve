/**
 * SyncAdminController
 * Admin endpoints for sync monitoring and stats
 *
 * Story 6.1 - Task 6: Sync Monitoring & Logging
 * AC7: Sync monitoring & metrics
 */

import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SyncLog } from '../../domain/entities/sync-log.entity';
import { SyncConflict } from '../../domain/entities/sync-conflict.entity';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
// TODO: Add admin authorization guard when implemented
// import { RequirePermission } from '../../../authorization/infrastructure/decorators/require-permission.decorator';

@Controller('api/admin/sync')
@UseGuards(SupabaseAuthGuard) // TODO: Add admin role check
export class SyncAdminController {
  private readonly logger = new Logger(SyncAdminController.name);

  constructor(
    @InjectRepository(SyncLog)
    private readonly syncLogRepo: Repository<SyncLog>,
    @InjectRepository(SyncConflict)
    private readonly syncConflictRepo: Repository<SyncConflict>,
  ) {}

  /**
   * Get sync statistics and metrics
   * GET /api/admin/sync/stats?period=24h
   */
  @Get('stats')
  // @RequirePermission('admin.sync.view') // TODO: Uncomment when admin perms ready
  async getStats(@Query('period') period?: string) {
    const hours = this.parsePeriod(period || '24h');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    this.logger.log(`Fetching sync stats for last ${hours}h`);

    // Get all sync logs in period
    const logs = await this.syncLogRepo.find({
      where: {
        startedAt: MoreThan(since),
      },
      order: {
        startedAt: 'DESC',
      },
    });

    // Calculate metrics
    const totalSyncs = logs.length;
    const successfulSyncs = logs.filter((l) => l.status === 'success').length;
    const failedSyncs = logs.filter((l) => l.status === 'error').length;
    const timeoutSyncs = logs.filter((l) => l.status === 'timeout').length;

    const pullSyncs = logs.filter((l) => l.syncType === 'pull').length;
    const pushSyncs = logs.filter((l) => l.syncType === 'push').length;

    // Calculate durations (filter out nulls)
    const durations = logs
      .map((l) => l.durationMs)
      .filter((d): d is number => d !== null);
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Sort durations for percentiles
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.floor(durations.length * 0.5)] || 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] || 0;
    const p99 = durations[Math.floor(durations.length * 0.99)] || 0;

    // Total records synced
    const totalRecords = logs.reduce((sum, l) => sum + l.recordsSynced, 0);

    // Success rate
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 0;

    // Get conflict stats
    const conflicts = await this.syncConflictRepo.find({
      where: {
        resolvedAt: MoreThan(since),
      },
    });

    const conflictsByEntity = this.groupBy(conflicts, 'entity');
    const conflictsByStrategy = this.groupBy(conflicts, 'resolutionStrategy');

    // Find users with repeated failures
    const userFailures = this.getUserFailures(logs);
    const alertUsers = userFailures.filter((uf) => uf.consecutiveFailures >= 3);

    return {
      period: `${hours}h`,
      timestamp: new Date().toISOString(),
      overview: {
        totalSyncs,
        successfulSyncs,
        failedSyncs,
        timeoutSyncs,
        successRate: Math.round(successRate * 100) / 100,
        totalRecords,
      },
      by_type: {
        pull: pullSyncs,
        push: pushSyncs,
      },
      performance: {
        avgDurationMs: Math.round(avgDuration),
        p50DurationMs: p50,
        p95DurationMs: p95,
        p99DurationMs: p99,
      },
      conflicts: {
        total: conflicts.length,
        byEntity: conflictsByEntity,
        byStrategy: conflictsByStrategy,
      },
      alerts: {
        usersWithRepeatedFailures: alertUsers.length,
        details: alertUsers,
      },
    };
  }

  /**
   * Get recent sync logs
   * GET /api/admin/sync/logs?limit=100&status=error
   */
  @Get('logs')
  async getLogs(
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    const take = Math.min(parseInt(limit || '100', 10), 1000);

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const logs = await this.syncLogRepo.find({
      where,
      order: {
        startedAt: 'DESC',
      },
      take,
    });

    return {
      count: logs.length,
      logs,
    };
  }

  /**
   * Get recent conflicts
   * GET /api/admin/sync/conflicts?limit=100
   */
  @Get('conflicts')
  async getConflicts(@Query('limit') limit?: string, @Query('userId') userId?: string) {
    const take = Math.min(parseInt(limit || '100', 10), 1000);

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }

    const conflicts = await this.syncConflictRepo.find({
      where,
      order: {
        resolvedAt: 'DESC',
      },
      take,
    });

    return {
      count: conflicts.length,
      conflicts,
    };
  }

  /**
   * Parse period string (e.g., "24h", "7d", "30d")
   */
  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([hd])$/);
    if (!match) {
      return 24; // Default 24 hours
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit === 'h') {
      return value;
    } else if (unit === 'd') {
      return value * 24;
    }

    return 24;
  }

  /**
   * Group array by key
   */
  private groupBy(array: any[], key: string): Record<string, number> {
    const result: Record<string, number> = {};

    for (const item of array) {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
    }

    return result;
  }

  /**
   * Analyze user failures to find repeated failures
   */
  private getUserFailures(logs: SyncLog[]): Array<{
    userId: string;
    consecutiveFailures: number;
    lastFailure: Date;
  }> {
    // Group by user
    const userLogs: Record<string, SyncLog[]> = {};

    for (const log of logs) {
      if (!userLogs[log.userId]) {
        userLogs[log.userId] = [];
      }
      userLogs[log.userId].push(log);
    }

    // Find consecutive failures
    const result: Array<{
      userId: string;
      consecutiveFailures: number;
      lastFailure: Date;
    }> = [];

    for (const [userId, logs] of Object.entries(userLogs)) {
      // Sort by date (newest first)
      logs.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

      // Count consecutive failures from most recent
      let consecutiveFailures = 0;
      let lastFailure: Date | null = null;

      for (const log of logs) {
        if (log.status === 'error') {
          consecutiveFailures++;
          if (!lastFailure) {
            lastFailure = log.startedAt;
          }
        } else {
          break; // Stop at first success
        }
      }

      if (consecutiveFailures > 0 && lastFailure) {
        result.push({
          userId,
          consecutiveFailures,
          lastFailure,
        });
      }
    }

    // Sort by failure count (highest first)
    result.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);

    return result;
  }
}
