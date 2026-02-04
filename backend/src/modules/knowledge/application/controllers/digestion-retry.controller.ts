/**
 * Digestion Retry Controller
 * REST endpoint for manual job retry
 *
 * Covers:
 * - Subtask 5.6: Implement manual retry endpoint for failed jobs
 *
 * AC5: Retry Logic and Error Handling
 */

import { Controller, Post, Param, HttpCode, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../../shared/infrastructure/guards/supabase-auth.guard';
import { DigestionJobPublisher } from '../publishers/digestion-job-publisher.service';
import type { CreateDigestionJobInput } from '../../domain/interfaces/digestion-job-payload.interface';

@Controller('digestion')
@UseGuards(SupabaseAuthGuard)
export class DigestionRetryController {
  private readonly logger = new Logger(DigestionRetryController.name);

  constructor(
    private readonly jobPublisher: DigestionJobPublisher,
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

    // TODO: Fetch Capture from database to get full details
    // For now, we'll create a stub job input
    // In real implementation, this would query CaptureRepository

    const stubCaptureInput: CreateDigestionJobInput = {
      captureId,
      userId: 'unknown', // TODO: Fetch from database
      type: 'TEXT', // TODO: Fetch from database
      state: 'transcribed', // Assuming it's ready for retry
      userInitiated: false, // Manual retry is not user-initiated
    };

    // Publish new job with retryCount reset to 0
    await this.jobPublisher.publishJob(stubCaptureInput);

    this.logger.log(`✅ Retry job published for capture: ${captureId}`);

    return {
      message: 'Digestion job retry has been queued',
      captureId,
    };
  }
}
