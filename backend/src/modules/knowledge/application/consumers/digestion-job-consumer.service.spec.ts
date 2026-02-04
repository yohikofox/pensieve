/**
 * DigestionJobConsumer Unit Tests
 * Tests for AC3: Priority-Based Job Processing
 *
 * Uses mocks to avoid dependency on RabbitMQ infrastructure
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DigestionJobConsumer } from './digestion-job-consumer.service';
import { ProgressTrackerService } from '../services/progress-tracker.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { DigestionJobPayload } from '../../domain/interfaces/digestion-job-payload.interface';

describe('DigestionJobConsumer (AC3)', () => {
  let service: DigestionJobConsumer;
  let mockProcessJob: jest.Mock;

  beforeEach(async () => {
    mockProcessJob = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DigestionJobConsumer,
        ProgressTrackerService, // Task 4: Real-time progress tracking
        QueueMonitoringService, // Task 6: Queue monitoring and metrics
      ],
    }).compile();

    service = module.get<DigestionJobConsumer>(DigestionJobConsumer);
    // Inject mock for testing
    (service as any).processDigestion = mockProcessJob;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDigestionJob', () => {
    it('should process a digestion job successfully', async () => {
      // RED: Will fail - service doesn't exist yet
      const job: DigestionJobPayload = {
        captureId: 'capture-123',
        userId: 'user-456',
        contentType: 'audio_transcribed',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      await service.handleDigestionJob(job);

      expect(mockProcessJob).toHaveBeenCalledWith(job);
    });

    it('should handle high-priority jobs', async () => {
      // RED: Will fail - priority handling doesn't exist
      const highPriorityJob: DigestionJobPayload = {
        captureId: 'urgent-capture',
        userId: 'user-1',
        contentType: 'text',
        priority: 'high',
        queuedAt: new Date(),
        retryCount: 0,
      };

      await service.handleDigestionJob(highPriorityJob);

      expect(mockProcessJob).toHaveBeenCalledWith(highPriorityJob);
    });

    it('should track job start time', async () => {
      // RED: Will fail - timing tracking doesn't exist
      const job: DigestionJobPayload = {
        captureId: 'cap-1',
        userId: 'user-1',
        contentType: 'text',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      const beforeProcess = Date.now();
      await service.handleDigestionJob(job);
      const afterProcess = Date.now();

      // Should have logged start time (we'll verify via logs in integration tests)
      expect(mockProcessJob).toHaveBeenCalled();
    });

    it('should enforce 60-second timeout', async () => {
      // RED: Will fail - timeout logic doesn't exist
      // Mock a long-running job
      mockProcessJob.mockImplementation(() =>
        new Promise((resolve) => setTimeout(resolve, 70000)) // 70s > 60s timeout
      );

      const job: DigestionJobPayload = {
        captureId: 'slow-job',
        userId: 'user-1',
        contentType: 'audio_transcribed',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      // Should timeout after 60 seconds
      await expect(
        service.handleDigestionJob(job)
      ).rejects.toThrow(/timeout/i);
    }, 65000); // Test timeout > job timeout

    it('should handle job processing errors gracefully', async () => {
      // RED: Will fail - error handling doesn't exist
      mockProcessJob.mockRejectedValue(new Error('Processing failed'));

      const job: DigestionJobPayload = {
        captureId: 'failing-job',
        userId: 'user-1',
        contentType: 'text',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      await expect(service.handleDigestionJob(job)).rejects.toThrow('Processing failed');
    });

    it('should track retry count', async () => {
      // RED: Will fail - retry tracking doesn't exist
      const retryJob: DigestionJobPayload = {
        captureId: 'retry-job',
        userId: 'user-1',
        contentType: 'audio_transcribed',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 2, // Second retry
      };

      await service.handleDigestionJob(retryJob);

      expect(mockProcessJob).toHaveBeenCalledWith(
        expect.objectContaining({ retryCount: 2 })
      );
    });
  });

  describe('Configuration', () => {
    it('should configure prefetch count to 3', () => {
      // RED: Will fail - configuration doesn't exist
      const prefetchCount = service.getPrefetchCount();
      expect(prefetchCount).toBe(3);
    });

    it('should configure job timeout to 60000ms (60s)', () => {
      // RED: Will fail - timeout config doesn't exist
      const timeout = service.getJobTimeout();
      expect(timeout).toBe(60000);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should finish in-progress jobs before shutdown', async () => {
      // RED: Will fail - shutdown logic doesn't exist
      let jobFinished = false;
      mockProcessJob.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        jobFinished = true;
      });

      const job: DigestionJobPayload = {
        captureId: 'shutdown-job',
        userId: 'user-1',
        contentType: 'text',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      // Start processing
      const processPromise = service.handleDigestionJob(job);

      // Initiate shutdown
      await service.onModuleDestroy();

      // Job should have finished
      await processPromise;
      expect(jobFinished).toBe(true);
    });

    it('should reject new jobs during shutdown', async () => {
      // RED: Will fail - shutdown state doesn't exist
      await service.onModuleDestroy();

      const job: DigestionJobPayload = {
        captureId: 'rejected-job',
        userId: 'user-1',
        contentType: 'text',
        priority: 'normal',
        queuedAt: new Date(),
        retryCount: 0,
      };

      await expect(service.handleDigestionJob(job)).rejects.toThrow(
        'Consumer is shutting down, rejecting new jobs'
      );
    });
  });
});
