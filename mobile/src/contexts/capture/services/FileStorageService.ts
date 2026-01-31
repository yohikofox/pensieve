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
 * Tech Stack:
 * - Node.js: 22.x
 * - Expo SDK: 54
 * - expo-file-system: 19.x (Modern API - File, Directory, Paths)
 *
 * NFR6: Zero data loss tolerance - files must be persisted reliably
 * NFR7: 100% offline availability - local storage only
 *
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { File, Directory, Paths } from 'expo-file-system';
import {
  type FileStorageResult,
  FileStorageResultType,
  storageSuccess,
  fileNotFound,
  storageError,
} from './FileStorageResult';
import {
  type IFileStorageService,
  type FileMetadata,
  type StorageResult,
} from '../domain/IFileStorageService';

/**
 * FileStorageService manages permanent audio file storage
 *
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve<IFileStorageService>(TOKENS.IFileStorageService);
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
@injectable()
export class FileStorageService implements IFileStorageService {
  private readonly AUDIO_DIR = `${Paths.document.uri}/audio/`;

  constructor() {
    this.ensureAudioDirectoryExists();
  }

  /**
   * Ensure audio directory exists
   *
   * EXCEPTION ALLOWED: Called from constructor.
   * If directory cannot be created, app cannot function - fail fast.
   */
  private async ensureAudioDirectoryExists(): Promise<void> {
    try {
      const audioDir = new Directory(this.AUDIO_DIR);
      const dirInfo = audioDir.info();

      if (!dirInfo.exists) {
        await audioDir.create({ intermediates: true });
        console.log('[FileStorage] Created audio directory:', this.AUDIO_DIR);
      }
    } catch (error) {
      console.error('[FileStorage] Failed to create audio directory:', error);
      // EXCEPTION ALLOWED: Critical initialization failure at app startup
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
   * @returns Result with permanent path and file metadata
   */
  async moveToStorage(
    tempUri: string,
    captureId: string,
    durationMillis: number
  ): Promise<FileStorageResult<StorageResult>> {
    // Ensure directory exists (can throw - documented exception)
    await this.ensureAudioDirectoryExists();

    // Generate permanent path
    const permanentPath = this.generateFilePath(captureId);

    // Check if temp file exists
    const tempFile = new File(tempUri);
    const tempFileInfo = tempFile.info();

    if (!tempFileInfo.exists) {
      return fileNotFound(`Temporary file does not exist: ${tempUri}`);
    }

    // Move file to permanent storage (copy + delete in modern API)
    const permanentFile = new File(permanentPath);
    await tempFile.copy(permanentFile);
    await tempFile.delete();

    console.log(`[FileStorage] Moved file: ${tempUri} → ${permanentPath}`);

    // Get file metadata
    const metadataResult = await this.getFileMetadata(permanentPath, durationMillis);

    if (metadataResult.type !== FileStorageResultType.SUCCESS || !metadataResult.data) {
      return metadataResult as FileStorageResult<StorageResult>;
    }

    return storageSuccess({
      permanentPath,
      metadata: metadataResult.data,
    });
  }

  /**
   * Get file metadata (size, duration)
   *
   * @param fileUri - File URI (permanent or temp)
   * @param durationMillis - Recording duration from expo-audio
   * @returns Result with file metadata
   */
  async getFileMetadata(
    fileUri: string,
    durationMillis: number
  ): Promise<FileStorageResult<FileMetadata>> {
    const file = new File(fileUri);
    const fileInfo = file.info();

    if (!fileInfo.exists) {
      return fileNotFound(`File does not exist: ${fileUri}`);
    }

    const size = fileInfo.size || 0;
    const createdAt = new Date(fileInfo.modificationTime || Date.now());

    return storageSuccess({
      size,
      duration: durationMillis,
      createdAt,
    });
  }

  /**
   * Delete audio file from storage
   *
   * @param permanentPath - Permanent file path
   * @returns Result indicating success or failure
   */
  async deleteFile(permanentPath: string): Promise<FileStorageResult<void>> {
    const file = new File(permanentPath);
    const fileInfo = file.info();

    if (fileInfo.exists) {
      await file.delete();
      console.log(`[FileStorage] Deleted file: ${permanentPath}`);
    }

    return storageSuccess(undefined);
  }

  /**
   * Check if file exists
   *
   * @param permanentPath - Permanent file path
   * @returns true if file exists
   */
  async fileExists(permanentPath: string): Promise<boolean> {
    try {
      const file = new File(permanentPath);
      const fileInfo = file.info();
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
