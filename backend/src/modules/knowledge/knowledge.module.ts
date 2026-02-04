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
import { RabbitMQSetupService } from './infrastructure/rabbitmq/rabbitmq-setup.service';
import { DigestionJobPublisher } from './application/publishers/digestion-job-publisher.service';
import { DigestionJobConsumer } from './application/consumers/digestion-job-consumer.service';
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
  ],
  providers: [
    RabbitMQSetupService, // Initialize queues on startup
    DigestionJobPublisher, // Publish digestion jobs (AC2)
    DigestionJobConsumer, // Consume and process jobs (AC3)
  ],
  exports: [
    'DIGESTION_QUEUE', // Export for use in other modules
    RabbitMQSetupService,
    DigestionJobPublisher, // Export for Capture Context integration
    DigestionJobConsumer,
  ],
})
export class KnowledgeModule {}
