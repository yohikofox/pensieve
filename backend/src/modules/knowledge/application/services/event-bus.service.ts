/**
 * Event Bus Service
 * Publishes domain events for cross-context communication
 *
 * Uses NestJS EventEmitter for in-process event distribution
 * Events can be subscribed to by other bounded contexts
 *
 * Covers:
 * - Subtask 2.5: Publish domain events (DigestionJobQueued)
 * - Subtask 4.3: Publish progress events (DigestionJobStarted)
 * - Subtask 5.5: Publish failure events (DigestionJobFailed)
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface DomainEvent {
  eventName: string;
  occurredAt: Date;
  payload: Record<string, any>;
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish a domain event to all subscribers
   *
   * @param eventName - Event type (e.g., 'digestion.job.queued')
   * @param payload - Event data
   */
  publish(eventName: string, payload: Record<string, any>): void {
    const event: DomainEvent = {
      eventName,
      occurredAt: new Date(),
      payload,
    };

    this.logger.debug(`📢 Publishing event: ${eventName}`, payload);

    // Emit to NestJS EventEmitter (in-process subscribers)
    this.eventEmitter.emit(eventName, event);

    // TODO Story 4.6.2: Add external event bus (RabbitMQ fanout, Redis pub/sub)
    // for cross-service communication in distributed deployments
  }

  /**
   * Subscribe to domain events
   *
   * NOTE: Use @OnEvent(eventName) decorator in subscriber classes
   * Example:
   *   @OnEvent('digestion.job.queued')
   *   handleJobQueued(event: DomainEvent) { ... }
   */
}
