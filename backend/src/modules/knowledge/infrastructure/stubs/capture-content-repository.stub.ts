/**
 * Capture Content Repository Stub
 * Temporary implementation until Capture Context is integrated
 *
 * Story 4.2 Task 3: Content extraction stub for testing
 * TODO: Replace with real implementation from Capture Context
 */

import { Injectable, Logger } from '@nestjs/common';
import { ICaptureContentRepository } from '../../domain/interfaces/capture-content-repository.interface';

@Injectable()
export class CaptureContentRepositoryStub implements ICaptureContentRepository {
  private readonly logger = new Logger(CaptureContentRepositoryStub.name);

  async getContent(captureId: string): Promise<string | null> {
    this.logger.warn(
      `[STUB] Content lookup requested but returning mock data`,
      {
        captureId,
        note: 'TODO: Integrate with real Capture Context',
      },
    );

    // Return mock text content for testing
    return `Mock text content for capture ${captureId}. This is a sample thought that would normally come from the database.`;
  }

  async getTranscription(captureId: string): Promise<string | null> {
    this.logger.warn(
      `[STUB] Transcription lookup requested but returning mock data`,
      {
        captureId,
        note: 'TODO: Integrate with real Capture Context',
      },
    );

    // Return mock transcription for testing
    return `Mock transcription for audio capture ${captureId}. This would normally be the Whisper-generated transcription from the database.`;
  }

  async getType(captureId: string): Promise<'TEXT' | 'AUDIO'> {
    this.logger.warn(`[STUB] Type lookup requested but returning mock data`, {
      captureId,
      note: 'TODO: Integrate with real Capture Context',
    });

    // Return TEXT by default for testing
    // Real implementation would query database
    return 'TEXT';
  }
}
