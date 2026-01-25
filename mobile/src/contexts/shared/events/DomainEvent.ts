/**
 * Base Domain Event Interface
 *
 * All domain events must extend this interface.
 * Events are immutable facts about what happened in the system.
 *
 * Design Principles (ADR-019):
 * - Events are named in past tense (CaptureRecorded, TranscriptionCompleted)
 * - Events contain all data needed by subscribers (no lookups required)
 * - Events are immutable (readonly properties)
 * - Timestamp in Unix milliseconds for consistency with DB
 */
export interface DomainEvent {
  /**
   * Event type discriminator (for TypeScript type narrowing)
   * Example: 'CaptureRecorded', 'TranscriptionCompleted'
   */
  readonly type: string;

  /**
   * When the event occurred (Unix milliseconds)
   */
  readonly timestamp: number;

  /**
   * Event payload - domain-specific data
   */
  readonly payload: unknown;
}

/**
 * Type guard to check if an object is a DomainEvent
 */
export function isDomainEvent(obj: unknown): obj is DomainEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'timestamp' in obj &&
    'payload' in obj
  );
}
