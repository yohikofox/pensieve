/**
 * AudioConversionService - Convert audio files to Whisper-compatible format
 *
 * Whisper.rn requires WAV PCM 16kHz mono format.
 * This service converts m4a/AAC recordings using react-native-audio-api.
 *
 * Workflow:
 * 1. Input: m4a file (from expo-audio recording)
 * 2. Decode + resample to 16kHz using decodeAudioData
 * 3. Mix to mono using OfflineAudioContext
 * 3.5. [Optional] Trim silence if options.trimSilence=true (Story 8.3)
 * 4. Build WAV file from AudioBuffer
 * 5. Output: Temporary WAV file path for transcription
 *
 * Story: 2.5 - Transcription on-device with Whisper
 */

import "reflect-metadata";
import { injectable, inject } from "tsyringe";
import { FilePath } from "../domain/FilePath";
import type { IFileSystem } from "../ports/IFileSystem";
import {
  decodeAudioData,
  OfflineAudioContext,
  type AudioBuffer as RNAudioBuffer,
} from "react-native-audio-api";
// FileSystem now injected via IFileSystem interface (DIP)
import { useSettingsStore } from "../../../stores/settingsStore";
import {
  type RepositoryResult,
  success,
  businessError,
  unknownError,
} from "../../shared/domain/Result";

// Whisper.rn requirements
const WHISPER_SAMPLE_RATE = 16000;
const WHISPER_NUM_CHANNELS = 1;
const WHISPER_BIT_DEPTH = 16;

const MAX_AUDIO_DURATION_MS = 10 * 60 * 1000; // 10 minutes max per segment

// Native recognition: add silence padding at end to ensure last word is recognized
const NATIVE_END_PADDING_MS = 800; // 800ms of silence at end for native recognition to finalize last word

@injectable()
export class AudioConversionService {
  // Story 8.3: Conservative silence trimming constants (disabled by default)
  private readonly SILENCE_THRESHOLD = 0.005;    // RMS threshold (< 0.01 ancien — plus permissif)
  private readonly SILENCE_MARGIN_MS = 200;       // 200ms safety margin at boundaries
  private readonly SILENCE_MIN_DURATION_MS = 500; // Ignore silences shorter than 500ms
  // Debug: Track last converted WAV file for playback testing
  private lastConvertedWavPath: string | null = null;

  constructor(@inject('INormalizationFileSystem') private fileSystem: IFileSystem) {}

  /**
   * Get the path of the last converted WAV file (for debug purposes)
   */
  getLastConvertedWavPath(): string | null {
    return this.lastConvertedWavPath;
  }

  /**
   * Check if debug mode is enabled (from settings store)
   * When enabled, WAV files are kept for playback testing
   */
  isDebugModeEnabled(): boolean {
    return useSettingsStore.getState().debugMode;
  }

  /**
   * Manually delete the last converted WAV file (debug cleanup)
   */
  async deleteLastConvertedWav(): Promise<void> {
    if (!this.lastConvertedWavPath) {
      console.log("[AudioConversionService] 🔧 No WAV file to delete");
      return;
    }

    try {
      await this.fileSystem.deleteFile(this.lastConvertedWavPath, {
        idempotent: true,
      });
      console.log(
        "[AudioConversionService] 🗑️ Deleted debug WAV file:",
        this.lastConvertedWavPath,
      );
      this.lastConvertedWavPath = null;
    } catch (error) {
      console.warn(
        "[AudioConversionService] ⚠️ Failed to delete debug WAV:",
        error,
      );
    }
  }

  /**
   * Convert audio file to Whisper-compatible WAV format
   *
   * Whisper.rn requires: WAV PCM 16kHz mono 16-bit
   *
   * @param inputPath - Path to input audio file (m4a, aac, mp3, etc.)
   * @returns Result with path to converted WAV file (caller must delete after use)
   */
  async convertToWhisperFormat(inputPath: string, options?: { trimSilence?: boolean }): Promise<RepositoryResult<string>> {
    console.log(
      "[AudioConversionService] 🎵 Converting audio to Whisper format:",
      inputPath,
    );

    // Normalize path - remove file:// prefix for react-native-audio-api
    const normalizedInputPath = inputPath.startsWith("file://")
      ? inputPath.replace("file://", "")
      : inputPath;

    // Step 0: Verify input file exists
    const fileInfo = await this.fileSystem.getFileInfo(inputPath);
    if (!fileInfo.exists) {
      console.error(
        "[AudioConversionService] ❌ Input file does not exist:",
        inputPath,
      );
      return businessError(`Audio file not found: ${inputPath}`);
    }
    console.log(
      "[AudioConversionService] 📁 Input file exists, size:",
      fileInfo.size,
      "bytes",
    );

    const outputFilePath = this.generateOutputPath(inputPath);
    const outputPath = outputFilePath.toUri(); // Use URI format for expo-file-system File constructor
    console.log(
      "🚀 ~ AudioConversionService ~ convertToWhisperFormat ~ outputPath:",
      outputPath,
    );

    try {
      // Step 1: Decode audio file and resample to 16kHz
      const audioBuffer = await decodeAudioData(
        normalizedInputPath,
        WHISPER_SAMPLE_RATE,
      );

      console.log("[AudioConversionService] 📊 Decoded audio:", {
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
        duration: audioBuffer.duration,
      });

      // Step 2: Mix to mono if stereo using OfflineAudioContext
      const monoBuffer = await this.mixToMono(audioBuffer);

      // Story 8.3: Apply silence trimming only when explicitly enabled
      const trimmedBuffer = options?.trimSilence
        ? this.trimSilence(monoBuffer)
        : monoBuffer;

      // Step 2.6: Task 7.2 - Check for long audio (>10min)
      this.checkLongAudio(trimmedBuffer);

      // Step 3: Build WAV file from AudioBuffer
      const wavData = this.buildWavFile(trimmedBuffer);

      // Step 4: Write to file
      await this.writeWavFile(outputPath, wavData);

      // Track for debug playback
      this.lastConvertedWavPath = outputPath;

      console.log(
        "[AudioConversionService] ✅ Conversion successful:",
        outputPath,
      );
      return success(outputPath);
    } catch (error) {
      console.error("[AudioConversionService] ❌ Conversion failed:", error);
      return unknownError(
        `Audio conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Convert audio file to Whisper-compatible WAV format with end padding
   * for native speech recognition.
   *
   * Adds silence at the end to ensure the native recognition engine
   * has time to finalize the last word before EOF.
   *
   * @param inputPath - Path to input audio file (m4a, aac, mp3, etc.)
   * @returns Result with path to converted WAV file (caller must delete after use)
   */
  async convertToWhisperFormatWithPadding(inputPath: string, options?: { trimSilence?: boolean }): Promise<RepositoryResult<string>> {
    console.log(
      "[AudioConversionService] 🎵 Converting audio to Whisper format (with end padding):",
      inputPath,
    );

    // Normalize path - remove file:// prefix for react-native-audio-api
    const normalizedInputPath = inputPath.startsWith("file://")
      ? inputPath.replace("file://", "")
      : inputPath;

    // Step 0: Verify input file exists
    const fileInfo = await this.fileSystem.getFileInfo(inputPath);
    if (!fileInfo.exists) {
      console.error(
        "[AudioConversionService] ❌ Input file does not exist:",
        inputPath,
      );
      return businessError(`Audio file not found: ${inputPath}`);
    }
    console.log(
      "[AudioConversionService] 📁 Input file exists, size:",
      fileInfo.size,
      "bytes",
    );

    const outputFilePath = this.generateOutputPath(inputPath);
    const outputPath = outputFilePath.toUri(); // Use URI format for expo-file-system File constructor
    console.log(
      "🚀 ~ AudioConversionService ~ convertToWhisperFormatWithPadding ~ outputPath:",
      outputPath,
    );

    try {
      // Step 1: Decode audio file and resample to 16kHz
      const audioBuffer = await decodeAudioData(
        normalizedInputPath,
        WHISPER_SAMPLE_RATE,
      );

      console.log("[AudioConversionService] 📊 Decoded audio:", {
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
        duration: audioBuffer.duration,
      });

      // Step 2: Mix to mono if stereo using OfflineAudioContext
      const monoBuffer = await this.mixToMono(audioBuffer);

      // Story 8.3: Apply silence trimming only when explicitly enabled (before padding)
      const trimmedForPadding = options?.trimSilence
        ? this.trimSilence(monoBuffer)
        : monoBuffer;

      // Step 2.5: Add silence padding at end for native recognition
      const paddedBuffer = this.addEndPadding(trimmedForPadding);

      // Step 2.6: Check for long audio (>10min)
      this.checkLongAudio(paddedBuffer);

      // Step 3: Build WAV file from AudioBuffer
      const wavData = this.buildWavFile(paddedBuffer);

      // Step 4: Write to file
      await this.writeWavFile(outputPath, wavData);

      // Track for debug playback
      this.lastConvertedWavPath = outputPath;

      console.log(
        "[AudioConversionService] ✅ Conversion successful (with padding):",
        outputPath,
      );
      return success(outputPath);
    } catch (error) {
      console.error("[AudioConversionService] ❌ Conversion failed:", error);
      return unknownError(
        `Audio conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete temporary WAV file after transcription
   * In debug mode, files are kept for playback testing
   *
   * @param wavPath - Path to WAV file to delete
   */
  async cleanupTempFile(wavPath: string): Promise<void> {
    // Skip cleanup in debug mode to allow WAV playback
    if (this.isDebugModeEnabled()) {
      console.log(
        "[AudioConversionService] 🔧 Debug mode - keeping WAV file:",
        wavPath,
      );
      return;
    }

    try {
      await this.fileSystem.deleteFile(wavPath, { idempotent: true });
      console.log("[AudioConversionService] 🗑️ Cleaned up temp file:", wavPath);
    } catch (error) {
      // Log but don't throw - cleanup failure is non-critical
      console.warn(
        "[AudioConversionService] ⚠️ Failed to cleanup temp file:",
        wavPath,
        error,
      );
    }
  }

  /**
   * Mix stereo audio to mono using OfflineAudioContext
   */
  private async mixToMono(audioBuffer: RNAudioBuffer): Promise<RNAudioBuffer> {
    if (audioBuffer.numberOfChannels === 1) {
      // Already mono
      return audioBuffer;
    }

    // Create offline context for mono output
    const offlineCtx = new OfflineAudioContext({
      numberOfChannels: WHISPER_NUM_CHANNELS,
      length: audioBuffer.length,
      sampleRate: audioBuffer.sampleRate,
    });

    // Create buffer source
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    // Render to mono buffer
    const monoBuffer = await offlineCtx.startRendering();

    console.log("[AudioConversionService] 🔊 Mixed to mono:", {
      channels: monoBuffer.numberOfChannels,
      length: monoBuffer.length,
    });

    return monoBuffer;
  }

  /**
   * Story 8.3: Calculate Root Mean Square (RMS) energy of audio samples
   *
   * Used to detect silence regions for optional trimming.
   * Returns 0 for empty ranges.
   *
   * @param samples - Float32Array of audio samples
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive)
   * @returns RMS value in range [0, 1]
   */
  private calculateRMS(samples: Float32Array, start: number, end: number): number {
    if (end <= start) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / (end - start));
  }

  /**
   * Story 8.3: Conservative silence trimming
   *
   * Removes leading and trailing silence from audio buffer.
   * Uses RMS-based detection with generous margins to avoid cutting speech.
   * Ignores silences shorter than SILENCE_MIN_DURATION_MS.
   *
   * Only called when options.trimSilence === true — disabled by default.
   *
   * @param buffer - Mono AudioBuffer (16kHz)
   * @returns Trimmed AudioBuffer (or original if nothing to trim)
   */
  private trimSilence(buffer: RNAudioBuffer): RNAudioBuffer {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const windowSize = Math.floor((this.SILENCE_MIN_DURATION_MS / 1000) * sampleRate);
    const marginSamples = Math.floor((this.SILENCE_MARGIN_MS / 1000) * sampleRate);

    // Find first non-silent window (from start)
    let startSample = 0;
    for (let i = 0; i + windowSize <= channelData.length; i += windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      if (rms > this.SILENCE_THRESHOLD) {
        startSample = Math.max(0, i - marginSamples);
        break;
      }
    }

    // Find last non-silent window (from end)
    let endSample = channelData.length;
    for (let i = channelData.length; i - windowSize >= 0; i -= windowSize) {
      const rms = this.calculateRMS(channelData, i - windowSize, i);
      if (rms > this.SILENCE_THRESHOLD) {
        endSample = Math.min(channelData.length, i + marginSamples);
        break;
      }
    }

    // Safety: no speech detected or nothing to trim → return original
    if (startSample >= endSample) return buffer;
    if (startSample === 0 && endSample === channelData.length) return buffer;

    const newLength = endSample - startSample;

    const trimmedBuf = this.createEmptyBuffer(newLength, sampleRate);
    const trimmedData = trimmedBuf.getChannelData(0);

    for (let i = 0; i < newLength; i++) {
      trimmedData[i] = channelData[startSample + i];
    }

    console.log(
      `[AudioConversionService] ✂️ Trimmed silence: ${buffer.duration.toFixed(2)}s → ${(newLength / sampleRate).toFixed(2)}s`
    );

    return trimmedBuf;
  }

  /**
   * Add silence padding at the end of audio buffer
   *
   * This helps native speech recognition engines finalize the last word
   * before reaching EOF. Without this, the last word can be cut off.
   *
   * @param audioBuffer - Input audio buffer
   * @returns Audio buffer with silence padding at end
   */
  private addEndPadding(audioBuffer: RNAudioBuffer): RNAudioBuffer {
    const sampleRate = audioBuffer.sampleRate;
    const paddingSamples = Math.floor((NATIVE_END_PADDING_MS / 1000) * sampleRate);
    const newLength = audioBuffer.length + paddingSamples;

    console.log("[AudioConversionService] 🔇 Adding end padding:", {
      originalDuration: `${audioBuffer.duration.toFixed(2)}s`,
      paddingMs: NATIVE_END_PADDING_MS,
      paddingSamples,
      newDuration: `${(newLength / sampleRate).toFixed(2)}s`,
    });

    // Create offline context for padded buffer
    const offlineCtx = new OfflineAudioContext({
      numberOfChannels: 1,
      length: newLength,
      sampleRate,
    });

    // Create new buffer with padded length
    const paddedBuffer = offlineCtx.createBuffer(1, newLength, sampleRate);
    const paddedChannelData = paddedBuffer.getChannelData(0);
    const originalChannelData = audioBuffer.getChannelData(0);

    // Copy original audio
    for (let i = 0; i < audioBuffer.length; i++) {
      paddedChannelData[i] = originalChannelData[i];
    }

    // Padding samples are already zero-initialized (silence)
    // No need to explicitly set them

    return paddedBuffer;
  }

  /**
   * Create an empty (zero-filled) AudioBuffer with the given length and sample rate.
   *
   * Note: OfflineAudioContext is used as a factory because react-native-audio-api
   * does not expose a standalone createBuffer() function. The context is created
   * without calling startRendering() and becomes eligible for GC after this method
   * returns — its sole purpose is buffer instantiation.
   * This is an intentional pattern, consistent with addEndPadding().
   *
   * @param length - Number of samples
   * @param sampleRate - Sample rate in Hz
   * @returns Zero-initialized mono AudioBuffer
   */
  private createEmptyBuffer(length: number, sampleRate: number): RNAudioBuffer {
    const ctx = new OfflineAudioContext({
      numberOfChannels: 1,
      length,
      sampleRate,
    });
    return ctx.createBuffer(1, length, sampleRate);
  }

  /**
   * Task 7.2: Check for long audio (>10min) and log warning
   *
   * Long audio may cause performance issues or exceed Whisper limits.
   * Future enhancement: automatically split into segments.
   *
   * @param audioBuffer - Audio buffer to check
   */
  private checkLongAudio(audioBuffer: RNAudioBuffer): void {
    const durationMs = audioBuffer.duration * 1000;

    if (durationMs > MAX_AUDIO_DURATION_MS) {
      const durationMin = (durationMs / 1000 / 60).toFixed(1);
      const maxMin = (MAX_AUDIO_DURATION_MS / 1000 / 60).toFixed(0);

      console.warn(
        `[AudioConversionService] ⚠️  Long audio detected: ${durationMin}min (max recommended: ${maxMin}min)\n` +
          "This may cause slower transcription or memory issues.\n" +
          "Consider splitting long recordings into shorter segments.",
      );
    }
  }

  /**
   * Build WAV file bytes from AudioBuffer
   *
   * WAV format: RIFF header + fmt chunk + data chunk
   * PCM 16-bit signed little-endian
   */
  private buildWavFile(audioBuffer: RNAudioBuffer): Uint8Array {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = WHISPER_BIT_DEPTH;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = audioBuffer.length * blockAlign;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);

    // Get audio data (mono)
    const channelData = audioBuffer.getChannelData(0);

    // RIFF header
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, totalLength - 8, true); // File size - 8
    this.writeString(view, 8, "WAVE");

    // fmt chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataLength, true);

    // Write PCM samples (convert float32 to int16)
    let offset = 44;
    for (let i = 0; i < channelData.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit signed integer
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    return new Uint8Array(buffer);
  }

  /**
   * Write string to DataView at offset
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Write WAV data to file using base64 encoding
   */
  private async writeWavFile(path: string, data: Uint8Array): Promise<void> {
    // Ensure parent directory exists
    const parentDir = path.substring(0, path.lastIndexOf("/"));
    const dirInfo = await this.fileSystem.getFileInfo(parentDir);
    if (!dirInfo.exists) {
      console.log("[AudioConversionService] 📁 Creating directory:", parentDir);
      await this.fileSystem.makeDirectory(parentDir, {
        intermediates: true,
      });
    }

    // Convert Uint8Array to base64
    const base64 = this.uint8ArrayToBase64(data);

    // Write to file
    await this.fileSystem.writeFile(path, base64, 'base64');
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Generate output path for converted WAV file
   *
   * Uses cache directory for temporary WAV files (always writable)
   * Input: /path/to/capture_xxx_timestamp.m4a
   * Output: FilePath wrapping {cacheDir}/capture_xxx_timestamp_whisper.wav
   */
  private generateOutputPath(inputPath: string): FilePath {
    const inputFilePath = FilePath.from(inputPath);
    const basename = inputFilePath.getBasename();

    // Use cache directory (always writable) for temporary WAV files
    const cacheDir = this.fileSystem.getCacheDirectory();
    if (!cacheDir) {
      // Fallback to same directory if cache not available
      const inputDir = inputFilePath.getDirectory();
      return FilePath.from(`${inputDir}/${basename}_whisper.wav`);
    }

    // cacheDir may have file:// prefix (Node 22+)
    const cacheDirPath = FilePath.from(cacheDir);
    const cacheDirAbsolute = cacheDirPath.toAbsolutePath();

    // Remove trailing slash from cacheDir if present
    const cleanCacheDir = cacheDirAbsolute.endsWith("/")
      ? cacheDirAbsolute.slice(0, -1)
      : cacheDirAbsolute;

    return FilePath.from(`${cleanCacheDir}/${basename}_whisper.wav`);
  }
}
