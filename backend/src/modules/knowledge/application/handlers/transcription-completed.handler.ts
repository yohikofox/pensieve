/**
 * TranscriptionCompleted Event Handler (EXAMPLE)
 *
 * This handler demonstrates how to integrate DigestionJobPublisher
 * with the Capture Context when transcription completes.
 *
 * Covers:
 * - Subtask 2.3: Integrate publisher into Capture Context
 * - Subtask 2.4: Update Capture entity status
 *
 * NOTE: This is a stub implementation. Full integration requires:
 * 1. Capture module in backend with Capture entity
 * 2. Event bus system (e.g., @nestjs/cqrs EventBus)
 * 3. Capture repository to update status
 * 4. Event listeners configured in module
 *
 * FUTURE IMPLEMENTATION (Story 4.2 or later):
 * ```typescript
 * import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
 * import { CaptureRepository } from '../../../capture/domain/repositories/capture.repository';
 *
 * @EventsHandler(TranscriptionCompleted)
 * export class TranscriptionCompletedHandler implements IEventHandler<TranscriptionCompleted> {
 *   constructor(
 *     private readonly digestionJobPublisher: DigestionJobPublisher,
 *     private readonly captureRepository: CaptureRepository,
 *   ) {}
 *
 *   async handle(event: TranscriptionCompleted) {
 *     // Subtask 2.4: Update Capture status
 *     await this.captureRepository.updateStatus(
 *       event.captureId,
 *       'queued_for_digestion'
 *     );
 *
 *     // Subtask 2.3: Publish digestion job
 *     await this.digestionJobPublisher.publishJob({
 *       id: event.captureId,
 *       userId: event.userId,
 *       type: 'AUDIO',
 *       state: 'transcribed',
 *       userInitiated: false,
 *     });
 *   }
 * }
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { DigestionJobPublisher } from '../publishers/digestion-job-publisher.service';

/**
 * Event from Normalization Context (Story 2.5)
 */
interface TranscriptionCompleted {
  captureId: string;
  userId: string;
  transcription: string;
  completedAt: Date;
}

/**
 * Event from Capture Context (Story 2.2)
 */
interface TextCaptureCreated {
  captureId: string;
  userId: string;
  text: string;
  createdAt: Date;
}

@Injectable()
export class CaptureEventsHandler {
  private readonly logger = new Logger(CaptureEventsHandler.name);

  constructor(private readonly digestionJobPublisher: DigestionJobPublisher) {}

  /**
   * Handle TranscriptionCompleted event
   * Triggers digestion job for audio captures
   */
  async handleTranscriptionCompleted(
    event: TranscriptionCompleted,
  ): Promise<void> {
    this.logger.log(
      `Transcription completed for capture ${event.captureId}, queuing digestion job`,
    );

    // TODO: Update Capture entity status to "queued_for_digestion"
    // This requires Capture repository and database entity

    // Subtask 2.3: Publish digestion job
    await this.digestionJobPublisher.publishJob({
      captureId: event.captureId,
      userId: event.userId,
      type: 'AUDIO',
      state: 'transcribed',
      userInitiated: false, // Auto-background processing
    });

    this.logger.log(
      `Digestion job queued for audio capture ${event.captureId}`,
    );
  }

  /**
   * Handle TextCaptureCreated event
   * Triggers digestion job for text captures (bypasses transcription)
   */
  async handleTextCaptureCreated(event: TextCaptureCreated): Promise<void> {
    this.logger.log(
      `Text capture created ${event.captureId}, queuing digestion job`,
    );

    // TODO: Update Capture entity status to "queued_for_digestion"

    // Subtask 2.6: Handle text captures (bypass transcription)
    await this.digestionJobPublisher.publishJobForTextCapture({
      captureId: event.captureId,
      userId: event.userId,
      type: 'TEXT',
      state: 'ready',
      userInitiated: true, // User directly created text
    });

    this.logger.log(`Digestion job queued for text capture ${event.captureId}`);
  }
}
