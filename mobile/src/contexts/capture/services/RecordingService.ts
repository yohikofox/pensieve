/**
 * Recording Service - Audio Capture Business Logic
 *
 * Orchestrates audio recording with:
 * - expo-audio (or mock) for recording
 * - CaptureRepository for persistence
 * - PermissionService for microphone access
 * - File system for audio storage
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * AC1: Start Recording with < 500ms Latency
 * AC2: Stop and Save Recording
 * AC5: Microphone Permission Handling
 *
 * Story: 2.3 - Annuler Capture Audio
 * AC1: Cancel Recording with Immediate Stop
 * AC5: Offline Cancellation Support
 *
 * Architecture: Uses TSyringe IoC for dependency injection
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import * as FileSystem from 'expo-file-system';
import { TOKENS } from '../../../infrastructure/di/tokens';
import { type ICaptureRepository } from '../domain/ICaptureRepository';
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
 * Usage pattern with TSyringe:
 * ```typescript
 * import { container } from 'tsyringe';
 * const service = container.resolve(RecordingService);
 * await service.startRecording();
 * // ... user speaks ...
 * const result = await service.stopRecording();
 * ```
 */
@injectable()
export class RecordingService {
  private currentCaptureId: string | null = null;
  private recordingStartTime: number | null = null;

  constructor(
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository
  ) {}

  /**
   * AC1: Start Recording with < 500ms Latency
   *
   * Creates a Capture entity in "recording" state with temporary URI
   *
   * @param tempUri - Temporary URI from expo-audio recorder
   * @returns Result with captureId
   */
  async startRecording(tempUri: string): Promise<RepositoryResult<{ captureId: string }>> {
    // Prevent multiple simultaneous recordings
    if (this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'RecordingAlreadyInProgress',
      };
    }

    // AC1: Create Capture entity with status "recording" and temporary file URI
    // This allows crash recovery to find the file even if app crashes during recording
    const result = await this.repository.create({
      type: 'audio',
      state: 'recording',
      rawContent: tempUri,
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
   *
   * Updates Capture entity to "captured" state
   *
   * @param uri - Final recording URI from expo-audio
   * @param duration - Recording duration in milliseconds
   * @returns Result with captureId, filePath, and duration
   */
  async stopRecording(uri: string, duration: number): Promise<RepositoryResult<RecordingResult>> {
    if (!this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'NoRecordingInProgress',
      };
    }

    const captureId = this.currentCaptureId;

    // AC2: Update Capture entity with final state and metadata
    const result = await this.repository.update(captureId, {
      state: 'captured',
      rawContent: uri,
      duration,
    });

    if (result.type !== RepositoryResultType.SUCCESS) {
      return {
        type: result.type,
        error: result.error,
      };
    }

    this.currentCaptureId = null;
    this.recordingStartTime = null;

    return {
      type: RepositoryResultType.SUCCESS,
      data: {
        captureId,
        filePath: uri,
        duration,
      },
    };
  }

  /**
   * Story 2.3 AC1: Cancel current recording without saving
   * - Deletes partial audio file from storage
   * - Removes Capture entity from database
   * - Works identically offline (AC5)
   *
   * @returns Result indicating success or failure with error details
   */
  async cancelRecording(): Promise<RepositoryResult<void>> {
    if (!this.currentCaptureId) {
      // No recording in progress - this is not an error, just a no-op
      return {
        type: RepositoryResultType.SUCCESS,
        data: undefined,
      };
    }

    const captureId = this.currentCaptureId;

    try {
      // AC1: Get the capture entity to retrieve file URI
      const capture = await this.repository.findById(captureId);

      // AC1: Delete partial audio file if it exists
      if (capture && capture.rawContent) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(capture.rawContent);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(capture.rawContent, { idempotent: true });
          }
        } catch (fileError) {
          // AC5: Log file deletion errors but don't fail the cancel operation
          // Offline: File system operations work identically
          console.warn('[RecordingService] File deletion warning (non-critical):', fileError);
          // Continue with DB cleanup even if file deletion failed
        }
      }

      // AC1: Delete the capture entity from WatermelonDB
      await this.repository.delete(captureId);

      // Reset state
      this.currentCaptureId = null;
      this.recordingStartTime = null;

      return {
        type: RepositoryResultType.SUCCESS,
        data: undefined,
      };
    } catch (error) {
      // Critical error during cancel (likely DB deletion failure)
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Still try to reset state even if cleanup failed
      this.currentCaptureId = null;
      this.recordingStartTime = null;

      return {
        type: RepositoryResultType.DATABASE_ERROR,
        error: `Failed to cancel recording: ${errorMessage}`,
      };
    }
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

}
