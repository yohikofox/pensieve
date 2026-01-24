/**
 * IStorageMonitorService - Domain Interface for Storage Monitoring
 *
 * Monitors device storage space and prevents out-of-storage scenarios.
 * Calculates capture file sizes and warns before critical low storage.
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC2: Handle Multiple Successive Offline Captures
 *
 * NFR6: Zero data loss - prevent captures when storage insufficient
 */

export interface StorageInfo {
  /** Total device storage in bytes */
  totalBytes: number;
  /** Free/available storage in bytes */
  freeBytes: number;
  /** Used storage in bytes */
  usedBytes: number;
  /** Free storage as percentage (0-100) */
  freePercentage: number;
  /** Is storage critically low? (< threshold) */
  isCriticallyLow: boolean;
  /** Human-readable free space (e.g., "1.5 GB") */
  freeFormatted: string;
}

export interface CaptureStorageStats {
  /** Total size of all capture audio files in bytes */
  totalBytes: number;
  /** Number of capture files */
  fileCount: number;
  /** Average file size in bytes */
  averageBytes: number;
  /** Human-readable total size (e.g., "245 MB") */
  totalFormatted: string;
}

export interface IStorageMonitorService {
  /**
   * Get current device storage information
   *
   * @returns Storage info with free space and critical status
   */
  getStorageInfo(): Promise<StorageInfo>;

  /**
   * Check if storage is critically low
   *
   * Critical threshold: < 100MB free space
   *
   * @returns true if storage is critically low
   */
  isStorageCriticallyLow(): Promise<boolean>;

  /**
   * Get total size of all capture files
   *
   * Calculates total bytes used by audio files
   *
   * @returns Capture storage statistics
   */
  getCaptureStorageStats(): Promise<CaptureStorageStats>;

  /**
   * Check if sufficient storage for new capture
   *
   * Estimates if there's enough space for a new audio recording
   * (assumes ~5MB per minute of audio)
   *
   * @param estimatedDurationMinutes - Estimated recording duration
   * @returns true if sufficient storage available
   */
  hasSufficientStorage(estimatedDurationMinutes: number): Promise<boolean>;

  /**
   * Format bytes to human-readable string
   *
   * Examples: "1.5 GB", "245 MB", "12.3 KB"
   *
   * @param bytes - Bytes to format
   * @returns Human-readable string
   */
  formatBytes(bytes: number): string;

  /**
   * Set critical storage threshold
   *
   * Default: 100MB (100 * 1024 * 1024 bytes)
   *
   * @param bytes - Threshold in bytes
   */
  setCriticalThreshold(bytes: number): void;

  /**
   * Get current critical threshold
   *
   * @returns Threshold in bytes
   */
  getCriticalThreshold(): number;
}
