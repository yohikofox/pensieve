/**
 * RabbitMQ Queue Names
 * Centralized constants for queue management
 */

export const QueueNames = {
  DIGESTION_JOBS: 'digestion-jobs',
  DIGESTION_FAILED: 'digestion-failed',
} as const;

export const ExchangeNames = {
  DIGESTION_DLX: 'digestion-dlx',
} as const;

export const RoutingKeys = {
  DIGESTION_FAILED: 'digestion.failed',
} as const;
