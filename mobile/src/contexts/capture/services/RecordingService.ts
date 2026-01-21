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
   */
  async startRecording(): Promise<void> {
    // Prevent multiple simultaneous recordings
    if (this.currentCaptureId) {
      throw new Error('RecordingAlreadyInProgress');
    }

    // AC5: Check microphone permissions
    const hasPermission = await PermissionService.hasMicrophonePermission();
    if (!hasPermission) {
      throw new Error('MicrophonePermissionDenied');
    }

    // AC1: Create Capture entity with status "recording"
    const capture = await this.repository.create({
      type: 'audio',
      state: 'recording',
      rawContent: '', // Will be set when recording stops
      syncStatus: 'pending',
    });

    this.currentCaptureId = capture.id;
    this.recordingStartTime = Date.now();

    // Note: Actual audio recording setup will be handled by React component
    // using useAudioRecorder hook, as it requires React lifecycle management
    // This service manages the business logic and persistence
  }

  /**
   * AC2: Stop and Save Recording
   */
  async stopRecording(): Promise<RecordingResult> {
    if (!this.currentCaptureId) {
      throw new Error('NoRecordingInProgress');
    }

    const captureId = this.currentCaptureId;
    const duration = this.recordingStartTime
      ? Date.now() - this.recordingStartTime
      : 0;

    // Generate file path with naming convention
    const filePath = this.generateFilePath();

    // AC2: Update Capture entity with "captured" status and metadata
    await this.repository.update(captureId, {
      state: 'captured',
      rawContent: filePath,
    });

    // Reset state
    this.currentCaptureId = null;
    this.recordingStartTime = null;

    return {
      captureId,
      filePath,
      duration,
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
