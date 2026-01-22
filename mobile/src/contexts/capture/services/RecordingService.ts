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
 * Architecture: Uses TSyringe IoC for dependency injection
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
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

}
