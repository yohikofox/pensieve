/**
 * TranscriptionQueueProcessor - Auto-enqueue captures for transcription
 *
 * Architecture (ADR-019):
 * - Subscribes to CaptureRecorded events via EventBus
 * - Automatically enqueues audio captures for background transcription
 * - Lifecycle: Transient (new instance per DI resolve)
 * - State: Stateless (subscription managed via start/stop)
 *
 * Responsibilities:
 * - Listen for CaptureRecorded events
 * - Filter audio captures (ignore text captures)
 * - Enqueue via TranscriptionQueueService
 * - Handle errors gracefully (log, don't crash)
 *
 * Usage:
 * ```typescript
 * const processor = new TranscriptionQueueProcessor(queueService, eventBus);
 * processor.start(); // Begin listening
 * // ... app lifecycle
 * processor.stop(); // Cleanup on app shutdown
 * ```
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Subscription } from 'rxjs';
import type { EventBus } from '../../shared/events/EventBus';
import type { CaptureRecordedEvent, CaptureDeletedEvent } from '../../capture/events/CaptureEvents';
import { CAPTURE_TYPES } from '../../capture/domain/Capture.model';
import { TranscriptionQueueService } from '../services/TranscriptionQueueService';
import { useSettingsStore } from '../../../stores/settingsStore';

@injectable()
export class TranscriptionQueueProcessor {
  private recordedSubscription: Subscription | null = null;
  private deletedSubscription: Subscription | null = null;
  private isRunning = false;

  constructor(
    private queueService: TranscriptionQueueService,
    @inject('EventBus') private eventBus: EventBus
  ) {}

  /**
   * Start listening for Capture events
   *
   * Call during app initialization to enable auto-enqueue and auto-dequeue.
   * Idempotent: Calling multiple times has no effect.
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[TranscriptionQueueProcessor] Already running, ignoring start()');
      return;
    }

    // Subscribe to CaptureRecorded events (auto-enqueue)
    this.recordedSubscription = this.eventBus.subscribe<CaptureRecordedEvent>(
      'CaptureRecorded',
      this.handleCaptureRecorded.bind(this)
    );

    // Subscribe to CaptureDeleted events (auto-dequeue)
    this.deletedSubscription = this.eventBus.subscribe<CaptureDeletedEvent>(
      'CaptureDeleted',
      this.handleCaptureDeleted.bind(this)
    );

    this.isRunning = true;
    console.log('[TranscriptionQueueProcessor] ✅ Started listening for Capture events');
  }

  /**
   * Stop listening for events
   *
   * Call during app shutdown to cleanup resources.
   * Idempotent: Calling multiple times has no effect.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.recordedSubscription) {
      this.recordedSubscription.unsubscribe();
      this.recordedSubscription = null;
    }

    if (this.deletedSubscription) {
      this.deletedSubscription.unsubscribe();
      this.deletedSubscription = null;
    }

    this.isRunning = false;
    console.log('[TranscriptionQueueProcessor] 🛑 Stopped listening');
  }

  /**
   * Handle CaptureRecorded event
   *
   * Auto-enqueues audio captures for transcription.
   * Text captures are ignored (no transcription needed).
   *
   * @param event - CaptureRecorded event
   */
  private async handleCaptureRecorded(event: CaptureRecordedEvent): Promise<void> {
    console.log('[TranscriptionQueueProcessor] 📨 Received CaptureRecorded event:', event.payload.captureId);
    const { captureId, captureType, audioPath, audioDuration } = event.payload;

    // Only process audio captures
    if (captureType !== CAPTURE_TYPES.AUDIO) {
      console.log(
        `[TranscriptionQueueProcessor] ⏭️  Skipping text capture ${captureId} (no transcription needed)`
      );
      return;
    }

    // Check if auto-transcription is enabled
    const autoEnabled = useSettingsStore.getState().autoTranscriptionEnabled;
    if (!autoEnabled) {
      console.log(
        `[TranscriptionQueueProcessor] ⏭️  Skipping capture ${captureId} (auto-transcription disabled)`
      );
      return;
    }

    console.log('[TranscriptionQueueProcessor] 🎙️ Audio capture detected, preparing to enqueue...');

    // Validate audio path is present
    if (!audioPath) {
      console.error(
        `[TranscriptionQueueProcessor] ❌ Audio capture ${captureId} has no audioPath, cannot enqueue`
      );
      return;
    }

    // Enqueue for transcription
    try {
      await this.queueService.enqueue({
        captureId,
        audioPath,
        audioDuration,
      });

      console.log(
        `[TranscriptionQueueProcessor] ✅ Auto-enqueued capture ${captureId} for transcription` +
        (audioDuration ? ` (${Math.round(audioDuration / 1000)}s)` : '')
      );
    } catch (error) {
      // Log error but don't crash - transcription is not critical path
      console.error(
        `[TranscriptionQueueProcessor] ❌ Failed to enqueue capture ${captureId}:`,
        error
      );
    }
  }

  /**
   * Handle CaptureDeleted event
   *
   * Removes capture from transcription queue if it's still pending.
   * Prevents wasted resources transcribing deleted captures.
   *
   * @param event - CaptureDeleted event
   */
  private async handleCaptureDeleted(event: CaptureDeletedEvent): Promise<void> {
    const { captureId, captureType } = event.payload;

    // Only process audio captures (text captures are never in queue)
    if (captureType !== CAPTURE_TYPES.AUDIO) {
      return;
    }

    // Remove from queue if present
    try {
      await this.queueService.remove(captureId);
      console.log(
        `[TranscriptionQueueProcessor] ✅ Removed deleted capture ${captureId} from queue`
      );
    } catch (error) {
      // Log error but don't crash
      console.error(
        `[TranscriptionQueueProcessor] ❌ Failed to remove capture ${captureId} from queue:`,
        error
      );
    }
  }

  /**
   * Check if processor is currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
