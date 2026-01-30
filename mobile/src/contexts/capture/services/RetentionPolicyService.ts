/**
 * Retention Policy Service - Automatic Storage Cleanup
 *
 * Manages automatic cleanup of old audio files based on retention policy.
 * Preserves metadata and transcriptions while freeing storage space.
 *
 * Story: 2.4 - Stockage Offline des Captures
 * AC5: Storage Management with Retention Policy
 *
 * NFR6: Zero data loss - only delete synced audio, never pending syncs
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { type ICaptureRepository } from '../domain/ICaptureRepository';
import { type IFileSystem } from '../domain/IFileSystem';
import { RepositoryResultType } from '../domain/Result';
import {
  type IRetentionPolicyService,
  type RetentionConfig,
  type CleanupCandidate,
  type CleanupResult,
  type CleanupPreview,
} from '../domain/IRetentionPolicyService';

const STORAGE_KEY_LAST_CLEANUP = '@pensieve_last_cleanup_date';
const STORAGE_KEY_RETENTION_CONFIG = '@pensieve_retention_config';

const DEFAULT_CONFIG: RetentionConfig = {
  audioRetentionDays: 30,
  autoCleanupEnabled: true,
  notifyBeforeCleanup: true,
};

/**
 * RetentionPolicyService manages automatic cleanup of old audio files
 *
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve<IRetentionPolicyService>(TOKENS.IRetentionPolicyService);
 * const preview = await service.previewCleanup();
 * if (preview.eligibleFiles > 0) {
 *   // Notify user, then execute
 *   await service.executeCleanup();
 * }
 * ```
 */
@injectable()
export class RetentionPolicyService implements IRetentionPolicyService {
  private config: RetentionConfig = DEFAULT_CONFIG;

  constructor(
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository,
    @inject(TOKENS.IFileSystem) private fileSystem: IFileSystem
  ) {
    // Load config from AsyncStorage on initialization
    this.loadConfig();
  }

  /**
   * Load retention config from AsyncStorage
   */
  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_RETENTION_CONFIG);
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('[RetentionPolicy] Failed to load config:', error);
      this.config = DEFAULT_CONFIG;
    }
  }

  /**
   * Save retention config to AsyncStorage
   */
  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_RETENTION_CONFIG, JSON.stringify(this.config));
    } catch (error) {
      console.error('[RetentionPolicy] Failed to save config:', error);
    }
  }

  /**
   * Get current retention configuration
   */
  getRetentionConfig(): RetentionConfig {
    return { ...this.config };
  }

  /**
   * Update retention configuration
   */
  setRetentionConfig(config: Partial<RetentionConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    console.log('[RetentionPolicy] Config updated:', this.config);
  }

  /**
   * AC5: Preview cleanup candidates
   *
   * Shows what would be deleted without actually deleting
   */
  async previewCleanup(): Promise<CleanupPreview> {
    const candidates = await this.findCleanupCandidates();

    if (candidates.length === 0) {
      return {
        eligibleFiles: 0,
        totalBytesFreeable: 0,
        oldestFileDate: null,
        newestFileDate: null,
        candidates: [],
      };
    }

    const totalBytesFreeable = candidates.reduce((sum, c) => sum + c.fileSize, 0);
    const dates = candidates.map((c) => c.capturedAt.getTime());
    const oldestFileDate = new Date(Math.min(...dates));
    const newestFileDate = new Date(Math.max(...dates));

    return {
      eligibleFiles: candidates.length,
      totalBytesFreeable,
      oldestFileDate,
      newestFileDate,
      candidates,
    };
  }

  /**
   * AC5: Execute cleanup of old audio files
   *
   * Deletes audio files older than retention period
   * - Only deletes synced audio (syncStatus='synced')
   * - Never deletes pending syncs
   * - Preserves metadata and transcriptions
   */
  async executeCleanup(): Promise<CleanupResult> {
    const candidates = await this.findCleanupCandidates();

    if (candidates.length === 0) {
      console.log('[RetentionPolicy] No files eligible for cleanup');
      // Still update last cleanup date even if no files to clean
      await this.setLastCleanupDate(new Date());
      return {
        filesDeleted: 0,
        bytesFreed: 0,
        failures: 0,
        deletedCaptureIds: [],
        errors: [],
      };
    }

    console.log(`[RetentionPolicy] Starting cleanup of ${candidates.length} file(s)...`);

    let filesDeleted = 0;
    let bytesFreed = 0;
    let failures = 0;
    const deletedCaptureIds: string[] = [];
    const errors: string[] = [];

    for (const candidate of candidates) {
      try {
        // Delete audio file from filesystem (using injected IFileSystem)
        if (this.fileSystem.deleteFile) {
          const deleteResult = await this.fileSystem.deleteFile(candidate.filePath);

          if (deleteResult.type !== RepositoryResultType.SUCCESS) {
            console.warn('[RetentionPolicy] File deletion warning (non-critical):', deleteResult.error);
            // Continue with DB update even if file deletion failed
          }
        }

        // Update Capture record to mark audio as deleted
        const updateResult = await this.repository.update(candidate.captureId, {
          rawContent: '', // Clear file path
          fileSize: null, // Clear file size
        });

        if (updateResult.type === 'success') {
          filesDeleted++;
          bytesFreed += candidate.fileSize;
          deletedCaptureIds.push(candidate.captureId);

          console.log('[RetentionPolicy] Deleted audio file:', {
            captureId: candidate.captureId,
            size: this.formatBytes(candidate.fileSize),
            age: `${candidate.ageInDays} days`,
          });
        } else {
          failures++;
          const errorMsg = `Failed to update DB for ${candidate.captureId}: ${updateResult.error}`;
          errors.push(errorMsg);
          console.error('[RetentionPolicy]', errorMsg);
        }
      } catch (error) {
        failures++;
        const errorMsg = `Failed to delete file for ${candidate.captureId}: ${error}`;
        errors.push(errorMsg);
        console.error('[RetentionPolicy]', errorMsg);
      }
    }

    // Update last cleanup date
    await this.setLastCleanupDate(new Date());

    console.log('[RetentionPolicy] Cleanup complete:', {
      filesDeleted,
      bytesFreed: this.formatBytes(bytesFreed),
      failures,
    });

    return {
      filesDeleted,
      bytesFreed,
      failures,
      deletedCaptureIds,
      errors,
    };
  }

  /**
   * Find all audio files eligible for cleanup
   *
   * Criteria:
   * - syncStatus = 'synced' (never delete pending syncs)
   * - capturedAt older than retention period
   * - rawContent not empty (has audio file)
   * - fileSize > 0
   */
  private async findCleanupCandidates(): Promise<CleanupCandidate[]> {
    const candidates: CleanupCandidate[] = [];

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.audioRetentionDays);
    const cutoffTimestamp = cutoffDate.getTime();

    console.log('[RetentionPolicy] Finding cleanup candidates older than:', cutoffDate.toISOString());

    // Get all synced captures (not in sync queue)
    const syncedCaptures = await this.repository.findSynced();

    for (const capture of syncedCaptures) {
      // Check age
      const capturedAt = new Date(capture.capturedAt);
      if (capturedAt.getTime() >= cutoffTimestamp) {
        continue; // Too recent
      }

      // Check has audio file
      if (!capture.rawContent || capture.rawContent.length === 0) {
        continue; // No audio file
      }

      // Check file size
      const fileSize = capture.fileSize || 0;
      if (fileSize === 0) {
        continue; // No file size
      }

      // Calculate age in days
      const ageInMs = Date.now() - capturedAt.getTime();
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

      candidates.push({
        captureId: capture.id,
        filePath: capture.rawContent,
        fileSize,
        capturedAt,
        ageInDays,
      });
    }

    console.log(`[RetentionPolicy] Found ${candidates.length} cleanup candidate(s)`);

    return candidates;
  }

  /**
   * Check if cleanup is needed
   */
  async shouldRunCleanup(): Promise<boolean> {
    if (!this.config.autoCleanupEnabled) {
      return false;
    }

    const candidates = await this.findCleanupCandidates();
    return candidates.length > 0;
  }

  /**
   * Get last cleanup timestamp
   */
  async getLastCleanupDate(): Promise<Date | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_LAST_CLEANUP);
      return stored ? new Date(stored) : null;
    } catch (error) {
      console.error('[RetentionPolicy] Failed to get last cleanup date:', error);
      return null;
    }
  }

  /**
   * Set last cleanup timestamp
   */
  async setLastCleanupDate(date: Date): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_LAST_CLEANUP, date.toISOString());
    } catch (error) {
      console.error('[RetentionPolicy] Failed to set last cleanup date:', error);
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
    const formatted = value.toFixed(unitIndex === 0 ? 0 : 1);

    return `${formatted} ${units[unitIndex]}`;
  }
}
