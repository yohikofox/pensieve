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
import { TodosExtracted } from '../../../action/domain/events/TodosExtracted.event';
import { ProgressTrackerService } from '../services/progress-tracker.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { EventBusService } from '../services/event-bus.service';
import { ContentExtractorService } from '../services/content-extractor.service';
import { ContentChunkerService } from '../services/content-chunker.service';
import { ThoughtRepository } from '../repositories/thought.repository';
import { TodoRepository, CreateTodoDto } from '../../../action/application/repositories/todo.repository';
import { DeadlineParserService } from '../../../action/application/services/deadline-parser.service';
import { ProgressNotificationService } from '../../../notification/application/services/ProgressNotificationService';
import { DataSource } from 'typeorm';
import { Thought } from '../../domain/entities/thought.entity';
import { Idea } from '../../domain/entities/idea.entity';
import { Todo } from '../../../action/domain/entities/todo.entity';

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
    private readonly contentChunker: ContentChunkerService,
    private readonly thoughtRepository: ThoughtRepository,
    private readonly todoRepository: TodoRepository, // Story 4.3
    private readonly deadlineParser: DeadlineParserService, // Story 4.3
    private readonly progressNotificationService: ProgressNotificationService, // Story 4.4 Task 12
    private readonly dataSource: DataSource, // Story 4.3: For atomic transaction
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

        // Story 4.4 Task 12: Mark progress tracking as failed with notifications
        await this.progressNotificationService.failTrackingWithNotifications(
          job.captureId,
          job.userId,
          errorMessage,
        );

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
   * Story 4.4 Task 12: Integration with notifications
   *
   * @param job - Digestion job payload
   */
  private async processDigestion(job: DigestionJobPayload): Promise<void> {
    const startTime = Date.now();

    // Story 4.4 Task 12: Start tracking with notifications
    // Queue position estimation: queuePosition * 20s avg per job
    const queuePosition = await this.queueMonitoring.getQueueDepth();
    await this.progressNotificationService.startTrackingWithNotifications(
      job.captureId,
      job.userId,
      queuePosition,
    );
    await this.progressNotificationService.updateProgressWithNotifications(
      job.captureId,
      job.userId,
      10,
    );

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
      await this.progressNotificationService.updateProgressWithNotifications(
        job.captureId,
        job.userId,
        20,
      );
      const { content, contentType } =
        await this.contentExtractor.extractContent(job.captureId);

      // Subtask 5.1 & 7: Process content (with chunking if needed - Task 7)
      await this.progressNotificationService.updateProgressWithNotifications(
        job.captureId,
        job.userId,
        40,
      );
      const digestionResult = await this.contentChunker.processContent(
        content,
        contentType,
      );

      // Subtask 5.2: Parse GPT response (already done by ContentChunkerService)
      await this.progressNotificationService.updateProgressWithNotifications(
        job.captureId,
        job.userId,
        70,
      );
      const { summary, ideas, todos = [], confidence, wasChunked, chunkCount } = digestionResult;

      if (wasChunked) {
        this.logger.log(`📊 Content was chunked into ${chunkCount} parts for processing`);
      }

      // Story 4.3: Log todos extraction
      if (todos.length > 0) {
        this.logger.log(`📝 Extracted ${todos.length} todos from capture`);
      }

      // Subtask 5.3 + Story 4.3 AC2: Create Thought + Ideas + Todos in SINGLE ATOMIC TRANSACTION
      const processingTimeMs = Date.now() - startTime;
      const confidenceScore = this.mapConfidenceToScore(confidence);

      const { thought, createdTodos } = await this.createThoughtWithIdeasAndTodos(
        job.captureId,
        job.userId,
        summary,
        ideas,
        todos,
        processingTimeMs,
        confidenceScore,
      );

      await this.progressNotificationService.updateProgressWithNotifications(
        job.captureId,
        job.userId,
        90,
      );

      // Subtask 5.4: Publish DigestionCompleted domain event
      this.eventBus.publish('digestion.completed', {
        thoughtId: thought.id,
        captureId: job.captureId,
        userId: job.userId,
        summary,
        ideasCount: ideas.length,
        todosCount: createdTodos.length, // Story 4.3
        processingTimeMs,
        completedAt: new Date(),
      });

      // Story 4.3 Task 6: Publish TodosExtracted event (AC8)
      if (createdTodos.length > 0) {
        const todosExtractedEvent = new TodosExtracted(
          job.captureId,
          thought.id,
          job.userId,
          createdTodos.map((t) => t.id),
          createdTodos.length,
          new Date(),
        );
        this.eventBus.publish('todos.extracted', todosExtractedEvent.toJSON());
      }

      // Story 4.4 Task 12: Complete tracking with notifications
      await this.progressNotificationService.completeTrackingWithNotifications(
        job.captureId,
        job.userId,
      );
      await this.progressNotificationService.updateProgressWithNotifications(
        job.captureId,
        job.userId,
        100,
      );

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
   * Create Thought with Ideas and Todos in SINGLE ATOMIC TRANSACTION
   * Story 4.3 AC2: Implements atomic Thought + Ideas + Todos creation
   * Subtask 2.5: Transaction handling for atomic creation
   *
   * CRITICAL: If ANY creation fails → ROLLBACK entire transaction
   * No partial data (NFR6: zero data loss tolerance)
   *
   * @param captureId - Capture that was digested
   * @param userId - User who owns the capture
   * @param summary - AI-generated summary
   * @param ideas - Array of key ideas (1-10)
   * @param todos - Extracted todos from GPT (0-10)
   * @param processingTimeMs - Time taken for digestion
   * @param confidenceScore - Optional confidence score
   * @returns Object with created Thought and Todos
   */
  private async createThoughtWithIdeasAndTodos(
    captureId: string,
    userId: string,
    summary: string,
    ideas: string[],
    todos: Array<{ description: string; deadline: string | null; priority: 'low' | 'medium' | 'high' }>,
    processingTimeMs: number,
    confidenceScore?: number,
  ): Promise<{ thought: Thought; createdTodos: Todo[] }> {
    this.logger.log(
      `💾 Creating Thought with ${ideas.length} ideas and ${todos.length} todos for capture ${captureId} (ATOMIC TRANSACTION)`,
    );

    // AC2: Use SINGLE transaction to ensure atomic creation
    return await this.dataSource.transaction(async (manager) => {
      // 1. Create Thought entity
      const thought = manager.create(Thought, {
        captureId,
        userId,
        summary,
        confidenceScore,
        processingTimeMs,
      });

      // 2. Save Thought first to get ID
      const savedThought = await manager.save(Thought, thought);

      // 3. Create Idea entities with orderIndex
      const ideaEntities = ideas.map((ideaText, index) =>
        manager.create(Idea, {
          thoughtId: savedThought.id,
          userId,
          text: ideaText,
          orderIndex: index,
        }),
      );

      // 4. Save all Ideas
      const savedIdeas = await manager.save(Idea, ideaEntities);

      // 5. Story 4.3: Create Todos (AC2, AC5, AC6)
      let createdTodos: Todo[] = [];

      if (todos && todos.length > 0) {
        // Parse deadlines and prepare Todo DTOs
        const todoDtos: CreateTodoDto[] = [];

        for (const todo of todos) {
          // AC3: Parse deadline text into Date
          // TODO: Get user timezone from JWT context (currently defaults to UTC)
          // Future enhancement: Extract timezone from req.user or user profile
          const userTimezone = 'UTC'; // FIXME: Story 4.4 or later - add user timezone support
          const { date: deadlineDate, confidence: deadlineConfidence } =
            this.deadlineParser.parse(todo.deadline, userTimezone);

          todoDtos.push({
            thoughtId: savedThought.id,
            captureId,
            userId,
            description: todo.description,
            deadline: deadlineDate,
            deadlineConfidence,
            priority: todo.priority,
            priorityConfidence: 0.8, // From GPT inference (Task 4)
            status: 'todo',
          });
        }

        // AC5: Create multiple todos using transaction-aware repository method
        createdTodos = await this.todoRepository.createManyInTransaction(
          manager,
          todoDtos,
        );
      }

      // Attach Ideas to Thought for return value
      savedThought.ideas = savedIdeas;

      this.logger.log(
        `✅ ATOMIC TRANSACTION complete: Thought ${savedThought.id} (${ideas.length} ideas, ${createdTodos.length} todos, ${processingTimeMs}ms)`,
      );

      return { thought: savedThought, createdTodos };
    });
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
