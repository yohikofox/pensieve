/**
 * Sync Domain Events
 * Story 6.3 - Task 3.4: Reactive UI updates after sync
 *
 * Events emitted by the Sync infrastructure.
 * These are immutable facts about sync operations.
 *
 * Event Naming Convention (ADR-019):
 * - Past tense: "SyncCompleted" not "CompleteSync"
 * - Action + Result: "Sync" + "Completed"
 */

import type { DomainEvent } from '../../../contexts/shared/events/DomainEvent';

/**
 * SyncCompleted Event
 *
 * Emitted when a sync operation (pull/push or both) has completed successfully.
 * UI components should reload data to reflect server changes.
 *
 * Subscribers:
 * - CapturesStore (reload captures after pull)
 * - ThoughtsStore (reload thoughts after pull)
 * - IdeasStore (reload ideas after pull)
 * - TodosStore (reload todos after pull)
 */
export interface SyncCompletedEvent extends DomainEvent {
  readonly type: 'SyncCompleted';
  readonly payload: {
    /**
     * Which entities were synced
     * Example: ['captures', 'thoughts', 'ideas', 'todos']
     */
    readonly entities: string[];

    /**
     * Sync direction (pull, push, or both)
     */
    readonly direction: 'pull' | 'push' | 'both';

    /**
     * Number of changes applied (for UI feedback)
     */
    readonly changesCount?: number;

    /**
     * Sync trigger source (for analytics)
     */
    readonly source?: 'manual' | 'periodic' | 'auto' | 'initial';
  };
}

/**
 * SyncFailed Event
 *
 * Emitted when a sync operation fails.
 * UI components can show error notifications.
 */
export interface SyncFailedEvent extends DomainEvent {
  readonly type: 'SyncFailed';
  readonly payload: {
    readonly error: string;
    readonly retryable: boolean;
    readonly source?: 'manual' | 'periodic' | 'auto' | 'initial';
  };
}

/**
 * Union type of all Sync events
 */
export type SyncEvent = SyncCompletedEvent | SyncFailedEvent;

/**
 * Type guard for SyncCompletedEvent
 */
export function isSyncCompletedEvent(event: DomainEvent): event is SyncCompletedEvent {
  return event.type === 'SyncCompleted';
}

/**
 * Type guard for SyncFailedEvent
 */
export function isSyncFailedEvent(event: DomainEvent): event is SyncFailedEvent {
  return event.type === 'SyncFailed';
}
