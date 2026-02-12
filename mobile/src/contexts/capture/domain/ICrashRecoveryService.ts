/**
 * Crash Recovery Service Interface
 *
 * Defines contract for audio capture crash recovery.
 * Handles detection and recovery of interrupted recordings.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

export interface RecoveredCapture {
  captureId: string;
  state: "recovered" | "failed";
  reason?: string;
}

export interface OrphanedFile {
  filePath: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface ICrashRecoveryService {
  /**
   * Detect and recover incomplete recordings
   *
   * Scans database for Captures in "recording" state
   * and attempts to recover them after app crashes
   */
  recoverIncompleteRecordings(): Promise<RecoveredCapture[]>;

  /**
   * Detect orphaned audio files
   *
   * Scans audio directory for files without corresponding DB records
   * Story 2.4 AC4: Crash Recovery with Zero Data Loss
   *
   * @returns Array of orphaned file paths
   */
  detectOrphanedFiles(): Promise<OrphanedFile[]>;

  /**
   * Clean up orphaned files
   *
   * Deletes audio files that have no DB record
   * Logs all deletions for audit trail
   *
   * @returns Count of files deleted
   */
  cleanupOrphanedFiles(): Promise<number>;
}
