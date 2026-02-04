/**
 * Capture Repository Stub Implementation
 * Temporary implementation until Capture Context is integrated
 *
 * Story 4.1: This stub logs status updates but doesn't persist to DB
 * TODO: Replace with real CaptureRepository from Capture Context
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ICaptureRepository,
  CaptureDigestionStatus,
  CaptureStatusMetadata,
  CaptureBasicInfo,
} from '../../domain/interfaces/capture-repository.interface';

@Injectable()
export class CaptureRepositoryStub implements ICaptureRepository {
  private readonly logger = new Logger(CaptureRepositoryStub.name);

  async updateStatus(
    captureId: string,
    status: CaptureDigestionStatus,
    metadata?: CaptureStatusMetadata,
  ): Promise<void> {
    this.logger.warn(
      `[STUB] Capture status update requested but not persisted to DB`,
      {
        captureId,
        status,
        metadata,
        note: 'TODO: Integrate with real Capture Context',
      },
    );

    // TODO: When Capture Context is available:
    // await this.captureRepository.updateStatus(captureId, status, metadata);
  }

  async findById(captureId: string): Promise<CaptureBasicInfo | null> {
    this.logger.warn(
      `[STUB] Capture lookup requested but returning mock data`,
      {
        captureId,
        note: 'TODO: Integrate with real Capture Context',
      },
    );

    // TODO: When Capture Context is available:
    // return await this.captureRepository.findById(captureId);

    // Return mock data for now
    return {
      id: captureId,
      userId: 'stub-user-id',
      type: 'AUDIO',
      status: 'transcribed',
    };
  }
}
