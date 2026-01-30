/**
 * Storage Monitor Service - Device Storage Management
 *
 * Handles:
 * - Querying device free/used storage
 * - Calculating total size of capture files
 * - Warning before storage critically low
 * - Preventing captures when out of storage
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC2: Handle Multiple Successive Offline Captures
 *
 * NFR6: Zero data loss - prevent data loss from storage overflow
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { StorageVolume } from 'expo-file-system';
import { database } from '../../../database';
import {
  type IStorageMonitorService,
  type StorageInfo,
  type CaptureStorageStats,
} from '../domain/IStorageMonitorService';

interface CaptureFileSizeRow {
  file_size: number | null;
}

@injectable()
export class StorageMonitorService implements IStorageMonitorService {
  private criticalThresholdBytes: number = 100 * 1024 * 1024; // 100MB default

  /**
   * Get current device storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      // Get free disk space (returns bytes)
      const freeBytes = await StorageVolume.getAvailableSpaceAsync();

      // Note: expo-file-system doesn't provide total storage directly
      // We estimate total = free + used (calculated from captures)
      const captureStats = await this.getCaptureStorageStats();
      const usedBytes = captureStats.totalBytes;

      // Estimate total (this is approximate - real total may be different)
      const totalBytes = freeBytes + usedBytes;

      const freePercentage = totalBytes > 0 ? (freeBytes / totalBytes) * 100 : 0;
      const isCriticallyLow = freeBytes < this.criticalThresholdBytes;

      return {
        totalBytes,
        freeBytes,
        usedBytes,
        freePercentage,
        isCriticallyLow,
        freeFormatted: this.formatBytes(freeBytes),
      };
    } catch (error) {
      console.error('[StorageMonitor] Failed to get storage info:', error);

      // Return safe defaults on error
      return {
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        freePercentage: 0,
        isCriticallyLow: true, // Assume critical on error for safety
        freeFormatted: '0 B',
      };
    }
  }

  /**
   * Check if storage is critically low
   */
  async isStorageCriticallyLow(): Promise<boolean> {
    try {
      const freeBytes = await StorageVolume.getAvailableSpaceAsync();
      return freeBytes < this.criticalThresholdBytes;
    } catch (error) {
      console.error('[StorageMonitor] Failed to check storage:', error);
      return true; // Assume critical on error for safety
    }
  }

  /**
   * Get total size of all capture files
   */
  async getCaptureStorageStats(): Promise<CaptureStorageStats> {
    try {
      // Query all capture file sizes from database
      const result = database.execute(
        'SELECT file_size FROM captures WHERE file_size IS NOT NULL'
      );

      const rows = (result.rows ?? []) as CaptureFileSizeRow[];

      let totalBytes = 0;
      let fileCount = 0;

      for (const row of rows) {
        if (row.file_size !== null) {
          totalBytes += row.file_size;
          fileCount++;
        }
      }

      const averageBytes = fileCount > 0 ? totalBytes / fileCount : 0;

      return {
        totalBytes,
        fileCount,
        averageBytes,
        totalFormatted: this.formatBytes(totalBytes),
      };
    } catch (error) {
      console.error('[StorageMonitor] Failed to get capture storage stats:', error);

      return {
        totalBytes: 0,
        fileCount: 0,
        averageBytes: 0,
        totalFormatted: '0 B',
      };
    }
  }

  /**
   * Check if sufficient storage for new capture
   *
   * Assumes ~5MB per minute of audio (m4a compressed)
   */
  async hasSufficientStorage(estimatedDurationMinutes: number): Promise<boolean> {
    try {
      const freeBytes = await StorageVolume.getAvailableSpaceAsync();

      // Estimate: 5MB per minute for m4a audio
      const estimatedBytes = estimatedDurationMinutes * 5 * 1024 * 1024;

      // Require at least estimated size + critical threshold buffer
      const requiredBytes = estimatedBytes + this.criticalThresholdBytes;

      return freeBytes >= requiredBytes;
    } catch (error) {
      console.error('[StorageMonitor] Failed to check sufficient storage:', error);
      return false; // Assume insufficient on error for safety
    }
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Clamp to valid unit index
    const unitIndex = Math.min(i, units.length - 1);

    const value = bytes / Math.pow(k, unitIndex);
    const formatted = value.toFixed(unitIndex === 0 ? 0 : 1); // No decimals for bytes

    return `${formatted} ${units[unitIndex]}`;
  }

  /**
   * Set critical storage threshold
   */
  setCriticalThreshold(bytes: number): void {
    if (bytes < 0) {
      console.warn('[StorageMonitor] Invalid threshold (negative), using default');
      this.criticalThresholdBytes = 100 * 1024 * 1024;
      return;
    }

    this.criticalThresholdBytes = bytes;
    console.log('[StorageMonitor] Critical threshold set:', this.formatBytes(bytes));
  }

  /**
   * Get current critical threshold
   */
  getCriticalThreshold(): number {
    return this.criticalThresholdBytes;
  }
}
