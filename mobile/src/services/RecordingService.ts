/**
 * Recording Service - Audio Capture Business Logic
 *
 * Status: 🔴 RED PHASE - Stub for TDD
 *
 * This service handles:
 * - Starting/stopping audio recordings
 * - Managing Capture entities
 * - File system operations
 * - Permission checks
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { MockAudioRecorder, MockFileSystem, MockPermissionManager } from '../../tests/acceptance/support/test-context';
import { CaptureRepository } from '../repositories/CaptureRepository';

export class RecordingService {
  private audioRecorder: MockAudioRecorder;
  private fileSystem: MockFileSystem;
  private captureRepo: CaptureRepository;
  private permissions: MockPermissionManager;
  private currentCaptureId: string | null = null;

  constructor(
    audioRecorder: MockAudioRecorder,
    fileSystem: MockFileSystem,
    captureRepo: CaptureRepository,
    permissions: MockPermissionManager
  ) {
    this.audioRecorder = audioRecorder;
    this.fileSystem = fileSystem;
    this.captureRepo = captureRepo;
    this.permissions = permissions;
  }

  /**
   * AC1: Start Recording with < 500ms Latency
   * AC5: Check microphone permissions
   */
  async startRecording(): Promise<void> {
    // AC5: Check microphone permissions
    if (!this.permissions.hasMicrophonePermission()) {
      throw new Error('MicrophonePermissionDenied');
    }

    // Start audio recording (should be < 500ms - NFR1)
    const { uri } = await this.audioRecorder.startRecording();

    // AC1: Create Capture entity with status "recording"
    const capture = await this.captureRepo.create({
      type: 'AUDIO',
      state: 'RECORDING',
      filePath: uri,
      syncStatus: 'pending',
      rawContent: '',
    });

    this.currentCaptureId = capture.id;
  }

  /**
   * AC2: Stop and Save Recording
   */
  async stopRecording(): Promise<void> {
    if (!this.currentCaptureId) {
      throw new Error('NoRecordingInProgress');
    }

    // Stop audio recording
    const { uri, duration } = await this.audioRecorder.stopRecording();

    // Generate file path with naming convention
    const filePath = this.generateFilePath();

    // Save audio file to storage
    await this.fileSystem.writeFile(filePath, `audio_content_${duration}ms`);

    // Get file size
    const file = this.fileSystem.getFile(filePath);
    const fileSize = file?.size || 0;

    // AC2: Update Capture entity with "CAPTURED" status and metadata
    await this.captureRepo.update(this.currentCaptureId, {
      state: 'CAPTURED',
      filePath,
      duration,
      fileSize,
      format: 'm4a',
    });

    this.currentCaptureId = null;
  }

  /**
   * Generate file path following naming convention:
   * capture_{userId}_{timestamp}_{uuid}.m4a
   */
  private generateFilePath(): string {
    const timestamp = Date.now();
    const uuid = require('uuid').v4();
    const userId = 'user-123'; // From context in real implementation
    return `capture_${userId}_${timestamp}_${uuid}.m4a`;
  }

  /**
   * AC4: Crash Recovery
   */
  async recoverIncompleteRecordings(): Promise<void> {
    throw new Error('RecordingService.recoverIncompleteRecordings() - Not implemented yet (RED phase)');
  }
}
