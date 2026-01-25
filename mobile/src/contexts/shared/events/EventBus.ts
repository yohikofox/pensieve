/**
 * EventBus - Pub/Sub for Domain Events
 *
 * Architecture Decision: RxJS Subject (ADR-019)
 * - Score: 9.5/10 (best fit for React Native + TypeScript)
 * - Type-safe pub/sub with filtering by event type
 * - Memory-efficient (no event history retained)
 * - Reactive streams for complex event processing
 *
 * Lifecycle: Singleton (ADR-021 exception)
 * - Rationale: Shared message bus across all contexts
 * - State: Transient (no persistence, events are ephemeral)
 *
 * Usage:
 * ```typescript
 * // Publisher
 * eventBus.publish({ type: 'CaptureRecorded', timestamp: Date.now(), payload: {...} });
 *
 * // Subscriber
 * const subscription = eventBus.subscribe('CaptureRecorded', (event) => {
 *   console.log('Capture recorded:', event.payload);
 * });
 *
 * // Cleanup
 * subscription.unsubscribe();
 * ```
 */

import { Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { DomainEvent } from './DomainEvent';

/**
 * Event handler callback
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void;

/**
 * EventBus implementation using RxJS Subject
 *
 * NOT thread-safe: All operations must run on main JS thread (React Native constraint)
 */
export class EventBus {
  private subject: Subject<DomainEvent>;

  constructor() {
    // Subject = hot observable (multicast to all subscribers)
    this.subject = new Subject<DomainEvent>();
  }

  /**
   * Publish a domain event to all subscribers
   *
   * Events are dispatched synchronously on the current JS thread.
   * Subscribers are invoked immediately in subscription order.
   *
   * @param event - Domain event to publish
   */
  publish<T extends DomainEvent>(event: T): void {
    this.subject.next(event);
  }

  /**
   * Subscribe to events of a specific type
   *
   * Type-safe filtering: Only events matching the type will be delivered.
   * Returns a Subscription for cleanup (call .unsubscribe() when done).
   *
   * @param eventType - Event type to filter on (e.g., 'CaptureRecorded')
   * @param handler - Callback invoked for each matching event
   * @returns Subscription (call .unsubscribe() to stop listening)
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>
  ): Subscription {
    return this.subject
      .pipe(
        filter((event): event is T => event.type === eventType)
      )
      .subscribe(handler);
  }

  /**
   * Subscribe to all events (no filtering)
   *
   * Use sparingly - prefer type-specific subscriptions for clarity.
   *
   * @param handler - Callback invoked for every event
   * @returns Subscription (call .unsubscribe() to stop listening)
   */
  subscribeAll(handler: EventHandler<DomainEvent>): Subscription {
    return this.subject.subscribe(handler);
  }

  /**
   * Complete the event stream (closes all subscriptions)
   *
   * Call during app shutdown to cleanup resources.
   * After calling complete(), no more events can be published.
   */
  complete(): void {
    this.subject.complete();
  }
}

/**
 * Singleton EventBus instance (ADR-021 exception)
 *
 * Rationale: Shared message bus across all bounded contexts
 */
export const eventBus = new EventBus();
