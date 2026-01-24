/**
 * IRetentionPolicyService - Domain Interface for Storage Retention Policy
 *
 * Manages automatic cleanup of old audio files while preserving metadata.
 * Ensures compliance with storage retention rules.
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC5: Storage Management with Retention Policy
 *
 * NFR6: Zero data loss - only delete synced audio, never metadata
 */

export interface RetentionConfig {
  /** Number of days to keep audio files (default: 30) */
  audioRetentionDays: number;
  /** Whether auto-cleanup is enabled (default: true) */
  autoCleanupEnabled: boolean;
  /** Whether to notify user before cleanup (default: true) */
  notifyBeforeCleanup: boolean;
}

export interface CleanupCandidate {
  captureId: string;
  filePath: string;
  fileSize: number;
  capturedAt: Date;
  ageInDays: number;
}

export interface CleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  failures: number;
  deletedCaptureIds: string[];
  errors: string[];
}

export interface CleanupPreview {
  eligibleFiles: number;
  totalBytesFreeable: number;
  oldestFileDate: Date | null;
  newestFileDate: Date | null;
  candidates: CleanupCandidate[];
}

export interface IRetentionPolicyService {
  /**
   * Get current retention configuration
   *
   * @returns Current retention policy settings
   */
  getRetentionConfig(): RetentionConfig;

  /**
   * Update retention configuration
   *
   * @param config - New retention settings
   */
  setRetentionConfig(config: Partial<RetentionConfig>): void;

  /**
   * Preview cleanup candidates (files eligible for deletion)
   *
   * Shows what would be deleted without actually deleting
   * Used for "X files will be cleaned up" notification
   *
   * @returns Preview of cleanup operation
   */
  previewCleanup(): Promise<CleanupPreview>;

  /**
   * Execute cleanup of old audio files
   *
   * Deletes audio files older than retention period
   * - Only deletes synced audio files (syncStatus='synced')
   * - Never deletes pending syncs (prevents data loss)
   * - Preserves transcriptions and metadata in DB
   * - Updates Capture records to mark audio as deleted
   *
   * @returns Result of cleanup operation
   */
  executeCleanup(): Promise<CleanupResult>;

  /**
   * Check if cleanup is needed
   *
   * Returns true if there are files eligible for cleanup
   *
   * @returns true if cleanup should run
   */
  shouldRunCleanup(): Promise<boolean>;

  /**
   * Get last cleanup timestamp
   *
   * @returns Date of last cleanup, or null if never run
   */
  getLastCleanupDate(): Promise<Date | null>;

  /**
   * Set last cleanup timestamp
   *
   * @param date - Date of last cleanup
   */
  setLastCleanupDate(date: Date): Promise<void>;

  /**
   * Format bytes to human-readable string
   *
   * Helper for displaying cleanup results to user
   *
   * @param bytes - Bytes to format
   * @returns Human-readable string (e.g., "245 MB")
   */
  formatBytes(bytes: number): string;
}
