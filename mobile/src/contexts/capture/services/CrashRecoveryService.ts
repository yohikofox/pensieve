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
 * Tech Stack:
 * - Node.js: 22.x
 * - Expo SDK: 54
 * - expo-file-system: 19.x (Modern API - File, Directory, Paths)
 *
 * NFR8: Récupération après crash automatique
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { File, Directory, Paths } from "expo-file-system";
import { TOKENS } from "../../../infrastructure/di/tokens";
import { type ICaptureRepository } from "../domain/ICaptureRepository";
import {
  type ICrashRecoveryService,
  type RecoveredCapture,
  type OrphanedFile,
} from "../domain/ICrashRecoveryService";

/**
 * CrashRecoveryService detects and recovers interrupted recordings
 *
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve<ICrashRecoveryService>(TOKENS.ICrashRecoveryService);
 * const recovered = await service.recoverIncompleteRecordings();
 * if (recovered.length > 0) {
 *   // Notify user
 * }
 * ```
 */
@injectable()
export class CrashRecoveryService implements ICrashRecoveryService {
  constructor(
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository,
  ) {}

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
    const incompleteCaptures = await this.repository.findByState("recording");

    if (incompleteCaptures.length === 0) {
      return results;
    }

    console.log(
      `[CrashRecovery] Found ${incompleteCaptures.length} incomplete recording(s), attempting recovery...`,
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
        state: "captured",
        syncStatus: "pending",
      });

      if (updateResult.type === "success") {
        return {
          captureId,
          state: "recovered",
        };
      } else {
        console.error(
          `[CrashRecovery] Failed to update capture ${captureId}:`,
          updateResult.error,
        );
        return {
          captureId,
          state: "failed",
          reason: updateResult.error ?? "Failed to update capture",
        };
      }
    } else {
      // File doesn't exist - mark as failed
      const updateResult = await this.repository.update(captureId, {
        state: "failed",
        syncStatus: "pending",
      });

      if (updateResult.type !== "success") {
        console.error(
          `[CrashRecovery] Failed to mark capture as failed ${captureId}:`,
          updateResult.error,
        );
      }

      return {
        captureId,
        state: "failed",
        reason: "Audio file not found",
      };
    }
  }

  /**
   * Check if audio file exists on disk
   *
   * Uses modern expo-file-system File API
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    // Empty path = no file
    if (!filePath || filePath.length === 0) {
      return false;
    }

    try {
      const file = new File(filePath);
      const fileInfo = file.info();
      return fileInfo.exists;
    } catch (error) {
      console.error("[CrashRecovery] Error checking file existence:", error);
      return false;
    }
  }

  /**
   * Get count of captures pending recovery
   */
  async getPendingRecoveryCount(): Promise<number> {
    const incompleteCaptures = await this.repository.findByState("recording");
    return incompleteCaptures.length;
  }

  /**
   * Clear all failed captures
   * (Useful for cleanup after user is notified)
   */
  async clearFailedCaptures(): Promise<number> {
    const failedCaptures = await this.repository.findByState("failed");
    let deletedCount = 0;

    for (const capture of failedCaptures) {
      const deleteResult = await this.repository.delete(capture.id);
      if (deleteResult.type === "success") {
        deletedCount++;
      } else {
        console.error(
          `[CrashRecovery] Failed to delete capture ${capture.id}:`,
          deleteResult.error,
        );
      }
    }

    return deletedCount;
  }

  /**
   * Story 2.4 AC4: Detect orphaned audio files
   *
   * Scans audio directory for files without DB records
   * Helps identify files left behind after crashes
   */
  async detectOrphanedFiles(): Promise<OrphanedFile[]> {
    const orphans: OrphanedFile[] = [];

    try {
      // Get audio directory path (using modern API)
      const audioDir = `${Paths.document}/audio/`;
      const audioDirObj = new Directory(audioDir);

      // Read all files in audio directory
      const files = await audioDirObj.list();

      if (files.length === 0) {
        return orphans;
      }

      console.log(
        `[CrashRecovery] Scanning ${files.length} audio files for orphans...`,
      );

      // Get all captures from DB
      const allCaptures = await this.repository.findAll();
      const knownFilePaths = new Set(allCaptures.map((c) => c.rawContent));

      // Check each file
      for (const filename of files) {
        const filePath = `${audioDir}${filename}`;

        // Skip if this file is in DB
        if (knownFilePaths.has(filePath)) {
          continue;
        }

        // File not in DB - it's orphaned
        try {
          const file = new File(filePath);
          const fileInfo = file.info();

          if (fileInfo.exists) {
            orphans.push({
              filePath,
              sizeBytes: fileInfo.size || 0,
              createdAt: new Date(fileInfo.modificationTime || Date.now()),
            });

            console.warn("[CrashRecovery] Orphaned file detected:", filePath);
          }
        } catch (error) {
          console.error(
            "[CrashRecovery] Error checking file:",
            filePath,
            error,
          );
        }
      }

      if (orphans.length > 0) {
        console.warn(
          `[CrashRecovery] Found ${orphans.length} orphaned file(s)`,
        );
      }

      return orphans;
    } catch (error) {
      console.error("[CrashRecovery] Error detecting orphaned files:", error);
      return orphans;
    }
  }

  /**
   * Story 2.4 AC4: Clean up orphaned files
   *
   * Deletes audio files without DB records
   * Logs all deletions for audit trail
   */
  async cleanupOrphanedFiles(): Promise<number> {
    const orphans = await this.detectOrphanedFiles();

    if (orphans.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    console.log(
      `[CrashRecovery] Cleaning up ${orphans.length} orphaned file(s)...`,
    );

    for (const orphan of orphans) {
      try {
        const file = new File(orphan.filePath);
        const fileInfo = file.info();

        // Only delete if file exists (idempotent behavior)
        if (fileInfo.exists) {
          await file.delete();
          deletedCount++;

          console.log("[CrashRecovery] Deleted orphaned file:", {
            path: orphan.filePath,
            size: orphan.sizeBytes,
            createdAt: orphan.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error(
          "[CrashRecovery] Failed to delete orphaned file:",
          orphan.filePath,
          error,
        );
      }
    }

    console.log(
      `[CrashRecovery] Cleanup complete: ${deletedCount}/${orphans.length} files deleted`,
    );

    return deletedCount;
  }
}
