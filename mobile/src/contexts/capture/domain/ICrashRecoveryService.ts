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
  state: 'recovered' | 'failed';
  reason?: string;
}

export interface ICrashRecoveryService {
  /**
   * Detect and recover incomplete recordings
   *
   * Scans database for Captures in "recording" state
   * and attempts to recover them after app crashes
   */
  recoverIncompleteRecordings(): Promise<RecoveredCapture[]>;
}
