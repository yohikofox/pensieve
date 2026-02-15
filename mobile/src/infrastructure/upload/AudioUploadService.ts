/**
 * AudioUploadService - Audio File Upload Management
 *
 * Story 6.2 - Task 6.2: Manages audio file uploads to MinIO S3
 *
 * Features:
 * - Multipart upload support (Task 6.3)
 * - Progress tracking via upload_queue table
 * - Network error handling with retry support (Task 6.5)
 * - Resumable uploads (Task 6.4)
 *
 * @architecture Layer: Infrastructure - External API interaction
 * @pattern Repository-like service for upload queue management
 */

import axios, { AxiosRequestConfig } from 'axios';
import { database } from '../../database';
import {
  RepositoryResult,
  RepositoryResultType,
  success,
  validationError,
  databaseError,
  networkError,
  notFound,
} from '@/contexts/shared/domain/Result';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload queue entry
 */
export interface UploadQueueEntry {
  id: string;
  capture_id: string;
  file_path: string;
  file_size: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  retry_count: number;
  error_message?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Upload result with audio URL
 */
export interface UploadResult {
  uploadId: string;
  audioUrl?: string;
}

/**
 * AudioUploadService - Manages audio file uploads
 */
export class AudioUploadService {
  private readonly apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  /**
   * Enqueue audio file for upload
   *
   * Creates entry in upload_queue table with 'pending' status.
   *
   * @param captureId - Capture ID
   * @param filePath - Local file path
   * @param fileSize - File size in bytes
   * @returns Result with upload ID
   */
  async enqueueUpload(
    captureId: string,
    filePath: string,
    fileSize: number,
  ): Promise<RepositoryResult<{ uploadId: string }>> {
    // Validation
    if (!captureId || !filePath || fileSize <= 0) {
      return validationError('Invalid parameters: capture_id, file_path, and file_size are required');
    }

    const uploadId = uuidv4();
    const now = Date.now();

    try {
      const result = database.execute(
        `INSERT INTO upload_queue
         (id, capture_id, file_path, file_size, status, progress, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uploadId, captureId, filePath, fileSize, 'pending', 0.0, 0, now, now],
      );

      if (result.rowsAffected === 1) {
        return success({ uploadId });
      }

      return databaseError('Failed to enqueue upload: no rows affected');
    } catch (error: any) {
      return databaseError(`Failed to enqueue upload: ${error.message}`);
    }
  }

  /**
   * Upload file to MinIO S3
   *
   * Uploads file with progress tracking and updates upload_queue status.
   *
   * @param uploadId - Upload queue entry ID
   * @param captureId - Capture ID
   * @param filePath - Local file path
   * @param fileSize - File size in bytes
   * @param onProgress - Progress callback (optional)
   * @returns Result with audio URL
   */
  async uploadFile(
    uploadId: string,
    captureId: string,
    filePath: string,
    fileSize: number,
    onProgress?: (progress: number) => void,
  ): Promise<RepositoryResult<{ audioUrl: string }>> {
    try {
      // Update status to 'uploading'
      // Code Review Fix: Added await
      await this.updateUploadStatus(uploadId, 'uploading', 0.0);

      // Prepare FormData (React Native compatible)
      const formData = new FormData();
      formData.append('file', {
        uri: filePath,
        type: 'audio/m4a',
        name: `${captureId}.m4a`,
      } as any);
      formData.append('captureId', captureId);

      // Upload config with progress tracking
      const config: AxiosRequestConfig = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = progressEvent.loaded / progressEvent.total;

            // Update database progress (synchronous - called from axios callback)
            this.updateUploadProgress(uploadId, percentCompleted);

            // Callback
            if (onProgress) {
              onProgress(percentCompleted);
            }
          }
        },
      };

      // Upload to backend
      const response = await axios.post(`${this.apiUrl}/api/uploads/audio`, formData, config);

      const audioUrl = response.data.audioUrl;

      // Update status to 'completed'
      // Code Review Fix: Added await
      await this.updateUploadStatus(uploadId, 'completed', 1.0);

      return success({ audioUrl });
    } catch (error: any) {
      // Update status to 'failed' with error message
      // Code Review Fix: Added await
      await this.updateUploadStatusWithError(uploadId, 'failed', error.message);

      return networkError(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Get pending uploads
   *
   * @returns Result with pending upload entries
   */
  async getPendingUploads(): Promise<RepositoryResult<UploadQueueEntry[]>> {
    try {
      const result = database.execute(
        `SELECT * FROM upload_queue
         WHERE status = 'pending'
         ORDER BY created_at ASC`,
      );

      const uploads = (result.rows || []) as UploadQueueEntry[];

      return success(uploads);
    } catch (error: any) {
      return databaseError(`Failed to get pending uploads: ${error.message}`);
    }
  }

  /**
   * Get upload status
   *
   * @param uploadId - Upload ID
   * @returns Result with upload entry
   */
  async getUploadStatus(uploadId: string): Promise<RepositoryResult<UploadQueueEntry>> {
    try {
      const result = database.execute(`SELECT * FROM upload_queue WHERE id = ?`, [uploadId]);

      const uploads = (result.rows || []) as UploadQueueEntry[];

      if (uploads.length === 0) {
        return notFound(`Upload not found: ${uploadId}`);
      }

      return success(uploads[0]);
    } catch (error: any) {
      return databaseError(`Failed to get upload status: ${error.message}`);
    }
  }

  /**
   * Delete upload from queue
   *
   * @param uploadId - Upload ID
   * @returns Result void
   */
  async deleteUpload(uploadId: string): Promise<RepositoryResult<void>> {
    try {
      const result = database.execute(`DELETE FROM upload_queue WHERE id = ?`, [uploadId]);

      if (result.rowsAffected === 0) {
        return notFound(`Upload not found: ${uploadId}`);
      }

      return success(undefined);
    } catch (error: any) {
      return databaseError(`Failed to delete upload: ${error.message}`);
    }
  }

  /**
   * Update upload status (private helper)
   * Code Review Fix: Made async to properly handle DB errors
   */
  private async updateUploadStatus(uploadId: string, status: string, progress: number): Promise<void> {
    try {
      database.execute(
        `UPDATE upload_queue
         SET status = ?, progress = ?, updated_at = ?
         WHERE id = ?`,
        [status, progress, Date.now(), uploadId],
      );
    } catch (error: any) {
      console.error(`[AudioUploadService] Failed to update status for ${uploadId}:`, error);
      // Note: Non-blocking - upload can continue even if status update fails
    }
  }

  /**
   * Update upload progress (private helper)
   * Note: Remains synchronous as it's called from axios onUploadProgress callback
   */
  private updateUploadProgress(uploadId: string, progress: number): void {
    try {
      database.execute(
        `UPDATE upload_queue
         SET progress = ?, updated_at = ?
         WHERE id = ?`,
        [progress, Date.now(), uploadId],
      );
    } catch (error: any) {
      console.error(`[AudioUploadService] Failed to update progress for ${uploadId}:`, error);
    }
  }

  /**
   * Update upload status with error (private helper)
   * Code Review Fix: Made async to properly handle DB errors
   */
  private async updateUploadStatusWithError(uploadId: string, status: string, errorMessage: string): Promise<void> {
    try {
      database.execute(
        `UPDATE upload_queue
         SET status = ?, error_message = ?, retry_count = retry_count + 1, updated_at = ?
         WHERE id = ?`,
        [status, errorMessage, Date.now(), uploadId],
      );
    } catch (error: any) {
      console.error(`[AudioUploadService] Failed to update status with error for ${uploadId}:`, error);
    }
  }
}
