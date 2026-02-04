/**
 * Digestion Job Consumer Service
 * Processes digestion jobs from RabbitMQ queue
 *
 * Covers:
 * - Subtask 3.1: Create DigestionJobConsumer service
 * - Subtask 3.2: Configure prefetch count (max 3 concurrent jobs)
 * - Subtask 3.3: Implement priority-based job ordering
 * - Subtask 3.4: Set job timeout to 60 seconds
 * - Subtask 3.5: Graceful shutdown handling
 *
 * AC3: Priority-Based Job Processing
 */

import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { MessagePattern, Payload, Ctx } from '@nestjs/microservices';
import type { RmqContext } from '@nestjs/microservices';
import type { DigestionJobPayload } from '../../domain/interfaces/digestion-job-payload.interface';
import type { ICaptureRepository } from '../../domain/interfaces/capture-repository.interface';
import { DigestionJobStarted } from '../../domain/events/DigestionJobStarted.event';
import { DigestionJobFailed } from '../../domain/events/DigestionJobFailed.event';
import { ProgressTrackerService } from '../services/progress-tracker.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { EventBusService } from '../services/event-bus.service';
import { ContentExtractorService } from '../services/content-extractor.service';
import { OpenAIService } from '../services/openai.service';
import { ThoughtRepository } from '../repositories/thought.repository';

@Injectable()
export class DigestionJobConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(DigestionJobConsumer.name);
  private readonly JOB_TIMEOUT_MS = 60000; // 60 seconds (Subtask 3.4)
  private readonly PREFETCH_COUNT = 3; // Max 3 concurrent jobs (Subtask 3.2)
  private isShuttingDown = false;
  private activeJobs = new Set<Promise<void>>();

  constructor(
    private readonly progressTracker: ProgressTrackerService,
    private readonly queueMonitoring: QueueMonitoringService,
    @Inject('CAPTURE_REPOSITORY')
    private readonly captureRepository: ICaptureRepository,
    private readonly eventBus: EventBusService,
    private readonly contentExtractor: ContentExtractorService,
    private readonly openaiService: OpenAIService,
    private readonly thoughtRepository: ThoughtRepository,
  ) {}

  /**
   * Handle incoming digestion jobs from RabbitMQ
   *
   * @MessagePattern listens to 'digestion.job.queued' events
   * NestJS automatically handles:
   * - Message acknowledgment (noAck: false in config)
   * - Priority ordering (x-max-priority in queue config)
   * - Prefetch count (configured in RabbitMQModule)
   */
  @MessagePattern('digestion.job.queued')
  async handleDigestionJob(
    @Payload() job: DigestionJobPayload,
    @Ctx() context?: RmqContext,
  ): Promise<void> {
    // Subtask 3.5: Reject new jobs during shutdown
    if (this.isShuttingDown) {
      throw new Error('Consumer is shutting down, rejecting new jobs');
    }

    const startTime = Date.now();
    this.logger.log(
      `📥 Received job: ${job.captureId} (priority: ${job.priority}, retry: ${job.retryCount})`,
    );

    // Create a job promise that we can track for graceful shutdown
    const jobPromise = this.processWithTimeout(job);
    this.activeJobs.add(jobPromise);

    try {
      await jobPromise;

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Job completed: ${job.captureId} (took ${duration}ms)`,
      );

      // Subtask 6.4: Record metrics for successful job
      this.queueMonitoring.recordJobProcessed();
      this.queueMonitoring.recordJobLatency(duration);

      // Acknowledge message success (if context provided - for e2e tests)
      if (context) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        channel.ack(originalMsg);
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Subtask 5.4: Log error details for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? error.stack || '' : '';

      this.logger.error(
        `❌ Job failed: ${job.captureId} (after ${duration}ms, retry: ${job.retryCount})`,
        {
          errorMessage,
          stackTrace,
          jobPayload: job,
        },
      );

      // Subtask 5.3 & 5.5: Check if max retries reached
      const MAX_RETRIES = 3;
      if (job.retryCount >= MAX_RETRIES - 1) {
        // Max retries reached, mark as permanently failed
        this.logger.error(
          `🔴 Job permanently failed after ${MAX_RETRIES} attempts: ${job.captureId}`,
        );

        // Mark progress tracking as failed
        this.progressTracker.failTracking(job.captureId, errorMessage);

        // Subtask 6.4: Record metrics for failed job (after max retries)
        this.queueMonitoring.recordJobFailed();
        this.queueMonitoring.recordJobLatency(duration);

        // Subtask 5.3: Update Capture status to "digestion_failed" in database
        await this.captureRepository.updateStatus(
          job.captureId,
          'digestion_failed',
          {
            processing_completed_at: new Date(),
            error_message: errorMessage,
            error_stack: stackTrace,
          },
        );

        // Subtask 5.5: Emit DigestionJobFailed event for alerting
        const failedEvent = new DigestionJobFailed(
          job.captureId,
          job.userId,
          errorMessage,
          stackTrace,
          job.retryCount + 1, // Total attempts
          new Date(),
          job,
        );
        this.eventBus.publish('digestion.job.failed', failedEvent.toJSON());
        this.logger.error(`Job permanently failed: ${job.captureId}`, failedEvent.toJSON());

        // TODO: Send alert to monitoring system
      } else {
        // Will be retried by RabbitMQ with exponential backoff
        this.logger.warn(
          `⚠️  Job will be retried (attempt ${job.retryCount + 1}/${MAX_RETRIES}): ${job.captureId}`,
        );
      }

      // Don't acknowledge - let RabbitMQ retry or move to DLQ
      // Retry delays configured in RabbitMQ: 5s → 15s → 45s
      throw error;
    } finally {
      this.activeJobs.delete(jobPromise);
    }
  }

  /**
   * Process job with timeout enforcement (Subtask 3.4)
   *
   * @param job - Digestion job payload
   * @returns Promise that resolves when job completes or rejects on timeout
   */
  private async processWithTimeout(job: DigestionJobPayload): Promise<void> {
    return Promise.race([
      this.processDigestion(job),
      this.createTimeoutPromise(job.captureId),
    ]);
  }

  /**
   * Create a timeout promise that rejects after JOB_TIMEOUT_MS
   *
   * @param captureId - Capture ID for logging
   * @returns Promise that rejects on timeout
   */
  private createTimeoutPromise(captureId: string): Promise<void> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Job timeout: ${captureId} exceeded ${this.JOB_TIMEOUT_MS}ms limit`,
        ));
      }, this.JOB_TIMEOUT_MS);
    });
  }

  /**
   * Process the actual digestion logic with GPT-4o-mini
   * Story 4.2 Task 5: Digestion Worker Integration (AC1-AC4)
   *
   * @param job - Digestion job payload
   */
  private async processDigestion(job: DigestionJobPayload): Promise<void> {
    const startTime = Date.now();

    // Subtask 5.1: Start tracking with timestamp
    this.progressTracker.startTracking(job.captureId, job.userId);
    this.progressTracker.updateProgress(job.captureId, 10);

    // AC4: Update Capture status to "digesting" when job starts
    await this.captureRepository.updateStatus(job.captureId, 'digesting', {
      processing_started_at: new Date(),
    });

    // Emit DigestionJobStarted event (AC4 - Task 4)
    const startedEvent = new DigestionJobStarted(
      job.captureId,
      job.userId,
      new Date(),
    );
    this.eventBus.publish('digestion.job.started', {
      captureId: startedEvent.captureId,
      userId: startedEvent.userId,
      startedAt: startedEvent.startedAt,
    });

    this.logger.log(`🤖 Processing digestion for ${job.captureId}...`);

    try {
      // Subtask 5.1: Extract content from Capture (Task 3)
      this.progressTracker.updateProgress(job.captureId, 20);
      const { content, contentType } =
        await this.contentExtractor.extractContent(job.captureId);

      // Subtask 5.1: Call GPT-4o-mini for digestion (Task 1)
      this.progressTracker.updateProgress(job.captureId, 40);
      const digestionResult = await this.openaiService.digestContent(
        content,
        contentType,
      );

      // Subtask 5.2: Parse GPT response (already done by OpenAIService)
      this.progressTracker.updateProgress(job.captureId, 70);
      const { summary, ideas, confidence } = digestionResult;

      // Subtask 5.3: Create Thought and Ideas entities (Task 4)
      const processingTimeMs = Date.now() - startTime;
      const confidenceScore = this.mapConfidenceToScore(confidence);

      const thought = await this.thoughtRepository.createWithIdeas(
        job.captureId,
        job.userId,
        summary,
        ideas,
        processingTimeMs,
        confidenceScore,
      );

      this.progressTracker.updateProgress(job.captureId, 90);

      // Subtask 5.4: Publish DigestionCompleted domain event
      this.eventBus.publish('digestion.completed', {
        thoughtId: thought.id,
        captureId: job.captureId,
        userId: job.userId,
        summary,
        ideasCount: ideas.length,
        processingTimeMs,
        completedAt: new Date(),
      });

      // Subtask 5.5: Update ProgressTracker with completion status
      this.progressTracker.completeTracking(job.captureId);
      this.progressTracker.updateProgress(job.captureId, 100);

      // Subtask 4.6: Update Capture status to "digested" after success
      await this.captureRepository.updateStatus(job.captureId, 'digested', {
        processing_completed_at: new Date(),
      });

      this.logger.log(
        `✨ Digestion complete for ${job.captureId} - Thought: ${thought.id} (${ideas.length} ideas, ${processingTimeMs}ms, confidence: ${confidence})`,
      );
    } catch (error) {
      // Error already logged and will be handled by handleDigestionJob
      throw error;
    }
  }

  /**
   * Map confidence level to numeric score
   * Helper for AC8: Low Confidence Handling
   *
   * @param confidence - Confidence level from GPT
   * @returns Numeric score 0-1
   */
  private mapConfidenceToScore(
    confidence?: 'high' | 'medium' | 'low',
  ): number | undefined {
    if (!confidence) return undefined;

    const mapping = {
      high: 0.9,
      medium: 0.6,
      low: 0.3,
    };

    return mapping[confidence];
  }

  /**
   * Simulate AI processing with progress updates
   * Will be replaced with actual GPT-4o-mini calls in Story 4.2
   *
   * @param captureId - Capture being processed
   */
  private async simulateProcessingWithProgress(captureId: string): Promise<void> {
    const steps = [25, 50, 75, 100];

    for (const percentage of steps) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      this.progressTracker.updateProgress(captureId, percentage);
      this.logger.debug(`Progress: ${captureId} - ${percentage}%`);
    }
  }

  /**
   * Get configured prefetch count (Subtask 3.2)
   * Used for testing and configuration verification
   */
  getPrefetchCount(): number {
    return this.PREFETCH_COUNT;
  }

  /**
   * Get configured job timeout (Subtask 3.4)
   * Used for testing and configuration verification
   */
  getJobTimeout(): number {
    return this.JOB_TIMEOUT_MS;
  }

  /**
   * Graceful shutdown: wait for active jobs to complete (Subtask 3.5)
   * Called by NestJS lifecycle when module is being destroyed
   */
  async onModuleDestroy() {
    this.logger.log('🛑 Shutting down consumer, waiting for active jobs...');
    this.isShuttingDown = true;

    if (this.activeJobs.size > 0) {
      this.logger.log(`⏳ Waiting for ${this.activeJobs.size} active jobs to finish...`);
      await Promise.allSettled(Array.from(this.activeJobs));
      this.logger.log('✅ All active jobs finished');
    }

    this.logger.log('👋 Consumer shutdown complete');
  }
}
