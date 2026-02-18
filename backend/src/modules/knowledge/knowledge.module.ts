/**
 * Knowledge Context Module
 * Bounded Context for AI Digestion, Thoughts, and Ideas
 *
 * Responsibilities:
 * - Async job queue for AI digestion (Story 4.1)
 * - AI digestion processing (Story 4.2)
 * - Action extraction (Story 4.3)
 * - Progress notifications (Story 4.4)
 */

import { Module, forwardRef } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Thought } from './domain/entities/thought.entity';
import { Idea } from './domain/entities/idea.entity';
import { ThoughtStatus } from './domain/entities/thought-status.entity';
import { ActionModule } from '../action/action.module'; // Story 4.3: Import ActionModule for TodoRepository
import { NotificationModule } from '../notification/notification.module'; // Story 4.4: Import NotificationModule for ProgressNotificationService
import { AuthorizationModule } from '../authorization/authorization.module';
import { RabbitMQSetupService } from './infrastructure/rabbitmq/rabbitmq-setup.service';
import { DigestionJobPublisher } from './application/publishers/digestion-job-publisher.service';
import { DigestionJobConsumer } from './application/consumers/digestion-job-consumer.service';
import { ProgressTrackerService } from './application/services/progress-tracker.service';
import { QueueMonitoringService } from './application/services/queue-monitoring.service';
import { EventBusService } from './application/services/event-bus.service';
import { OpenAIService } from './application/services/openai.service';
import { ContentExtractorService } from './application/services/content-extractor.service';
import { ContentChunkerService } from './application/services/content-chunker.service';
import { ThoughtRepository } from './application/repositories/thought.repository';
import { IdeaRepository } from './application/repositories/idea.repository';
import { ThoughtStatusRepository } from './infrastructure/repositories/thought-status.repository';
import { ThoughtDeleteService } from './application/services/thought-delete.service';
import { DigestionRetryController } from './application/controllers/digestion-retry.controller';
import { MetricsController } from './application/controllers/metrics.controller';
import { BatchDigestionController } from './application/controllers/batch-digestion.controller';
import { ThoughtsController } from './application/controllers/thoughts.controller';
import { IdeasController } from './application/controllers/ideas.controller';
import { CaptureRepositoryStub } from './infrastructure/stubs/capture-repository.stub';
import { CaptureContentRepositoryStub } from './infrastructure/stubs/capture-content-repository.stub';
import { InMemoryProgressStore } from './infrastructure/stores/in-memory-progress.store';
import { RedisProgressStore } from './infrastructure/stores/redis-progress.store';
import { getRabbitMQOptions } from './infrastructure/rabbitmq/rabbitmq.config';
import { KnowledgeEventsGateway } from './infrastructure/websocket/knowledge-events.gateway';

@Module({
  imports: [
    // Register TypeORM entities for Knowledge Context (Story 4.2 Task 4 + Story 13.2)
    TypeOrmModule.forFeature([Thought, Idea, ThoughtStatus]),
    // Story 4.3: Import ActionModule for TodoRepository and DeadlineParserService
    ActionModule,
    // Story 4.4: Import NotificationModule for ProgressNotificationService (forward ref to avoid circular dependency)
    forwardRef(() => NotificationModule),
    // Import AuthorizationModule for guards and permissions
    AuthorizationModule,
    // Register RabbitMQ client for job publishing
    ClientsModule.register([
      {
        name: 'DIGESTION_QUEUE',
        ...getRabbitMQOptions(),
      },
    ]),
    // Event emitter for domain events
    EventEmitterModule.forRoot(),
  ],
  controllers: [
    DigestionRetryController, // Manual retry endpoint (AC5)
    MetricsController, // Prometheus metrics endpoint (AC6)
    BatchDigestionController, // Batch submission endpoint (AC7)
    ThoughtsController, // Thoughts CRUD with authorization
    IdeasController, // Ideas CRUD with authorization
  ],
  providers: [
    RabbitMQSetupService, // Initialize queues on startup
    DigestionJobPublisher, // Publish digestion jobs (AC2)
    DigestionJobConsumer, // Consume and process jobs (AC3)
    ProgressTrackerService, // Track job progress (AC4)
    QueueMonitoringService, // Monitor queue health and metrics (AC6)
    EventBusService, // Domain event publishing (AC2, AC4, AC5)
    KnowledgeEventsGateway, // WebSocket real-time notifications (Story 4.2 Task 6)
    // OpenAI Client Provider - Story 4.2 Subtask 1.2
    {
      provide: 'OPENAI_CLIENT',
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
          throw new Error(
            'OPENAI_API_KEY is not configured in environment variables',
          );
        }
        return new OpenAI({ apiKey });
      },
      inject: [ConfigService],
    },
    OpenAIService, // GPT-4o-mini digestion service (Story 4.2 Task 1)
    ContentExtractorService, // Content extraction from captures (Story 4.2 Task 3)
    ContentChunkerService, // Long content chunking with overlap (Story 4.2 Task 7)
    ThoughtRepository, // Thought + Ideas persistence (Story 4.2 Task 4)
    IdeaRepository, // Individual idea operations
    ThoughtStatusRepository, // Referential cache repository (ADR-027)
    ThoughtDeleteService, // Soft-delete atomique Thought + Ideas liées (Story 12.4 — ADR-026 R3)
    // Capture Repository stub - replaces when Capture Context is integrated
    {
      provide: 'CAPTURE_REPOSITORY',
      useClass: CaptureRepositoryStub,
    },
    // Capture Content Repository stub (Story 4.2 Task 3)
    {
      provide: 'CAPTURE_CONTENT_REPOSITORY',
      useClass: CaptureContentRepositoryStub,
    },
    // Progress Store - choose implementation based on environment
    {
      provide: 'PROGRESS_STORE',
      useFactory: (configService: ConfigService) => {
        const storeType = configService.get<string>(
          'PROGRESS_STORE_TYPE',
          'memory',
        );

        if (storeType === 'redis') {
          return new RedisProgressStore(configService);
        }

        return new InMemoryProgressStore();
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    RabbitMQSetupService,
    DigestionJobPublisher, // Export for Capture Context integration
    DigestionJobConsumer,
    ProgressTrackerService, // Export for monitoring
    QueueMonitoringService, // Export for metrics access
    ThoughtStatusRepository, // Referential cache repository (ADR-027)
  ],
})
export class KnowledgeModule {}
