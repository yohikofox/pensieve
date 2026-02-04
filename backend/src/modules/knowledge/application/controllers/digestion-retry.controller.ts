/**
 * Digestion Retry Controller
 * REST endpoint for manual job retry
 *
 * Covers:
 * - Subtask 5.6: Implement manual retry endpoint for failed jobs
 *
 * AC5: Retry Logic and Error Handling
 */

import { Controller, Post, Param, HttpCode, HttpStatus, Logger, UseGuards, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { DigestionJobPublisher } from '../publishers/digestion-job-publisher.service';
import type { ICaptureRepository } from '../../domain/interfaces/capture-repository.interface';
import type { CreateDigestionJobInput } from '../../domain/interfaces/digestion-job-payload.interface';

@Controller('digestion')
@UseGuards(SupabaseAuthGuard)
export class DigestionRetryController {
  private readonly logger = new Logger(DigestionRetryController.name);

  constructor(
    private readonly jobPublisher: DigestionJobPublisher,
    @Inject('CAPTURE_REPOSITORY')
    private readonly captureRepository: ICaptureRepository,
  ) {}

  /**
   * Manual retry endpoint for failed digestion jobs
   * POST /digestion/:captureId/retry
   *
   * Use case: Admin or automated process retries failed job after investigation
   *
   * @param captureId - Capture ID to retry
   * @returns Success confirmation
   */
  @Post(':captureId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryDigestionJob(
    @Param('captureId') captureId: string,
  ): Promise<{ message: string; captureId: string }> {
    this.logger.log(`🔄 Manual retry requested for capture: ${captureId}`);

    // Fetch Capture from repository to get full details
    const capture = await this.captureRepository.findById(captureId);

    if (!capture) {
      throw new NotFoundException(`Capture not found: ${captureId}`);
    }

    const captureInput: CreateDigestionJobInput = {
      captureId: capture.id,
      userId: capture.userId,
      type: capture.type,
      state: capture.status as 'transcribed', // Assume ready for retry
      userInitiated: false, // Manual retry is not user-initiated
    };

    // Publish new job with retryCount reset to 0
    await this.jobPublisher.publishJob(captureInput);

    this.logger.log(`✅ Retry job published for capture: ${captureId}`);

    return {
      message: 'Digestion job retry has been queued',
      captureId,
    };
  }
}
