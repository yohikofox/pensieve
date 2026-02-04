/**
 * ProgressTracker Unit Tests
 * Tests for AC4: Real-Time Progress Updates
 *
 * Uses mocks to avoid dependency on actual infrastructure
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProgressTrackerService } from './progress-tracker.service';

describe('ProgressTrackerService (AC4)', () => {
  let service: ProgressTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgressTrackerService],
    }).compile();

    service = module.get<ProgressTrackerService>(ProgressTrackerService);
  });

  describe('startTracking', () => {
    it('should track job start with timestamp', () => {
      // RED: Will fail - service doesn't exist yet
      const captureId = 'capture-123';
      const userId = 'user-456';

      const beforeStart = Date.now();
      service.startTracking(captureId, userId);
      const afterStart = Date.now();

      const progress = service.getProgress(captureId);
      expect(progress).toBeDefined();
      expect(progress.status).toBe('digesting');
      expect(progress.startedAt.getTime()).toBeGreaterThanOrEqual(beforeStart);
      expect(progress.startedAt.getTime()).toBeLessThanOrEqual(afterStart);
    });

    it('should initialize progress to 0%', () => {
      // RED: Will fail - progress tracking doesn't exist
      const captureId = 'capture-123';
      const userId = 'user-456';

      service.startTracking(captureId, userId);

      const progress = service.getProgress(captureId);
      expect(progress.percentage).toBe(0);
    });

    it('should store userId for the job', () => {
      // RED: Will fail
      const captureId = 'capture-123';
      const userId = 'user-456';

      service.startTracking(captureId, userId);

      const progress = service.getProgress(captureId);
      expect(progress.userId).toBe(userId);
    });
  });

  describe('updateProgress', () => {
    it('should update progress percentage', () => {
      // RED: Will fail - update logic doesn't exist
      const captureId = 'capture-123';
      service.startTracking(captureId, 'user-1');

      service.updateProgress(captureId, 50);

      const progress = service.getProgress(captureId);
      expect(progress.percentage).toBe(50);
    });

    it('should clamp progress between 0 and 100', () => {
      // RED: Will fail - validation doesn't exist
      const captureId = 'capture-123';
      service.startTracking(captureId, 'user-1');

      service.updateProgress(captureId, 150);
      expect(service.getProgress(captureId).percentage).toBe(100);

      service.updateProgress(captureId, -10);
      expect(service.getProgress(captureId).percentage).toBe(0);
    });

    it('should update lastUpdatedAt timestamp', () => {
      // RED: Will fail
      const captureId = 'capture-123';
      service.startTracking(captureId, 'user-1');

      const initialProgress = service.getProgress(captureId);
      const initialTimestamp = initialProgress.lastUpdatedAt.getTime();

      // Wait a bit
      setTimeout(() => {
        service.updateProgress(captureId, 25);
        const updatedProgress = service.getProgress(captureId);
        expect(updatedProgress.lastUpdatedAt.getTime()).toBeGreaterThan(initialTimestamp);
      }, 10);
    });
  });

  describe('completeTracking', () => {
    it('should mark job as completed with 100% progress', () => {
      // RED: Will fail - completion logic doesn't exist
      const captureId = 'capture-123';
      service.startTracking(captureId, 'user-1');

      service.completeTracking(captureId);

      const progress = service.getProgress(captureId);
      expect(progress.status).toBe('completed');
      expect(progress.percentage).toBe(100);
      expect(progress.completedAt).toBeDefined();
    });

    it('should calculate total duration', () => {
      // RED: Will fail - duration calculation doesn't exist
      const captureId = 'capture-123';
      service.startTracking(captureId, 'user-1');

      setTimeout(() => {
        service.completeTracking(captureId);
        const progress = service.getProgress(captureId);
        expect(progress.durationMs).toBeGreaterThan(0);
      }, 100);
    });
  });

  describe('failTracking', () => {
    it('should mark job as failed with error message', () => {
      // RED: Will fail - failure handling doesn't exist
      const captureId = 'capture-123';
      const errorMessage = 'Processing failed due to API timeout';

      service.startTracking(captureId, 'user-1');
      service.failTracking(captureId, errorMessage);

      const progress = service.getProgress(captureId);
      expect(progress.status).toBe('failed');
      expect(progress.error).toBe(errorMessage);
    });
  });

  describe('getProgress', () => {
    it('should return null for unknown captureId', () => {
      // RED: Will fail
      const progress = service.getProgress('unknown-id');
      expect(progress).toBeNull();
    });
  });

  describe('getAllActiveJobs', () => {
    it('should return all jobs currently being processed', () => {
      // RED: Will fail - tracking collection doesn't exist
      service.startTracking('capture-1', 'user-1');
      service.startTracking('capture-2', 'user-1');
      service.startTracking('capture-3', 'user-2');

      const activeJobs = service.getAllActiveJobs();
      expect(activeJobs).toHaveLength(3);
    });

    it('should not include completed jobs', () => {
      // RED: Will fail
      service.startTracking('capture-1', 'user-1');
      service.startTracking('capture-2', 'user-1');

      service.completeTracking('capture-1');

      const activeJobs = service.getAllActiveJobs();
      expect(activeJobs).toHaveLength(1);
      expect(activeJobs[0].captureId).toBe('capture-2');
    });
  });

  describe('cleanup', () => {
    it('should remove completed jobs after retention period', () => {
      // RED: Will fail - cleanup logic doesn't exist
      const captureId = 'capture-old';
      service.startTracking(captureId, 'user-1');
      service.completeTracking(captureId);

      // Simulate retention period expiry
      service.cleanupOldJobs(0); // 0ms retention for testing

      const progress = service.getProgress(captureId);
      expect(progress).toBeNull();
    });
  });
});
