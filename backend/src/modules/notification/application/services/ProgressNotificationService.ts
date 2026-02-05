/**
 * Progress Notification Service
 * Enhances ProgressTracker from Story 4.1 with notification hooks
 *
 * Story 4.4: Notifications de Progression IA
 * Task 2: Progress Tracking Service Enhancement
 *
 * Covers:
 * - Subtask 2.1: Enhance ProgressTracker with notification hooks
 * - Subtask 2.2: Add queue position estimation logic (AC1)
 * - Subtask 2.3: Implement elapsed time tracking for "Still processing..." (AC2)
 * - Subtask 2.4: Add multi-capture progress aggregation (AC6)
 *
 * This service:
 * - Listens to ProgressTracker updates
 * - Emits ProgressUpdate domain events
 * - Estimates queue position and remaining time
 * - Triggers "Still processing..." after 10s (AC2)
 * - Triggers timeout warning after 30s (AC9)
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProgressTrackerService } from '../../../knowledge/application/services/progress-tracker.service';
import { ProgressUpdate } from '../../domain/events/ProgressUpdate.event';
import { TimeoutWarning } from '../../domain/events/TimeoutWarning.event';

@Injectable()
export class ProgressNotificationService {
  private readonly logger = new Logger(ProgressNotificationService.name);
  private readonly STILL_PROCESSING_THRESHOLD = 10000; // 10 seconds
  private readonly TIMEOUT_WARNING_THRESHOLD = 30000; // 30 seconds
  private readonly PROGRESS_UPDATE_INTERVAL = 5000; // 5 seconds

  // Track last notification times to avoid spam
  private lastStillProcessingNotification = new Map<string, number>();
  private lastTimeoutWarning = new Map<string, number>();

  constructor(
    private readonly progressTracker: ProgressTrackerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Start tracking progress with notification hooks
   * AC1: Queue Status Notification
   */
  async startTrackingWithNotifications(
    captureId: string,
    userId: string,
    queuePosition?: number,
  ): Promise<void> {
    // Start tracking in ProgressTracker
    await this.progressTracker.startTracking(captureId, userId);

    // Emit queued event
    const event = new ProgressUpdate(
      captureId,
      userId,
      'queued',
      0, // just queued, 0ms elapsed
      queuePosition,
      this.estimateRemainingTime(queuePosition),
    );

    this.eventEmitter.emit('progress.update', event);
    this.logger.debug(`📊 Progress tracking started: ${captureId} (queue position: ${queuePosition})`);
  }

  /**
   * Update progress with periodic notifications
   * AC2: Active Processing Indicator
   * AC6: Multi-Capture Progress Tracking
   */
  async updateProgressWithNotifications(
    captureId: string,
    userId: string,
    percentage: number,
  ): Promise<void> {
    // Update progress in ProgressTracker
    await this.progressTracker.updateProgress(captureId, percentage);

    // Get current progress to calculate elapsed time
    const progress = await this.progressTracker.getProgress(captureId);
    if (!progress) {
      this.logger.warn(`⚠️  Progress not found for captureId: ${captureId}`);
      return;
    }

    const elapsed = Date.now() - progress.startedAt.getTime();

    // Emit progress update event
    const event = new ProgressUpdate(
      captureId,
      userId,
      'processing',
      elapsed,
      undefined, // no queue position when processing
      this.estimateRemainingTime(undefined, elapsed, percentage),
    );

    this.eventEmitter.emit('progress.update', event);

    // Check if "Still processing..." notification should be sent
    await this.checkStillProcessingNotification(captureId, userId, elapsed);

    // Check if timeout warning should be sent
    await this.checkTimeoutWarning(captureId, userId, elapsed);

    this.logger.debug(`📈 Progress updated: ${captureId} - ${percentage}% (elapsed: ${elapsed}ms)`);
  }

  /**
   * Complete tracking with final notification
   * AC3: Completion Notification (handled by DigestionCompleted event listener)
   */
  async completeTrackingWithNotifications(
    captureId: string,
    userId: string,
  ): Promise<void> {
    // Complete tracking in ProgressTracker
    await this.progressTracker.completeTracking(captureId);

    // Get final progress stats
    const progress = await this.progressTracker.getProgress(captureId);
    const elapsed = progress?.durationMs || 0;

    // Emit completed event
    const event = new ProgressUpdate(captureId, userId, 'completed', elapsed);

    this.eventEmitter.emit('progress.update', event);

    // Clean up tracking maps
    this.lastStillProcessingNotification.delete(captureId);
    this.lastTimeoutWarning.delete(captureId);

    this.logger.log(`✅ Progress tracking completed: ${captureId} (duration: ${elapsed}ms)`);
  }

  /**
   * Fail tracking with error notification
   * AC5: Failure Notification (handled by DigestionFailed event listener)
   */
  async failTrackingWithNotifications(
    captureId: string,
    userId: string,
    errorMessage: string,
  ): Promise<void> {
    // Fail tracking in ProgressTracker
    await this.progressTracker.failTracking(captureId, errorMessage);

    // Get progress stats
    const progress = await this.progressTracker.getProgress(captureId);
    const elapsed = progress?.durationMs || 0;

    // Emit failed event
    const event = new ProgressUpdate(captureId, userId, 'failed', elapsed);

    this.eventEmitter.emit('progress.update', event);

    // Clean up tracking maps
    this.lastStillProcessingNotification.delete(captureId);
    this.lastTimeoutWarning.delete(captureId);

    this.logger.error(`❌ Progress tracking failed: ${captureId} - ${errorMessage}`);
  }

  /**
   * Get all active jobs for user
   * AC6: Multi-Capture Progress Tracking
   */
  async getUserActiveJobs(userId: string) {
    return await this.progressTracker.getUserActiveJobs(userId);
  }

  /**
   * Estimate remaining time based on queue position or progress
   * Subtask 2.2: Add queue position estimation logic
   */
  private estimateRemainingTime(
    queuePosition?: number,
    elapsed?: number,
    percentage?: number,
  ): number | undefined {
    // If in queue, estimate based on position
    if (queuePosition !== undefined) {
      // Assumption: each job takes ~20s average (NFR3 target < 30s)
      const avgJobDuration = 20000;
      return queuePosition * avgJobDuration;
    }

    // If processing, estimate based on current progress
    if (elapsed !== undefined && percentage !== undefined && percentage > 0) {
      const estimatedTotalTime = (elapsed / percentage) * 100;
      return Math.max(0, estimatedTotalTime - elapsed);
    }

    return undefined;
  }

  /**
   * Check if "Still processing..." notification should be sent
   * AC2: Still processing notification after 10s
   */
  private async checkStillProcessingNotification(
    captureId: string,
    userId: string,
    elapsed: number,
  ): Promise<void> {
    if (elapsed < this.STILL_PROCESSING_THRESHOLD) {
      return;
    }

    const lastNotification = this.lastStillProcessingNotification.get(captureId) || 0;
    const timeSinceLastNotification = Date.now() - lastNotification;

    // Send notification every 10 seconds after initial threshold
    if (timeSinceLastNotification >= 10000) {
      const event = new ProgressUpdate(captureId, userId, 'processing', elapsed);
      this.eventEmitter.emit('progress.still-processing', event);
      this.lastStillProcessingNotification.set(captureId, Date.now());
      this.logger.debug(`⏳ Still processing notification: ${captureId} (elapsed: ${elapsed}ms)`);
    }
  }

  /**
   * Check if timeout warning should be sent
   * AC9: Timeout Warning Notification
   */
  private async checkTimeoutWarning(
    captureId: string,
    userId: string,
    elapsed: number,
  ): Promise<void> {
    if (elapsed < this.TIMEOUT_WARNING_THRESHOLD) {
      return;
    }

    // Only send one timeout warning per job
    if (this.lastTimeoutWarning.has(captureId)) {
      return;
    }

    const warning = new TimeoutWarning(captureId, userId, elapsed, this.TIMEOUT_WARNING_THRESHOLD);
    this.eventEmitter.emit('progress.timeout-warning', warning);
    this.lastTimeoutWarning.set(captureId, Date.now());

    this.logger.warn(`⚠️  Timeout warning: ${captureId} (elapsed: ${elapsed}ms)`);
  }
}
