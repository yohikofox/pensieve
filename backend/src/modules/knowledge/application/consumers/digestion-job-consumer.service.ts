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

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MessagePattern, Payload, Ctx } from '@nestjs/microservices';
import type { RmqContext } from '@nestjs/microservices';
import type { DigestionJobPayload } from '../../domain/interfaces/digestion-job-payload.interface';
import { DigestionJobStarted } from '../../domain/events/DigestionJobStarted.event';

@Injectable()
export class DigestionJobConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(DigestionJobConsumer.name);
  private readonly JOB_TIMEOUT_MS = 60000; // 60 seconds (Subtask 3.4)
  private readonly PREFETCH_COUNT = 3; // Max 3 concurrent jobs (Subtask 3.2)
  private isShuttingDown = false;
  private activeJobs = new Set<Promise<void>>();

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

      // Acknowledge message success (if context provided - for e2e tests)
      if (context) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();
        channel.ack(originalMsg);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `❌ Job failed: ${job.captureId} (after ${duration}ms)`,
        error,
      );

      // Don't acknowledge - let RabbitMQ retry or move to DLQ
      // The retry logic will be handled by RabbitMQ dead-letter exchange (Task 5)
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
   * Process the actual digestion logic
   *
   * NOTE: This is a stub. Actual AI digestion will be implemented in Story 4.2
   * For now, we just simulate processing and emit events
   *
   * @param job - Digestion job payload
   */
  private async processDigestion(job: DigestionJobPayload): Promise<void> {
    // Emit DigestionJobStarted event (AC4 - Task 4)
    const startedEvent = new DigestionJobStarted(
      job.captureId,
      job.userId,
      new Date(),
    );
    this.logger.debug('Domain event: DigestionJobStarted', startedEvent);

    // TODO: Story 4.2 - Call GPT-4o-mini for actual digestion
    // For now, simulate processing
    this.logger.log(`🤖 Processing digestion for ${job.captureId}...`);

    // Simulate AI processing time (remove in Story 4.2)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // TODO: Story 4.2 - Store results (Thoughts, Ideas, Actions)
    // TODO: AC4 - Update Capture status to "digested"
    // TODO: AC4 - Publish progress updates via WebSocket

    this.logger.log(`✨ Digestion complete for ${job.captureId}`);
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
