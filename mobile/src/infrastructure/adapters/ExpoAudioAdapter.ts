/**
 * Expo Audio Adapter - IAudioRecorder Implementation
 *
 * Wraps expo-audio SDK to implement IAudioRecorder interface.
 * Provides audio recording functionality using Expo SDK 54+.
 *
 * Uses Result<> pattern - no exceptions thrown from public methods.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 *
 * Docs: https://docs.expo.dev/versions/latest/sdk/audio/
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import {
  AudioRecording,
  RecordingOptions,
  RecordingMode,
} from 'expo-audio';
import { type IAudioRecorder } from '../../contexts/capture/domain/IAudioRecorder';
import {
  type RepositoryResult,
  success,
  validationError,
  databaseError,
} from '../../contexts/capture/domain/Result';

/**
 * Default recording configuration
 *
 * iOS: WAV (LinearPCM) - can be decoded by react-native-audio-api without FFmpeg
 * Android: m4a format (AAC) - standard format
 *
 * AudioConversionService resamples to 16kHz mono for whisper.rn
 */
const RECORDING_OPTIONS: RecordingOptions = {
  androidConfig: {
    extension: '.m4a',
    outputFormat: 2, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  iosConfig: {
    extension: '.wav',
    audioQuality: 0x7F, // MAX (ignored for LinearPCM)
    sampleRate: 44100, // High quality recording, resampled to 16kHz for Whisper
    numberOfChannels: 2, // Stereo recording, mixed to mono for Whisper
    bitRate: 1411200, // 44100 * 16 * 2 = 1411.2 kbps for stereo 16-bit
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  webConfig: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

@injectable()
export class ExpoAudioAdapter implements IAudioRecorder {
  private recording: AudioRecording | null = null;
  private startTime: number | null = null;

  /**
   * Start audio recording
   *
   * AC1: Target < 500ms latency
   * Atomic operation - sets up recording and starts immediately
   */
  async startRecording(): Promise<RepositoryResult<{ uri: string }>> {
    try {
      // Clean up any previous recording
      if (this.recording) {
        await this.stopRecording();
      }

      // Create new recording instance
      this.recording = new AudioRecording(RECORDING_OPTIONS);
      this.startTime = Date.now();

      // Start recording
      await this.recording.record();

      // Get temporary URI
      const uri = this.recording.uri || '';

      if (!uri) {
        return validationError('Recording started but no URI available');
      }

      return success({ uri });
    } catch (error) {
      console.error('[ExpoAudioAdapter] Failed to start recording:', error);
      this.recording = null;
      this.startTime = null;
      return databaseError(
        error instanceof Error ? error.message : 'Failed to start recording'
      );
    }
  }

  /**
   * Stop audio recording
   *
   * Returns final file URI and duration in milliseconds
   */
  async stopRecording(): Promise<RepositoryResult<{ uri: string; duration: number }>> {
    if (!this.recording) {
      return validationError('No active recording to stop');
    }

    try {
      // Stop recording and get status
      const status = await this.recording.stop();

      const uri = this.recording.uri || status.uri || '';
      const duration = status.durationMillis || 0;

      // Clean up
      this.recording = null;
      this.startTime = null;

      if (!uri) {
        return validationError('Recording stopped but no URI available');
      }

      return success({ uri, duration });
    } catch (error) {
      console.error('[ExpoAudioAdapter] Failed to stop recording:', error);
      this.recording = null;
      this.startTime = null;
      return databaseError(
        error instanceof Error ? error.message : 'Failed to stop recording'
      );
    }
  }

  /**
   * Get current recording status
   *
   * Optional method for status monitoring
   */
  getStatus(): { isRecording: boolean; durationMillis: number; uri?: string } {
    if (!this.recording || !this.startTime) {
      return { isRecording: false, durationMillis: 0 };
    }

    const durationMillis = Date.now() - this.startTime;

    return {
      isRecording: true,
      durationMillis,
      uri: this.recording.uri || undefined,
    };
  }
}
