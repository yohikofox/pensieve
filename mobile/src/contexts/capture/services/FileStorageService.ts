/**
 * File Storage Service - Manage Audio File Persistence
 *
 * Handles:
 * - Moving audio files from temp to permanent storage
 * - File naming convention: capture_{captureId}_{timestamp}.m4a
 * - Extracting file metadata (size, duration)
 * - File cleanup and deletion
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Task 3: Audio File Storage Management
 *
 * NFR6: Zero data loss tolerance - files must be persisted reliably
 * NFR7: 100% offline availability - local storage only
 */

import * as FileSystem from 'expo-file-system';

export interface FileMetadata {
  size: number; // Bytes
  duration: number; // Milliseconds
  createdAt: Date;
}

export interface StorageResult {
  permanentPath: string;
  metadata: FileMetadata;
}

/**
 * FileStorageService manages permanent audio file storage
 *
 * Usage pattern:
 * ```typescript
 * const service = new FileStorageService();
 *
 * // After recording completes
 * const tempUri = audioRecorder.uri;
 * const result = await service.moveToStorage(tempUri, captureId);
 *
 * // Save to DB
 * await repository.update(captureId, {
 *   rawContent: result.permanentPath,
 *   metadata: result.metadata
 * });
 * ```
 */
export class FileStorageService {
  private readonly AUDIO_DIR = `${FileSystem.documentDirectory}audio/`;

  constructor() {
    this.ensureAudioDirectoryExists();
  }

  /**
   * Ensure audio directory exists
   */
  private async ensureAudioDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.AUDIO_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.AUDIO_DIR, { intermediates: true });
        console.log('[FileStorage] Created audio directory:', this.AUDIO_DIR);
      }
    } catch (error) {
      console.error('[FileStorage] Failed to create audio directory:', error);
      throw new Error('Failed to initialize audio storage');
    }
  }

  /**
   * Generate permanent file path for a capture
   *
   * Format: capture_{captureId}_{timestamp}.m4a
   */
  private generateFilePath(captureId: string): string {
    const timestamp = Date.now();
    const filename = `capture_${captureId}_${timestamp}.m4a`;
    return `${this.AUDIO_DIR}${filename}`;
  }

  /**
   * Move audio file from temporary to permanent storage
   *
   * @param tempUri - Temporary URI from expo-audio
   * @param captureId - Capture entity ID
   * @param durationMillis - Recording duration from expo-audio
   * @returns Permanent path and file metadata
   */
  async moveToStorage(
    tempUri: string,
    captureId: string,
    durationMillis: number
  ): Promise<StorageResult> {
    try {
      // Ensure directory exists
      await this.ensureAudioDirectoryExists();

      // Generate permanent path
      const permanentPath = this.generateFilePath(captureId);

      // Check if temp file exists
      const tempFileInfo = await FileSystem.getInfoAsync(tempUri);
      if (!tempFileInfo.exists) {
        throw new Error(`Temporary file does not exist: ${tempUri}`);
      }

      // Move file to permanent storage
      await FileSystem.moveAsync({
        from: tempUri,
        to: permanentPath,
      });

      console.log(`[FileStorage] Moved file: ${tempUri} → ${permanentPath}`);

      // Get file metadata
      const metadata = await this.getFileMetadata(permanentPath, durationMillis);

      return {
        permanentPath,
        metadata,
      };
    } catch (error) {
      console.error('[FileStorage] Failed to move file to storage:', error);
      throw error;
    }
  }

  /**
   * Get file metadata (size, duration)
   *
   * @param fileUri - File URI (permanent or temp)
   * @param durationMillis - Recording duration from expo-audio
   * @returns File metadata
   */
  async getFileMetadata(fileUri: string, durationMillis: number): Promise<FileMetadata> {
    try {
      // Get file size and modification time
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error(`File does not exist: ${fileUri}`);
      }

      const size = fileInfo.size || 0;
      const createdAt = new Date(fileInfo.modificationTime || Date.now());

      return {
        size,
        duration: durationMillis,
        createdAt,
      };
    } catch (error) {
      console.error('[FileStorage] Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Delete audio file from storage
   *
   * @param permanentPath - Permanent file path
   */
  async deleteFile(permanentPath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(permanentPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(permanentPath);
        console.log(`[FileStorage] Deleted file: ${permanentPath}`);
      }
    } catch (error) {
      console.error(`[FileStorage] Failed to delete file ${permanentPath}:`, error);
      throw error;
    }
  }

  /**
   * Check if file exists
   *
   * @param permanentPath - Permanent file path
   * @returns true if file exists
   */
  async fileExists(permanentPath: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(permanentPath);
      return fileInfo.exists;
    } catch (error) {
      console.error('[FileStorage] Failed to check file existence:', error);
      return false;
    }
  }

  /**
   * Get storage directory path
   */
  getStorageDirectory(): string {
    return this.AUDIO_DIR;
  }
}
