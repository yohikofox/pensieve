/**
 * RabbitMQ Configuration
 * Infrastructure setup for async job queue
 */

import { Transport, RmqOptions } from '@nestjs/microservices';
import { QueueNames, ExchangeNames, RoutingKeys } from './queue-names.constants';

export interface RabbitMQConfig {
  url: string;
  prefetchCount: number;
  queueOptions: {
    durable: boolean;
    deadLetterExchange?: string;
    deadLetterRoutingKey?: string;
    messageTtl?: number;
  };
}

/**
 * Get RabbitMQ connection URL from environment
 * Defaults to homelab server at 10.0.0.2
 */
export function getRabbitMQUrl(): string {
  return process.env.RABBITMQ_URL || 'amqp://pensine:pensine@10.0.0.2:5672';
}

/**
 * RabbitMQ configuration for digestion jobs queue
 */
export const digestionQueueConfig: RabbitMQConfig = {
  url: getRabbitMQUrl(),
  prefetchCount: 3, // Max 3 concurrent GPT API calls (AC3)
  queueOptions: {
    durable: true, // Survive server restarts (AC1)
    deadLetterExchange: ExchangeNames.DIGESTION_DLX,
    deadLetterRoutingKey: RoutingKeys.DIGESTION_FAILED,
  },
};

/**
 * NestJS Microservices RabbitMQ options
 */
export function getRabbitMQOptions(): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [getRabbitMQUrl()],
      queue: QueueNames.DIGESTION_JOBS,
      queueOptions: {
        durable: true,
        deadLetterExchange: ExchangeNames.DIGESTION_DLX,
        deadLetterRoutingKey: RoutingKeys.DIGESTION_FAILED,
      },
      prefetchCount: 3,
      noAck: false, // Ensure message acknowledgment
      // Connection pooling and heartbeat settings (Subtask 1.5)
      socketOptions: {
        heartbeatIntervalInSeconds: 30,
        reconnectTimeInSeconds: 5,
      },
    },
  };
}
