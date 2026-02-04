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

import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { RabbitMQSetupService } from './infrastructure/rabbitmq/rabbitmq-setup.service';
import { DigestionJobPublisher } from './application/publishers/digestion-job-publisher.service';
import { DigestionJobConsumer } from './application/consumers/digestion-job-consumer.service';
import { ProgressTrackerService } from './application/services/progress-tracker.service';
import { QueueMonitoringService } from './application/services/queue-monitoring.service';
import { EventBusService } from './application/services/event-bus.service';
import { DigestionRetryController } from './application/controllers/digestion-retry.controller';
import { MetricsController } from './application/controllers/metrics.controller';
import { BatchDigestionController } from './application/controllers/batch-digestion.controller';
import { CaptureRepositoryStub } from './infrastructure/stubs/capture-repository.stub';
import { InMemoryProgressStore } from './infrastructure/stores/in-memory-progress.store';
import { RedisProgressStore } from './infrastructure/stores/redis-progress.store';
import { getRabbitMQOptions } from './infrastructure/rabbitmq/rabbitmq.config';
import { QueueNames } from './infrastructure/rabbitmq/queue-names.constants';

@Module({
  imports: [
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
  ],
  providers: [
    RabbitMQSetupService, // Initialize queues on startup
    DigestionJobPublisher, // Publish digestion jobs (AC2)
    DigestionJobConsumer, // Consume and process jobs (AC3)
    ProgressTrackerService, // Track job progress (AC4)
    QueueMonitoringService, // Monitor queue health and metrics (AC6)
    EventBusService, // Domain event publishing (AC2, AC4, AC5)
    // Capture Repository stub - replaces when Capture Context is integrated
    {
      provide: 'CAPTURE_REPOSITORY',
      useClass: CaptureRepositoryStub,
    },
    // Progress Store - choose implementation based on environment
    {
      provide: 'PROGRESS_STORE',
      useFactory: (configService: ConfigService) => {
        const storeType = configService.get<string>('PROGRESS_STORE_TYPE', 'memory');

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
  ],
})
export class KnowledgeModule {}
