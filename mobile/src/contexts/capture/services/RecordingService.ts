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
import { type IPermissionService } from '../domain/IPermissionService';
import { type IAudioRecorder } from '../domain/IAudioRecorder';
import { type IFileSystem } from '../domain/IFileSystem';
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
    @inject(TOKENS.IAudioRecorder) private audioRecorder: IAudioRecorder,
    @inject(TOKENS.IFileSystem) private fileSystem: IFileSystem,
    @inject(TOKENS.ICaptureRepository) private repository: ICaptureRepository,
    @inject(TOKENS.IPermissionService) private permissions: IPermissionService
  ) {}

  /**
   * AC1: Start Recording with < 500ms Latency
   * AC5: Check microphone permissions
   *
   * This method orchestrates the complete recording start sequence:
   * 1. Check microphone permissions
   * 2. Start audio recording (via audioRecorder)
   * 3. Create Capture entity with temporary file URI
   */
  async startRecording(): Promise<RepositoryResult<{ captureId: string }>> {
    // Prevent multiple simultaneous recordings
    if (this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'RecordingAlreadyInProgress',
      };
    }

    // AC5: Check microphone permissions
    const hasPermission = await this.permissions.hasMicrophonePermission();
    if (!hasPermission) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'MicrophonePermissionDenied',
      };
    }

    // AC1: Start audio recording and get temporary file URI
    // This is atomic and fast (< 500ms target)
    const recordingResult = await this.audioRecorder.startRecording();

    if (recordingResult.type !== RepositoryResultType.SUCCESS || !recordingResult.data) {
      return {
        type: recordingResult.type,
        error: recordingResult.error,
      };
    }

    // AC1: Create Capture entity with status "recording" and temporary file URI
    // This allows crash recovery to find the file even if app crashes during recording
    const result = await this.repository.create({
      type: 'audio',
      state: 'recording',
      rawContent: recordingResult.data.uri,
      syncStatus: 'pending',
    });

    if (result.type !== RepositoryResultType.SUCCESS || !result.data) {
      // Recording started but DB failed - we should stop recording (best effort cleanup)
      await this.audioRecorder.stopRecording();

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
   * This method orchestrates the complete recording stop sequence:
   * 1. Stop audio recording (via audioRecorder)
   * 2. Get recording metadata (duration, URI)
   * 3. Update Capture entity with final file path and metadata
   */
  async stopRecording(): Promise<RepositoryResult<RecordingResult>> {
    if (!this.currentCaptureId) {
      return {
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'NoRecordingInProgress',
      };
    }

    const captureId = this.currentCaptureId;

    // AC2: Stop audio recording and get metadata
    const stopResult = await this.audioRecorder.stopRecording();

    if (stopResult.type !== RepositoryResultType.SUCCESS || !stopResult.data) {
      return {
        type: stopResult.type,
        error: stopResult.error,
      };
    }

    const filePath = this.generateFilePath();
    const duration = stopResult.data.duration;

    // AC2: Update Capture entity with final state and metadata
    const result = await this.repository.update(captureId, {
      state: 'captured',
      rawContent: filePath,
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
