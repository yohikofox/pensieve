/**
 * File Storage Service Interface
 *
 * Defines contract for audio file persistence management.
 * Handles moving files from temp to permanent storage,
 * metadata extraction, and file cleanup.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import { type FileStorageResult } from "../services/FileStorageResult";

export interface FileMetadata {
  size: number; // Bytes
  duration: number; // Milliseconds
  createdAt: Date;
}

export interface StorageResult {
  permanentPath: string;
  metadata: FileMetadata;
}

export interface IFileStorageService {
  /**
   * Move audio file from temporary to permanent storage
   */
  moveToStorage(
    tempUri: string,
    captureId: string,
    durationMillis: number,
  ): Promise<FileStorageResult<StorageResult>>;

  /**
   * Get file metadata (size, duration)
   */
  getFileMetadata(
    fileUri: string,
    durationMillis: number,
  ): Promise<FileStorageResult<FileMetadata>>;

  /**
   * Delete audio file from storage
   */
  deleteFile(permanentPath: string): Promise<FileStorageResult<void>>;

  /**
   * Check if file exists
   */
  fileExists(permanentPath: string): Promise<boolean>;

  /**
   * Get storage directory path
   */
  getStorageDirectory(): string;
}
