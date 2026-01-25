/**
 * Domain Events for Transcription Queue
 *
 * Published by: TranscriptionQueueService
 * Consumed by: QueueDebugStoreSync, TranscriptionWorker (future)
 *
 * Architecture (ADR-019):
 * - Events represent facts that happened in the queue domain
 * - Published AFTER DB operations (事実 = fact)
 * - Immutable payloads
 * - Enable reactive architecture (no polling)
 */

import type { DomainEvent } from '../../shared/events/EventBus';

/**
 * QueueItemAdded - Fired when capture is enqueued for transcription
 */
export interface QueueItemAddedEvent extends DomainEvent<'QueueItemAdded'> {
  payload: {
    captureId: string;
    audioPath: string;
    audioDuration: number | null;
    queueId: string;
    timestamp: number;
  };
}

/**
 * QueueItemStarted - Fired when transcription processing begins
 */
export interface QueueItemStartedEvent extends DomainEvent<'QueueItemStarted'> {
  payload: {
    captureId: string;
    queueId: string;
    timestamp: number;
  };
}

/**
 * QueueItemCompleted - Fired when transcription succeeds
 */
export interface QueueItemCompletedEvent extends DomainEvent<'QueueItemCompleted'> {
  payload: {
    captureId: string;
    queueId: string;
    timestamp: number;
  };
}

/**
 * QueueItemFailed - Fired when transcription fails
 */
export interface QueueItemFailedEvent extends DomainEvent<'QueueItemFailed'> {
  payload: {
    captureId: string;
    queueId: string;
    error: string;
    retryCount: number;
    timestamp: number;
  };
}

/**
 * QueueItemRemoved - Fired when item removed from queue (capture deleted)
 */
export interface QueueItemRemovedEvent extends DomainEvent<'QueueItemRemoved'> {
  payload: {
    captureId: string;
    timestamp: number;
  };
}

/**
 * QueuePausedChanged - Fired when queue is paused/resumed
 */
export interface QueuePausedChangedEvent extends DomainEvent<'QueuePausedChanged'> {
  payload: {
    isPaused: boolean;
    timestamp: number;
  };
}
