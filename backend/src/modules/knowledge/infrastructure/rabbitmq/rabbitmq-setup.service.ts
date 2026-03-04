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
import {
  QueueNames,
  ExchangeNames,
  RoutingKeys,
} from './queue-names.constants';
import { getRabbitMQUrl, DIGESTION_QUEUE_OPTIONS } from './rabbitmq.config';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);

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
      this.logger.log(
        `Connecting to RabbitMQ at ${url.replace(/\/\/.*@/, '//*****@')}`,
      );

      // @ts-expect-error - amqplib types issue with Connection
      const connection: amqp.Connection = await amqp.connect(url, {
        // Connection pooling settings (Subtask 1.5)
        heartbeat: 30,
      });

      // Prevent unhandled 'error' events from crashing the process
      // (amqplib emits 'error' on heartbeat timeout or network drop)
      connection.on('error', (err: Error) => {
        this.logger.warn(`RabbitMQ setup connection error: ${err.message}`);
      });

      // @ts-expect-error - amqplib types issue with createChannel
      const channel: amqp.Channel = await connection.createChannel();
      channel.on('error', (err: Error) => {
        this.logger.warn(`RabbitMQ setup channel error: ${err.message}`);
      });

      // Create dead-letter exchange (Subtask 1.4)
      await channel.assertExchange(ExchangeNames.DIGESTION_DLX, 'direct', {
        durable: true,
      });
      this.logger.log(
        `✓ Dead-letter exchange created: ${ExchangeNames.DIGESTION_DLX}`,
      );

      // Create dead-letter queue (Subtask 1.4)
      await channel.assertQueue(QueueNames.DIGESTION_FAILED, {
        durable: true, // Survive restarts
      });
      this.logger.log(
        `✓ Dead-letter queue created: ${QueueNames.DIGESTION_FAILED}`,
      );

      // Bind DLQ to DLX
      await channel.bindQueue(
        QueueNames.DIGESTION_FAILED,
        ExchangeNames.DIGESTION_DLX,
        RoutingKeys.DIGESTION_FAILED,
      );

      // Create main digestion jobs queue (Subtask 1.3)
      // Uses centralized DIGESTION_QUEUE_OPTIONS to ensure consistency
      // with consumer configuration (prevents PRECONDITION_FAILED errors)
      await channel.assertQueue(
        QueueNames.DIGESTION_JOBS,
        DIGESTION_QUEUE_OPTIONS,
      );
      this.logger.log(
        `✓ Digestion jobs queue created: ${QueueNames.DIGESTION_JOBS}`,
      );

      this.logger.log('✅ RabbitMQ infrastructure setup complete');

      // Close the setup connection — queues/exchanges persist in RabbitMQ
      // regardless of connection state. Keeping it open indefinitely would
      // cause heartbeat timeouts after hours of inactivity (unhandled 'error').
      await channel.close();
      // @ts-expect-error - amqplib types issue with close
      await connection.close();
      this.logger.log(
        'RabbitMQ setup connection closed (infrastructure persists)',
      );
    } catch (error) {
      // Detect queue parameter mismatch error (common when queue exists with different config)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isPreconditionFailed =
        errorMessage.includes('PRECONDITION_FAILED') ||
        errorMessage.includes('inequivalent arg');

      if (isPreconditionFailed) {
        this.logger.error(
          '❌ RabbitMQ queue configuration mismatch detected!\n' +
            '\n' +
            'The queue already exists with different parameters.\n' +
            'This happens when the queue was created before without x-max-priority.\n' +
            '\n' +
            'To fix this issue:\n' +
            '1. Run: npm run reset-rabbitmq (or scripts/reset-rabbitmq-queues.sh)\n' +
            '2. Restart the application\n' +
            '\n' +
            'Alternatively, manually delete the queues via RabbitMQ Management UI:\n' +
            '- http://10.0.0.2:15672 (user: pensine, pass: pensine)\n' +
            '- Delete: digestion-jobs, digestion-failed, digestion-dlx\n',
        );
      } else {
        this.logger.error('Failed to setup RabbitMQ infrastructure:', error);
      }

      throw error;
    }
  }
}
