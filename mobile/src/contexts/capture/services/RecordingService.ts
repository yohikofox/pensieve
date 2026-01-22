/**
 * Recording Service - Audio Capture Business Logic
 *
 * Orchestrates audio recording with:
 * - expo-audio for recording
 * - CaptureRepository for persistence
 * - PermissionService for microphone access
 * - File system for audio storage
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC1: Start Recording with < 500ms Latency
 * AC2: Stop and Save Recording
 * AC5: Microphone Permission Handling
 */

import { CaptureRepository } from '../data/CaptureRepository';
import { PermissionService } from './PermissionService';
import { type RepositoryResult, RepositoryResultType } from '../domain/Result';

export interface RecordingResult {
  captureId: string;
  filePath: string;
  duration: number;
  fileSize?: number;
}

/**
 * RecordingService manages audio recording lifecycle
 *
 * Usage pattern:
 * ```typescript
 * const service = new RecordingService(repository);
 * await service.startRecording();
 * // ... user speaks ...
 * const result = await service.stopRecording();
 * ```
 */
export class RecordingService {
  private repository: CaptureRepository;
  private currentCaptureId: string | null = null;
  private recordingStartTime: number | null = null;

  constructor(repository: CaptureRepository) {
    this.repository = repository;
  }

  /**
   * AC1: Start Recording with < 500ms Latency
   * AC5: Check microphone permissions
   *
   * @param tempFileUri - Temporary file URI from expo-audio (for crash recovery)
   */
  async startRecording(tempFileUri: string): Promise<RepositoryResult<{ captureId: string }>> {
    // Prevent multiple simultaneous recordings
    if (this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'RecordingAlreadyInProgress',
      };
    }

    // AC5: Check microphone permissions
    const hasPermission = await PermissionService.hasMicrophonePermission();
    if (!hasPermission) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'MicrophonePermissionDenied',
      };
    }

    // AC1: Create Capture entity with status "recording" and temporary file URI
    // This allows crash recovery to find the file even if app crashes during recording
    const result = await this.repository.create({
      type: 'audio',
      state: 'recording',
      rawContent: tempFileUri,
      syncStatus: 'pending',
    });

    if (result.type !== RepositoryResultType.SUCCESS || !result.data) {
      return {
        type: result.type,
        error: result.error,
      };
    }

    this.currentCaptureId = result.data.id;
    this.recordingStartTime = Date.now();

    return {
      type: RepositoryResultType.SUCCESS,
      data: { captureId: result.data.id },
    };
  }

  /**
   * AC2: Stop and Save Recording
   */
  async stopRecording(): Promise<RepositoryResult<RecordingResult>> {
    if (!this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'NoRecordingInProgress',
      };
    }

    const captureId = this.currentCaptureId;
    const duration = this.recordingStartTime
      ? Date.now() - this.recordingStartTime
      : 0;

    const filePath = this.generateFilePath();

    const result = await this.repository.update(captureId, {
      state: 'captured',
      rawContent: filePath,
    });

    if (result.type !== RepositoryResultType.SUCCESS) {
      return result as RepositoryResult<RecordingResult>;
    }

    this.currentCaptureId = null;
    this.recordingStartTime = null;

    return {
      type: RepositoryResultType.SUCCESS,
      data: {
        captureId,
        filePath,
        duration,
      },
    };
  }

  /**
   * Cancel current recording without saving
   */
  async cancelRecording(): Promise<void> {
    if (!this.currentCaptureId) {
      return;
    }

    const captureId = this.currentCaptureId;

    // Delete the capture entity
    await this.repository.delete(captureId);

    // Reset state
    this.currentCaptureId = null;
    this.recordingStartTime = null;
  }

  /**
   * Get current recording ID
   */
  getCurrentRecordingId(): string | null {
    return this.currentCaptureId;
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.currentCaptureId !== null;
  }

  /**
   * Generate file path following naming convention:
   * capture_{userId}_{timestamp}_{uuid}.m4a
   *
   * Note: In production, userId should come from auth context
   */
  private generateFilePath(): string {
    const timestamp = Date.now();
    const uuid = this.generateUUID();
    const userId = 'user-123'; // TODO: Get from auth context

    return `capture_${userId}_${timestamp}_${uuid}.m4a`;
  }

  /**
   * Simple UUID v4 generator
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
