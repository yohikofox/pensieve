/**
 * RabbitMQ Setup Service
 * Initializes queues, exchanges, and bindings on application startup
 *
 * Covers:
 * - Subtask 1.3: Create "digestion-jobs" queue with persistence
 * - Subtask 1.4: Create "digestion-failed" dead-letter queue
 * - Subtask 1.5: Configure connection pooling and heartbeat
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as amqp from 'amqplib';
import { QueueNames, ExchangeNames, RoutingKeys } from './queue-names.constants';
import { getRabbitMQUrl } from './rabbitmq.config';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);
  private connection!: amqp.Connection;
  private channel!: amqp.Channel;

  async onModuleInit() {
    await this.setupInfrastructure();
  }

  /**
   * Setup RabbitMQ infrastructure on module initialization
   * Creates queues, exchanges, and bindings
   */
  private async setupInfrastructure(): Promise<void> {
    try {
      // Connect to RabbitMQ
      const url = getRabbitMQUrl();
      this.logger.log(`Connecting to RabbitMQ at ${url.replace(/\/\/.*@/, '//*****@')}`);

      // @ts-expect-error - amqplib types issue with Connection
      this.connection = await amqp.connect(url, {
        // Connection pooling settings (Subtask 1.5)
        heartbeat: 30,
      });

      // @ts-expect-error - amqplib types issue with createChannel
      this.channel = await this.connection.createChannel();

      // Create dead-letter exchange (Subtask 1.4)
      await this.channel.assertExchange(ExchangeNames.DIGESTION_DLX, 'direct', {
        durable: true,
      });
      this.logger.log(`✓ Dead-letter exchange created: ${ExchangeNames.DIGESTION_DLX}`);

      // Create dead-letter queue (Subtask 1.4)
      await this.channel.assertQueue(QueueNames.DIGESTION_FAILED, {
        durable: true, // Survive restarts
      });
      this.logger.log(`✓ Dead-letter queue created: ${QueueNames.DIGESTION_FAILED}`);

      // Bind DLQ to DLX
      await this.channel.bindQueue(
        QueueNames.DIGESTION_FAILED,
        ExchangeNames.DIGESTION_DLX,
        RoutingKeys.DIGESTION_FAILED,
      );

      // Create main digestion jobs queue (Subtask 1.3)
      await this.channel.assertQueue(QueueNames.DIGESTION_JOBS, {
        durable: true, // Persistence enabled (AC1)
        deadLetterExchange: ExchangeNames.DIGESTION_DLX,
        deadLetterRoutingKey: RoutingKeys.DIGESTION_FAILED,
        arguments: {
          // Priority queue support (AC3)
          'x-max-priority': 10,
        },
      });
      this.logger.log(`✓ Digestion jobs queue created: ${QueueNames.DIGESTION_JOBS}`);

      this.logger.log('✅ RabbitMQ infrastructure setup complete');
    } catch (error) {
      this.logger.error('Failed to setup RabbitMQ infrastructure:', error);
      throw error;
    }
  }

  /**
   * Get channel for manual operations (testing purposes)
   */
  getChannel(): amqp.Channel {
    return this.channel;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.channel?.close();
    // @ts-expect-error - amqplib types issue with close
    await this.connection?.close();
    this.logger.log('RabbitMQ connection closed');
  }
}
