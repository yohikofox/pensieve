/**
 * SyncAdminController Tests
 * Story 6.1 - Task 6.6: Test monitoring with success and failure scenarios
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ExecutionContext } from '@nestjs/common';
import { SyncAdminController } from '../application/controllers/sync-admin.controller';
import { SyncLog } from '../domain/entities/sync-log.entity';
import { SyncConflict } from '../domain/entities/sync-conflict.entity';
import { SupabaseAuthGuard } from '../../shared/infrastructure/guards/supabase-auth.guard';

describe('SyncAdminController', () => {
  let controller: SyncAdminController;
  let syncLogRepo: jest.Mocked<Repository<SyncLog>>;
  let syncConflictRepo: jest.Mocked<Repository<SyncConflict>>;

  const mockSyncLogRepo = {
    find: jest.fn(),
  };

  const mockSyncConflictRepo = {
    find: jest.fn(),
  };

  // Mock SupabaseAuthGuard to always allow access in tests
  const mockAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncAdminController],
      providers: [
        {
          provide: getRepositoryToken(SyncLog),
          useValue: mockSyncLogRepo,
        },
        {
          provide: getRepositoryToken(SyncConflict),
          useValue: mockSyncConflictRepo,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<SyncAdminController>(SyncAdminController);
    syncLogRepo = module.get(getRepositoryToken(SyncLog));
    syncConflictRepo = module.get(getRepositoryToken(SyncConflict));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return sync stats with success metrics', async () => {
      const now = new Date();
      const mockLogs: Partial<SyncLog>[] = [
        {
          id: '1',
          userId: 'user-1',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 150,
          recordsSynced: 10,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '2',
          userId: 'user-2',
          syncType: 'push',
          startedAt: now,
          completedAt: now,
          durationMs: 200,
          recordsSynced: 5,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '3',
          userId: 'user-3',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 8,
          status: 'success',
          errorMessage: null,
        },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);
      syncConflictRepo.find.mockResolvedValue([]);

      const result = await controller.getStats('24h');

      expect(result.overview.totalSyncs).toBe(3);
      expect(result.overview.successfulSyncs).toBe(3);
      expect(result.overview.failedSyncs).toBe(0);
      expect(result.overview.successRate).toBe(100);
      expect(result.overview.totalRecords).toBe(23); // 10 + 5 + 8

      expect(result.performance.avgDurationMs).toBe(150); // (150+200+100)/3 = 150
      expect(result.performance.p95DurationMs).toBeGreaterThan(0);

      expect(result.alerts.usersWithRepeatedFailures).toBe(0);
    });

    it('should detect users with repeated failures (>= 3)', async () => {
      const now = new Date();
      const mockLogs: Partial<SyncLog>[] = [
        // User 1: 3 consecutive failures (ALERT)
        {
          id: '1',
          userId: 'user-1',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 1000),
          completedAt: null,
          durationMs: null,
          recordsSynced: 0,
          status: 'error',
          errorMessage: 'Network timeout',
        },
        {
          id: '2',
          userId: 'user-1',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 2000),
          completedAt: null,
          durationMs: null,
          recordsSynced: 0,
          status: 'error',
          errorMessage: 'Network timeout',
        },
        {
          id: '3',
          userId: 'user-1',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 3000),
          completedAt: null,
          durationMs: null,
          recordsSynced: 0,
          status: 'error',
          errorMessage: 'Network timeout',
        },
        // User 2: 2 failures, then success (NO ALERT)
        {
          id: '4',
          userId: 'user-2',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 1000),
          completedAt: null,
          durationMs: null,
          recordsSynced: 0,
          status: 'error',
          errorMessage: 'Auth error',
        },
        {
          id: '5',
          userId: 'user-2',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 2000),
          completedAt: null,
          durationMs: null,
          recordsSynced: 0,
          status: 'error',
          errorMessage: 'Auth error',
        },
        {
          id: '6',
          userId: 'user-2',
          syncType: 'pull',
          startedAt: new Date(now.getTime() - 3000),
          completedAt: now,
          durationMs: 150,
          recordsSynced: 5,
          status: 'success',
          errorMessage: null,
        },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);
      syncConflictRepo.find.mockResolvedValue([]);

      const result = await controller.getStats('24h');

      expect(result.overview.failedSyncs).toBe(5);
      expect(result.alerts.usersWithRepeatedFailures).toBe(1);
      expect(result.alerts.details).toHaveLength(1);
      expect(result.alerts.details[0].userId).toBe('user-1');
      expect(result.alerts.details[0].consecutiveFailures).toBe(3);
    });

    it('should calculate percentiles correctly', async () => {
      const now = new Date();
      const mockLogs: Partial<SyncLog>[] = [
        {
          id: '1',
          userId: 'u1',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '2',
          userId: 'u2',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 200,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '3',
          userId: 'u3',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 300,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '4',
          userId: 'u4',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 400,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '5',
          userId: 'u5',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 500,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '6',
          userId: 'u6',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 600,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '7',
          userId: 'u7',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 700,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '8',
          userId: 'u8',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 800,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '9',
          userId: 'u9',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 900,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '10',
          userId: 'u10',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 1000,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);
      syncConflictRepo.find.mockResolvedValue([]);

      const result = await controller.getStats('24h');

      expect(result.performance.avgDurationMs).toBe(550); // (100+...+1000)/10
      expect(result.performance.p50DurationMs).toBe(600); // P50 (index-based approximation)
      expect(result.performance.p95DurationMs).toBeGreaterThanOrEqual(900);
      expect(result.performance.p99DurationMs).toBeGreaterThanOrEqual(900);
    });

    it('should handle conflicts in stats', async () => {
      const now = new Date();
      const mockLogs: Partial<SyncLog>[] = [
        {
          id: '1',
          userId: 'user-1',
          syncType: 'push',
          startedAt: now,
          completedAt: now,
          durationMs: 200,
          recordsSynced: 5,
          status: 'success',
          errorMessage: null,
        },
      ];

      const mockConflicts: Partial<SyncConflict>[] = [
        {
          id: '1',
          userId: 'user-1',
          entity: 'todo',
          recordId: 'todo-1',
          conflictType: 'last_modified_conflict',
          resolutionStrategy: 'per_column_client_wins',
          resolvedAt: now,
        },
        {
          id: '2',
          userId: 'user-1',
          entity: 'todo',
          recordId: 'todo-2',
          conflictType: 'last_modified_conflict',
          resolutionStrategy: 'per_column_client_wins',
          resolvedAt: now,
        },
        {
          id: '3',
          userId: 'user-1',
          entity: 'thought',
          recordId: 'thought-1',
          conflictType: 'last_modified_conflict',
          resolutionStrategy: 'client_wins',
          resolvedAt: now,
        },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);
      syncConflictRepo.find.mockResolvedValue(mockConflicts as SyncConflict[]);

      const result = await controller.getStats('24h');

      expect(result.conflicts.total).toBe(3);
      expect(result.conflicts.byEntity.todo).toBe(2);
      expect(result.conflicts.byEntity.thought).toBe(1);
      expect(result.conflicts.byStrategy.per_column_client_wins).toBe(2);
      expect(result.conflicts.byStrategy.client_wins).toBe(1);
    });

    it('should group syncs by type (pull/push)', async () => {
      const now = new Date();
      const mockLogs: Partial<SyncLog>[] = [
        {
          id: '1',
          userId: 'u1',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '2',
          userId: 'u2',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '3',
          userId: 'u3',
          syncType: 'pull',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '4',
          userId: 'u4',
          syncType: 'push',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
        {
          id: '5',
          userId: 'u5',
          syncType: 'push',
          startedAt: now,
          completedAt: now,
          durationMs: 100,
          recordsSynced: 1,
          status: 'success',
          errorMessage: null,
        },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);
      syncConflictRepo.find.mockResolvedValue([]);

      const result = await controller.getStats('24h');

      expect(result.by_type.pull).toBe(3);
      expect(result.by_type.push).toBe(2);
    });
  });

  describe('getLogs', () => {
    it('should return recent sync logs with limit', async () => {
      const mockLogs: Partial<SyncLog>[] = [
        { id: '1', userId: 'user-1', syncType: 'pull', status: 'success' },
        { id: '2', userId: 'user-2', syncType: 'push', status: 'success' },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);

      const result = await controller.getLogs('50');

      expect(result.count).toBe(2);
      expect(result.logs).toHaveLength(2);
      expect(syncLogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          order: { startedAt: 'DESC' },
        }),
      );
    });

    it('should filter logs by status', async () => {
      const mockLogs: Partial<SyncLog>[] = [
        { id: '1', userId: 'user-1', syncType: 'pull', status: 'error' },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);

      const result = await controller.getLogs('100', 'error');

      expect(result.count).toBe(1);
      expect(syncLogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'error' },
        }),
      );
    });

    it('should filter logs by userId', async () => {
      const mockLogs: Partial<SyncLog>[] = [
        { id: '1', userId: 'user-123', syncType: 'pull', status: 'success' },
      ];

      syncLogRepo.find.mockResolvedValue(mockLogs as SyncLog[]);

      const result = await controller.getLogs('100', undefined, 'user-123');

      expect(result.count).toBe(1);
      expect(syncLogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        }),
      );
    });

    it('should enforce max limit of 1000', async () => {
      syncLogRepo.find.mockResolvedValue([]);

      await controller.getLogs('5000'); // Request 5000

      expect(syncLogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000, // Capped at 1000
        }),
      );
    });
  });

  describe('getConflicts', () => {
    it('should return recent conflicts', async () => {
      const mockConflicts: Partial<SyncConflict>[] = [
        {
          id: '1',
          userId: 'user-1',
          entity: 'todo',
          recordId: 'todo-1',
          conflictType: 'last_modified_conflict',
          resolutionStrategy: 'client_wins',
        },
      ];

      syncConflictRepo.find.mockResolvedValue(mockConflicts as SyncConflict[]);

      const result = await controller.getConflicts('50');

      expect(result.count).toBe(1);
      expect(result.conflicts).toHaveLength(1);
      expect(syncConflictRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          order: { resolvedAt: 'DESC' },
        }),
      );
    });

    it('should filter conflicts by userId', async () => {
      const mockConflicts: Partial<SyncConflict>[] = [];

      syncConflictRepo.find.mockResolvedValue(mockConflicts as SyncConflict[]);

      await controller.getConflicts('100', 'user-456');

      expect(syncConflictRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-456' },
        }),
      );
    });
  });
});
