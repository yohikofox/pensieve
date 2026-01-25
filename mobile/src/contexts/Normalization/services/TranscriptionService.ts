import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { Platform } from 'react-native';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { AudioConversionService } from './AudioConversionService';

export interface PerformanceMetrics {
  audioDuration: number; // Audio file duration in ms
  transcriptionDuration: number; // Time taken to transcribe in ms
  ratio: number; // transcriptionDuration / audioDuration
  meetsNFR2: boolean; // true if ratio <= 2.0
}

/**
 * Service for audio transcription using Whisper model
 *
 * Responsibilities:
 * - Manage Whisper model lifecycle (load, cache, release)
 * - Transcribe audio files to text
 * - Configure transcription parameters (language, task)
 * - Handle transcription errors
 * - Track transcription duration for performance monitoring
 */
@injectable()
export class TranscriptionService {
  private whisperContext: WhisperContext | null = null;
  private lastTranscriptionDuration: number = 0;
  private lastPerformanceMetrics: PerformanceMetrics | null = null;

  constructor(private audioConversionService: AudioConversionService) {}

  /**
   * Transcribe an audio file to text using Whisper
   *
   * @param audioFilePath - Absolute path to audio file
   * @param audioDuration - Duration of audio file in milliseconds (for performance monitoring)
   * @returns Transcribed text
   * @throws Error if audio path invalid, model not loaded, or transcription fails
   */
  async transcribe(audioFilePath: string, audioDuration?: number): Promise<string> {
    if (!audioFilePath || audioFilePath.trim() === '') {
      throw new Error('Invalid audio file path');
    }

    if (!this.whisperContext) {
      throw new Error('Whisper model not loaded. Call loadModel() first.');
    }

    let wavFilePath: string | null = null;

    try {
      const startTime = Date.now();

      // Step 1: Convert audio to Whisper-compatible WAV format (16kHz mono PCM)
      // m4a/AAC recordings are not supported by whisper.rn
      console.log('[TranscriptionService] 🎙️ Starting transcription for:', audioFilePath);

      wavFilePath = await this.audioConversionService.convertToWhisperFormat(audioFilePath);

      // Step 2: Normalize path for whisper.rn (remove file:// prefix on iOS)
      let normalizedPath = wavFilePath;
      if (Platform.OS === 'ios' && wavFilePath.startsWith('file://')) {
        normalizedPath = wavFilePath.replace('file://', '');
      }

      console.log('[TranscriptionService] 🔄 Transcribing WAV:', {
        original: audioFilePath,
        converted: wavFilePath,
        normalized: normalizedPath,
      });

      // Step 3: Transcribe using Whisper
      const { promise } = this.whisperContext.transcribe(normalizedPath, {
        language: 'fr', // French language for Pensieve app
      });

      const result = await promise;
      const transcriptionDuration = Date.now() - startTime;

      // Store duration for performance monitoring
      this.lastTranscriptionDuration = transcriptionDuration;

      // Performance monitoring (NFR2: transcription < 2x audio duration)
      if (audioDuration) {
        const ratio = transcriptionDuration / audioDuration;
        const meetsNFR2 = ratio <= 2.0;

        this.lastPerformanceMetrics = {
          audioDuration,
          transcriptionDuration,
          ratio: Math.round(ratio * 100) / 100, // Round to 2 decimals
          meetsNFR2,
        };

        // Warn if NFR2 violated
        if (!meetsNFR2) {
          console.warn('NFR2 violation: Transcription time exceeded 2x audio duration', {
            audioDuration,
            transcriptionDuration,
            ratio: Math.round(ratio * 100) / 100,
          });
        }
      }

      return result.result;
    } catch (error) {
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      // Step 4: Cleanup temporary WAV file (always, even on error)
      if (wavFilePath) {
        await this.audioConversionService.cleanupTempFile(wavFilePath);
      }
    }
  }

  /**
   * Load Whisper model into memory (cached)
   *
   * Model is loaded once and cached for subsequent transcriptions.
   * Call releaseModel() to free memory when done.
   *
   * @param modelPath - Absolute path to Whisper model file (.bin)
   */
  async loadModel(modelPath: string): Promise<void> {
    // Return if model already loaded (cached)
    if (this.whisperContext) {
      console.log('[TranscriptionService] Model already loaded, skipping');
      return;
    }

    console.log('[TranscriptionService] Loading Whisper model from:', modelPath);

    try {
      this.whisperContext = await initWhisper({
        filePath: modelPath,
        useGpu: true, // Use GPU acceleration if available
      });
      console.log('[TranscriptionService] ✅ Model loaded successfully, GPU:', this.whisperContext.gpu);
    } catch (error) {
      throw new Error(
        `Failed to load Whisper model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Release Whisper model from memory
   *
   * Call this to free memory when transcription is complete
   * or when app is backgrounding.
   */
  async releaseModel(): Promise<void> {
    if (this.whisperContext) {
      console.log('[TranscriptionService] Releasing Whisper model');
      await this.whisperContext.release();
      this.whisperContext = null;
    }
  }

  /**
   * Check if the model is currently loaded
   */
  isModelLoaded(): boolean {
    return this.whisperContext !== null;
  }

  /**
   * Get duration of last transcription in milliseconds
   *
   * Use this for performance monitoring (NFR2: < 2x audio duration)
   *
   * @returns Duration in milliseconds
   */
  getLastTranscriptionDuration(): number {
    return this.lastTranscriptionDuration;
  }

  /**
   * Get performance metrics for last transcription
   *
   * Returns metrics comparing transcription time to audio duration.
   * Use to monitor NFR2 compliance (< 2x audio duration).
   *
   * @returns Performance metrics or null if no transcription performed yet
   */
  getLastPerformanceMetrics(): PerformanceMetrics | null {
    return this.lastPerformanceMetrics;
  }
}
