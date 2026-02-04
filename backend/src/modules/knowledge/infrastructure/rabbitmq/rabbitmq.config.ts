/**
 * RabbitMQ Configuration
 * Infrastructure setup for async job queue
 *
 * IMPORTANT: All queue configurations are centralized here to ensure
 * consistency between setup service and consumer configuration.
 * Never duplicate queue options - always use these constants.
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
 * Centralized queue options - SINGLE SOURCE OF TRUTH
 * Used by both RabbitMQSetupService and NestJS microservices consumer
 *
 * This ensures the queue is created with identical parameters regardless
 * of which service creates it first (setup service or consumer connection).
 */
export const DIGESTION_QUEUE_OPTIONS = {
  durable: true, // Survive server restarts (AC1)
  deadLetterExchange: ExchangeNames.DIGESTION_DLX,
  deadLetterRoutingKey: RoutingKeys.DIGESTION_FAILED,
  // Priority queue support (AC3) - MUST be set at queue creation time
  arguments: {
    'x-max-priority': 10, // Enable 0-10 priority levels
  },
} as const;

/**
 * Get RabbitMQ connection URL from environment
 * Defaults to homelab server at 10.0.0.2
 */
export function getRabbitMQUrl(): string {
  return process.env.RABBITMQ_URL || 'amqp://pensine:pensine@10.0.0.2:5672';
}

/**
 * RabbitMQ configuration for digestion jobs queue
 * Uses centralized DIGESTION_QUEUE_OPTIONS for consistency
 */
export const digestionQueueConfig: RabbitMQConfig = {
  url: getRabbitMQUrl(),
  prefetchCount: 3, // Max 3 concurrent GPT API calls (AC3)
  queueOptions: DIGESTION_QUEUE_OPTIONS,
};

/**
 * NestJS Microservices RabbitMQ options
 * Uses centralized DIGESTION_QUEUE_OPTIONS to ensure consistency
 * with RabbitMQSetupService configuration
 */
export function getRabbitMQOptions(): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [getRabbitMQUrl()],
      queue: QueueNames.DIGESTION_JOBS,
      queueOptions: DIGESTION_QUEUE_OPTIONS, // ← Single source of truth
      prefetchCount: 3, // Max 3 concurrent workers (AC3)
      noAck: false, // Ensure message acknowledgment
      // Connection pooling and heartbeat settings (Subtask 1.5)
      socketOptions: {
        heartbeatIntervalInSeconds: 30,
        reconnectTimeInSeconds: 5,
      },
    },
  };
}
