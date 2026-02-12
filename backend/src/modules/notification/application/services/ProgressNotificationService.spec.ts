/**
 * Progress Notification Service Unit Tests
 * Story 4.4: Notifications de Progression IA
 * Task 2, Subtask 2.6: Add unit tests for enhanced ProgressTracker
 */

import 'reflect-metadata';
import { ProgressNotificationService } from './ProgressNotificationService';
import { ProgressTrackerService } from '../../../knowledge/application/services/progress-tracker.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProgressUpdate } from '../../domain/events/ProgressUpdate.event';
import { TimeoutWarning } from '../../domain/events/TimeoutWarning.event';

describe('ProgressNotificationService', () => {
  let service: ProgressNotificationService;
  let mockProgressTracker: jest.Mocked<ProgressTrackerService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(() => {
    mockProgressTracker = {
      startTracking: jest.fn(),
      updateProgress: jest.fn(),
      completeTracking: jest.fn(),
      failTracking: jest.fn(),
      getProgress: jest.fn(),
      getUserActiveJobs: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    service = new ProgressNotificationService(
      mockProgressTracker,
      mockEventEmitter,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startTrackingWithNotifications', () => {
    it('should start tracking and emit queued event (AC1)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const queuePosition = 5;

      await service.startTrackingWithNotifications(
        captureId,
        userId,
        queuePosition,
      );

      expect(mockProgressTracker.startTracking).toHaveBeenCalledWith(
        captureId,
        userId,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          captureId,
          userId,
          status: 'queued',
          elapsed: 0,
          queuePosition: 5,
          estimatedRemaining: expect.any(Number), // ~100s (5 * 20s avg)
        }),
      );
    });

    it('should estimate remaining time based on queue position (Subtask 2.2)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const queuePosition = 3;

      await service.startTrackingWithNotifications(
        captureId,
        userId,
        queuePosition,
      );

      const emittedEvent = (mockEventEmitter.emit as jest.Mock).mock
        .calls[0][1] as ProgressUpdate;
      // 3 jobs * 20s avg = 60s = 60000ms
      expect(emittedEvent.estimatedRemaining).toBe(60000);
    });

    it('should handle no queue position', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';

      await service.startTrackingWithNotifications(captureId, userId);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          queuePosition: undefined,
          estimatedRemaining: undefined,
        }),
      );
    });
  });

  describe('updateProgressWithNotifications', () => {
    it('should update progress and emit processing event (AC2)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const percentage = 50;
      const startedAt = new Date(Date.now() - 5000); // 5s ago

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'digesting',
        percentage,
        startedAt,
        lastUpdatedAt: new Date(),
        durationMs: 5000,
      });

      await service.updateProgressWithNotifications(
        captureId,
        userId,
        percentage,
      );

      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(
        captureId,
        percentage,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          captureId,
          userId,
          status: 'processing',
          elapsed: expect.any(Number),
          queuePosition: undefined, // no queue position when processing
        }),
      );
    });

    it('should emit "Still processing..." after 10s (AC2, Subtask 2.3)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const startedAt = new Date(Date.now() - 12000); // 12s ago

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'digesting',
        percentage: 30,
        startedAt,
        lastUpdatedAt: new Date(),
        durationMs: 12000,
      });

      await service.updateProgressWithNotifications(captureId, userId, 30);

      // Should emit both progress.update and progress.still-processing
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.any(ProgressUpdate),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.still-processing',
        expect.any(ProgressUpdate),
      );
    });

    it('should NOT emit "Still processing..." before 10s', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const startedAt = new Date(Date.now() - 8000); // 8s ago

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'digesting',
        percentage: 40,
        startedAt,
        lastUpdatedAt: new Date(),
        durationMs: 8000,
      });

      await service.updateProgressWithNotifications(captureId, userId, 40);

      // Should only emit progress.update
      expect(mockEventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.any(ProgressUpdate),
      );
    });

    it('should emit timeout warning after 30s (AC9)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const startedAt = new Date(Date.now() - 32000); // 32s ago

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'digesting',
        percentage: 60,
        startedAt,
        lastUpdatedAt: new Date(),
        durationMs: 32000,
      });

      await service.updateProgressWithNotifications(captureId, userId, 60);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.any(TimeoutWarning),
      );
    });

    it('should emit timeout warning only once per job', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const startedAt = new Date(Date.now() - 35000); // 35s ago

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'digesting',
        percentage: 70,
        startedAt,
        lastUpdatedAt: new Date(),
        durationMs: 35000,
      });

      // First call - should emit timeout warning
      await service.updateProgressWithNotifications(captureId, userId, 70);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.any(TimeoutWarning),
      );

      jest.clearAllMocks();

      // Second call - should NOT emit timeout warning again
      await service.updateProgressWithNotifications(captureId, userId, 80);
      expect(mockEventEmitter.emit).not.toHaveBeenCalledWith(
        'progress.timeout-warning',
        expect.anything(),
      );
    });

    it('should handle progress not found', async () => {
      const captureId = 'non-existent';
      const userId = 'user-456';

      mockProgressTracker.getProgress.mockResolvedValue(null);

      await service.updateProgressWithNotifications(captureId, userId, 50);

      // Should not emit any events if progress not found
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('completeTrackingWithNotifications', () => {
    it('should complete tracking and emit completed event (AC3)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'completed',
        percentage: 100,
        startedAt: new Date(Date.now() - 15000),
        lastUpdatedAt: new Date(),
        completedAt: new Date(),
        durationMs: 15000,
      });

      await service.completeTrackingWithNotifications(captureId, userId);

      expect(mockProgressTracker.completeTracking).toHaveBeenCalledWith(
        captureId,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          captureId,
          userId,
          status: 'completed',
          elapsed: 15000,
        }),
      );
    });
  });

  describe('failTrackingWithNotifications', () => {
    it('should fail tracking and emit failed event (AC5)', async () => {
      const captureId = 'capture-123';
      const userId = 'user-456';
      const errorMessage = 'OpenAI API error';

      mockProgressTracker.getProgress.mockResolvedValue({
        captureId,
        userId,
        status: 'failed',
        percentage: 30,
        startedAt: new Date(Date.now() - 10000),
        lastUpdatedAt: new Date(),
        durationMs: 10000,
        error: errorMessage,
      });

      await service.failTrackingWithNotifications(
        captureId,
        userId,
        errorMessage,
      );

      expect(mockProgressTracker.failTracking).toHaveBeenCalledWith(
        captureId,
        errorMessage,
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'progress.update',
        expect.objectContaining({
          captureId,
          userId,
          status: 'failed',
          elapsed: 10000,
        }),
      );
    });
  });

  describe('getUserActiveJobs', () => {
    it('should return all active jobs for user (AC6)', async () => {
      const userId = 'user-456';
      const activeJobs = [
        {
          captureId: 'capture-1',
          userId,
          status: 'digesting' as const,
          percentage: 30,
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
        {
          captureId: 'capture-2',
          userId,
          status: 'digesting' as const,
          percentage: 60,
          startedAt: new Date(),
          lastUpdatedAt: new Date(),
        },
      ];

      mockProgressTracker.getUserActiveJobs.mockResolvedValue(activeJobs);

      const result = await service.getUserActiveJobs(userId);

      expect(result).toEqual(activeJobs);
      expect(mockProgressTracker.getUserActiveJobs).toHaveBeenCalledWith(
        userId,
      );
    });
  });
});
