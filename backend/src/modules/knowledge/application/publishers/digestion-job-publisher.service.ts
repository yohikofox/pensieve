/**
 * Digestion Job Publisher Service
 * Publishes digestion jobs to RabbitMQ queue after capture is ready
 *
 * Covers:
 * - Subtask 2.1: Create DigestionJobPublisher service
 * - AC2: Automatic Job Publishing After Transcription
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  DigestionJobPayload,
  CreateDigestionJobInput,
  ContentType,
  Priority,
} from '../../domain/interfaces/digestion-job-payload.interface';
import { DigestionJobQueued } from '../../domain/events/DigestionJobQueued.event';
import type { ICaptureRepository } from '../../domain/interfaces/capture-repository.interface';

@Injectable()
export class DigestionJobPublisher {
  private readonly logger = new Logger(DigestionJobPublisher.name);

  constructor(
    @Inject('DIGESTION_QUEUE')
    private readonly rabbitMQClient: ClientProxy,
    @Inject('CAPTURE_REPOSITORY')
    private readonly captureRepository: ICaptureRepository,
  ) {}

  /**
   * Publish a digestion job to RabbitMQ queue
   *
   * @param capture - Capture entity ready for digestion
   * @returns Promise that resolves when job is published
   */
  async publishJob(capture: CreateDigestionJobInput): Promise<void> {
    try {
      const payload = this.createJobPayload(capture);

      // Emit job to RabbitMQ queue
      await firstValueFrom(
        this.rabbitMQClient.emit('digestion.job.queued', payload),
      );

      // Subtask 2.4: Update Capture status to "queued_for_digestion"
      await this.captureRepository.updateStatus(
        capture.captureId,
        'queued_for_digestion',
      );

      this.logger.log(
        `✓ Digestion job queued for capture ${capture.captureId} (priority: ${payload.priority})`,
      );

      // Subtask 2.5: Publish Domain Event for observability
      // TODO: Integrate with Event Bus when available
      const event = new DigestionJobQueued(
        payload.captureId,
        payload.userId,
        payload.queuedAt,
        payload.priority,
      );
      this.logger.debug(`Domain event: DigestionJobQueued`, event);
    } catch (error) {
      this.logger.error(
        `Failed to publish digestion job for capture ${capture.captureId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish job specifically for text captures (bypasses transcription)
   * Subtask 2.6: Handle text captures
   *
   * @param textCapture - Text capture ready for digestion
   */
  async publishJobForTextCapture(
    textCapture: CreateDigestionJobInput,
  ): Promise<void> {
    await this.publishJob(textCapture);
  }

  /**
   * Create job payload from capture data
   *
   * @param capture - Capture entity
   * @returns Digestion job payload
   */
  private createJobPayload(
    capture: CreateDigestionJobInput,
  ): DigestionJobPayload {
    return {
      captureId: capture.captureId,
      userId: capture.userId,
      contentType: this.mapContentType(capture.type),
      priority: this.determinePriority(capture),
      queuedAt: new Date(),
      retryCount: 0,
    };
  }

  /**
   * Map capture type to content type
   *
   * @param captureType - AUDIO or TEXT
   * @returns ContentType for digestion job
   */
  private mapContentType(captureType: 'TEXT' | 'AUDIO'): ContentType {
    switch (captureType) {
      case 'AUDIO':
        return 'audio_transcribed';
      case 'TEXT':
        return 'text';
      default:
        throw new Error(`Unknown capture type: ${captureType}`);
    }
  }

  /**
   * Determine job priority based on capture context
   *
   * User-initiated actions get high priority (AC3)
   * Auto-background processing gets normal priority
   *
   * @param capture - Capture entity
   * @returns Priority level
   */
  private determinePriority(capture: CreateDigestionJobInput): Priority {
    // If explicitly marked as user-initiated, use high priority
    if (capture.userInitiated === true) {
      return 'high';
    }

    // Default to normal priority for auto-background
    return 'normal';
  }
}
