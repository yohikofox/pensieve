/**
 * Crash Recovery Service - Audio Capture Recovery
 *
 * Handles recovery of interrupted recordings after app crashes
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC4: Crash Recovery
 * - Detect incomplete recordings on app launch
 * - Attempt recovery of partial audio files
 * - Notify user of recovered captures
 *
 * NFR8: Récupération après crash automatique
 */

import { CaptureRepository } from '../data/CaptureRepository';

export interface RecoveredCapture {
  captureId: string;
  state: 'recovered' | 'failed';
  reason?: string;
}

/**
 * CrashRecoveryService detects and recovers interrupted recordings
 *
 * Usage pattern:
 * ```typescript
 * const service = new CrashRecoveryService(repository);
 * const recovered = await service.recoverIncompleteRecordings();
 * if (recovered.length > 0) {
 *   // Notify user
 * }
 * ```
 */
export class CrashRecoveryService {
  private repository: CaptureRepository;

  constructor(repository: CaptureRepository) {
    this.repository = repository;
  }

  /**
   * AC4: Detect and recover incomplete recordings
   *
   * Scans database for Captures in "recording" state (interrupted by crash)
   * and attempts to recover them
   *
   * @returns Array of recovered captures with their recovery status
   */
  async recoverIncompleteRecordings(): Promise<RecoveredCapture[]> {
    const results: RecoveredCapture[] = [];

    try {
      // Find all captures still in "recording" state
      const incompleteCaptures = await this.repository.findByState('recording');

      if (incompleteCaptures.length === 0) {
        return results;
      }

      console.log(
        `[CrashRecovery] Found ${incompleteCaptures.length} incomplete recording(s)`
      );

      // Process each incomplete capture
      for (const capture of incompleteCaptures) {
        try {
          const result = await this.recoverCapture(capture);
          results.push(result);
        } catch (error) {
          console.error(
            `[CrashRecovery] Failed to recover capture ${capture.id}:`,
            error
          );
          results.push({
            captureId: capture.id,
            state: 'failed',
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[CrashRecovery] Recovery scan failed:', error);
      return results;
    }
  }

  /**
   * Attempt to recover a single incomplete capture
   */
  private async recoverCapture(capture: any): Promise<RecoveredCapture> {
    const captureId = capture.id;
    const filePath = capture._raw.raw_content;

    // Check if audio file exists
    const fileExists = await this.checkFileExists(filePath);

    if (fileExists) {
      // File exists - mark as recovered
      await this.repository.update(captureId, {
        state: 'captured',
        syncStatus: 'pending',
      });

      console.log(`[CrashRecovery] Successfully recovered capture ${captureId}`);

      return {
        captureId,
        state: 'recovered',
      };
    } else {
      // File doesn't exist - mark as failed
      await this.repository.update(captureId, {
        state: 'failed',
        syncStatus: 'pending',
      });

      console.log(
        `[CrashRecovery] Failed to recover capture ${captureId}: file not found`
      );

      return {
        captureId,
        state: 'failed',
        reason: 'Audio file not found',
      };
    }
  }

  /**
   * Check if audio file exists
   *
   * TODO: Implement actual file system check using expo-file-system
   * For now, assume file exists if path is not empty
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    // Simple check: if path is not empty, assume file exists
    // In production, use expo-file-system's getInfoAsync()
    return filePath && filePath.length > 0;
  }

  /**
   * Get count of captures pending recovery
   */
  async getPendingRecoveryCount(): Promise<number> {
    const incompleteCaptures = await this.repository.findByState('recording');
    return incompleteCaptures.length;
  }

  /**
   * Clear all failed captures
   * (Useful for cleanup after user is notified)
   */
  async clearFailedCaptures(): Promise<number> {
    const failedCaptures = await this.repository.findByState('failed');
    let deletedCount = 0;

    for (const capture of failedCaptures) {
      try {
        await this.repository.delete(capture.id);
        deletedCount++;
      } catch (error) {
        console.error(
          `[CrashRecovery] Failed to delete capture ${capture.id}:`,
          error
        );
      }
    }

    return deletedCount;
  }
}
