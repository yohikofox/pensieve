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
 * 4. Build WAV file from AudioBuffer
 * 5. Output: Temporary WAV file path for transcription
 *
 * Story: 2.5 - Transcription on-device with Whisper
 */

import "reflect-metadata";
import { injectable } from "tsyringe";
import {
  decodeAudioData,
  OfflineAudioContext,
  type AudioBuffer as RNAudioBuffer,
} from "react-native-audio-api";
import * as FileSystemLegacy from "expo-file-system/legacy";

// Whisper.rn requirements
const WHISPER_SAMPLE_RATE = 16000;
const WHISPER_NUM_CHANNELS = 1;
const WHISPER_BIT_DEPTH = 16;

@injectable()
export class AudioConversionService {
  /**
   * Convert audio file to Whisper-compatible WAV format
   *
   * Whisper.rn requires: WAV PCM 16kHz mono 16-bit
   *
   * @param inputPath - Path to input audio file (m4a, aac, mp3, etc.)
   * @returns Path to converted WAV file (caller must delete after use)
   * @throws Error if conversion fails or file doesn't exist
   */
  async convertToWhisperFormat(inputPath: string): Promise<string> {
    console.log("[AudioConversionService] 🎵 Converting audio to Whisper format:", inputPath);

    // Normalize path - remove file:// prefix for react-native-audio-api
    const normalizedInputPath = inputPath.startsWith("file://")
      ? inputPath.replace("file://", "")
      : inputPath;

    // Step 0: Verify input file exists
    const fileInfo = await FileSystemLegacy.getInfoAsync(inputPath);
    if (!fileInfo.exists) {
      console.error("[AudioConversionService] ❌ Input file does not exist:", inputPath);
      throw new Error(`Audio file not found: ${inputPath}`);
    }
    console.log("[AudioConversionService] 📁 Input file exists, size:", fileInfo.size, "bytes");

    const outputPath = this.generateOutputPath(inputPath);

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

      // Step 3: Build WAV file from AudioBuffer
      const wavData = this.buildWavFile(monoBuffer);

      // Step 4: Write to file
      await this.writeWavFile(outputPath, wavData);

      console.log("[AudioConversionService] ✅ Conversion successful:", outputPath);
      return outputPath;
    } catch (error) {
      console.error("[AudioConversionService] ❌ Conversion failed:", error);
      throw new Error(
        `Audio conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Delete temporary WAV file after transcription
   *
   * @param wavPath - Path to WAV file to delete
   */
  async cleanupTempFile(wavPath: string): Promise<void> {
    try {
      await FileSystemLegacy.deleteAsync(wavPath, { idempotent: true });
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
    // Convert Uint8Array to base64
    const base64 = this.uint8ArrayToBase64(data);

    // Write to file
    await FileSystemLegacy.writeAsStringAsync(path, base64, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
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
   * Input: /path/to/recording.m4a
   * Output: /path/to/recording_whisper.wav
   */
  private generateOutputPath(inputPath: string): string {
    // Remove file:// prefix if present (normalize path)
    let normalizedPath = inputPath;
    if (normalizedPath.startsWith("file://")) {
      normalizedPath = normalizedPath.replace("file://", "");
    }

    // Replace extension with _whisper.wav
    const lastDotIndex = normalizedPath.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return `${normalizedPath}_whisper.wav`;
    }

    return `${normalizedPath.substring(0, lastDotIndex)}_whisper.wav`;
  }
}
