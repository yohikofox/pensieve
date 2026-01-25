/**
 * Capture Domain Events
 *
 * Events emitted by the Capture bounded context.
 * These are immutable facts about what happened to captures.
 *
 * Event Naming Convention (ADR-019):
 * - Past tense: "CaptureRecorded" not "RecordCapture"
 * - Entity + Action: "Capture" + "Recorded"
 */

import type { DomainEvent } from '../../shared/events/DomainEvent';

/**
 * CaptureRecorded Event
 *
 * Emitted when an audio or text capture has been successfully recorded.
 *
 * Subscribers:
 * - TranscriptionQueueProcessor (auto-enqueue for transcription)
 * - SyncService (schedule backend sync)
 * - AnalyticsService (track capture metrics)
 */
export interface CaptureRecordedEvent extends DomainEvent {
  readonly type: 'CaptureRecorded';
  readonly payload: {
    readonly captureId: string;
    readonly captureType: 'audio' | 'text';
    readonly audioPath?: string;  // File path for audio captures
    readonly audioDuration?: number;  // Milliseconds for audio captures
    readonly textContent?: string;  // Text content for text captures
    readonly createdAt: number;  // Unix milliseconds
  };
}

/**
 * CaptureDeleted Event
 *
 * Emitted when a capture has been deleted by the user.
 *
 * Subscribers:
 * - TranscriptionQueueProcessor (remove from queue if pending)
 * - SyncService (schedule delete sync)
 * - StorageService (cleanup audio files)
 */
export interface CaptureDeletedEvent extends DomainEvent {
  readonly type: 'CaptureDeleted';
  readonly payload: {
    readonly captureId: string;
    readonly captureType: 'audio' | 'text';
    readonly audioPath?: string;  // File path to cleanup
  };
}

/**
 * CaptureUpdated Event
 *
 * Emitted when capture metadata has been updated.
 *
 * Subscribers:
 * - SyncService (schedule update sync)
 */
export interface CaptureUpdatedEvent extends DomainEvent {
  readonly type: 'CaptureUpdated';
  readonly payload: {
    readonly captureId: string;
    readonly updatedFields: string[];  // Which fields changed
  };
}

/**
 * Union type of all Capture events
 */
export type CaptureEvent =
  | CaptureRecordedEvent
  | CaptureDeletedEvent
  | CaptureUpdatedEvent;

/**
 * Type guard for CaptureRecordedEvent
 */
export function isCaptureRecordedEvent(
  event: DomainEvent
): event is CaptureRecordedEvent {
  return event.type === 'CaptureRecorded';
}

/**
 * Type guard for CaptureDeletedEvent
 */
export function isCaptureDeletedEvent(
  event: DomainEvent
): event is CaptureDeletedEvent {
  return event.type === 'CaptureDeleted';
}

/**
 * Type guard for CaptureUpdatedEvent
 */
export function isCaptureUpdatedEvent(
  event: DomainEvent
): event is CaptureUpdatedEvent {
  return event.type === 'CaptureUpdated';
}
