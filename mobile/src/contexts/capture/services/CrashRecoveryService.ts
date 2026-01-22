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

import * as FileSystem from 'expo-file-system/legacy';
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

    // Find all captures still in "recording" state
    const incompleteCaptures = await this.repository.findByState('recording');

    if (incompleteCaptures.length === 0) {
      return results;
    }

    console.log(
      `[CrashRecovery] Found ${incompleteCaptures.length} incomplete recording(s), attempting recovery...`
    );

    // Process each incomplete capture
    for (const capture of incompleteCaptures) {
      const result = await this.recoverCapture(capture);
      results.push(result);
    }

    return results;
  }

  /**
   * Attempt to recover a single incomplete capture
   */
  private async recoverCapture(capture: any): Promise<RecoveredCapture> {
    const captureId = capture.id;
    const filePath = capture.rawContent;

    // Check if audio file exists
    const fileExists = await this.checkFileExists(filePath);

    if (fileExists) {
      // File exists - mark as recovered
      const updateResult = await this.repository.update(captureId, {
        state: 'captured',
        syncStatus: 'pending',
      });

      if (updateResult.type === 'success') {
        return {
          captureId,
          state: 'recovered',
        };
      } else {
        console.error(`[CrashRecovery] Failed to update capture ${captureId}:`, updateResult.error);
        return {
          captureId,
          state: 'failed',
          reason: updateResult.error ?? 'Failed to update capture',
        };
      }
    } else {
      // File doesn't exist - mark as failed
      const updateResult = await this.repository.update(captureId, {
        state: 'failed',
        syncStatus: 'pending',
      });

      if (updateResult.type !== 'success') {
        console.error(`[CrashRecovery] Failed to mark capture as failed ${captureId}:`, updateResult.error);
      }

      return {
        captureId,
        state: 'failed',
        reason: 'Audio file not found',
      };
    }
  }

  /**
   * Check if audio file exists on disk
   *
   * Uses expo-file-system to verify file existence
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    // Empty path = no file
    if (!filePath || filePath.length === 0) {
      return false;
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.error('[CrashRecovery] Error checking file existence:', error);
      return false;
    }
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
      const deleteResult = await this.repository.delete(capture.id);
      if (deleteResult.type === 'success') {
        deletedCount++;
      } else {
        console.error(
          `[CrashRecovery] Failed to delete capture ${capture.id}:`,
          deleteResult.error
        );
      }
    }

    return deletedCount;
  }
}
