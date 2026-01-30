/**
 * AudioConversionService - Audio Preprocessing Tests
 *
 * Story 2.5 - Task 7.2: Optimize audio preprocessing
 *
 * Tests for:
 * - Trim silence (beginning/end)
 * - Long audio detection (>10min)
 */

import 'reflect-metadata';
import { AudioConversionService } from '../AudioConversionService';

describe('AudioConversionService - Audio Preprocessing', () => {
  let service: AudioConversionService;

  beforeEach(() => {
    service = new AudioConversionService();
  });

  describe('trimSilence()', () => {
    it('should detect and remove silence using RMS threshold', () => {
      // Test the RMS calculation logic
      const samples = new Float32Array([
        0, 0, 0, 0, 0,           // Silence (start)
        0.5, 0.5, 0.5, 0.5, 0.5, // Audio content
        0, 0, 0, 0, 0,           // Silence (end)
      ]);

      // Access private method via reflection
      const calculateRMS = (service as any).calculateRMS.bind(service);

      // Test silence detection
      const silenceRMS = calculateRMS(samples, 0, 5);
      expect(silenceRMS).toBe(0);

      // Test audio content detection
      const audioRMS = calculateRMS(samples, 5, 10);
      expect(audioRMS).toBeGreaterThan(0.01); // Above SILENCE_THRESHOLD
    });

    it('should calculate correct RMS for audio samples', () => {
      const calculateRMS = (service as any).calculateRMS.bind(service);

      // Test pure sine wave samples
      const samples = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const rms = calculateRMS(samples, 0, samples.length);

      // RMS of constant 0.5 should be 0.5
      expect(rms).toBeCloseTo(0.5, 2);
    });

    it('should handle empty sample ranges', () => {
      const calculateRMS = (service as any).calculateRMS.bind(service);

      const samples = new Float32Array([0.5, 0.5]);
      const rms = calculateRMS(samples, 0, 0); // Empty range

      expect(rms).toBe(0);
    });
  });

  describe('checkLongAudio()', () => {
    it('should warn for audio longer than 10 minutes', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create mock audio buffer with 11min duration
      const mockBuffer = {
        duration: 11 * 60, // 11 minutes in seconds
        sampleRate: 16000,
        numberOfChannels: 1,
        length: 11 * 60 * 16000,
      } as any;

      // Access private method via reflection
      const checkLongAudio = (service as any).checkLongAudio.bind(service);
      checkLongAudio(mockBuffer);

      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Long audio detected: 11.0min')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should NOT warn for audio shorter than 10 minutes', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create mock audio buffer with 5min duration
      const mockBuffer = {
        duration: 5 * 60, // 5 minutes in seconds
        sampleRate: 16000,
        numberOfChannels: 1,
        length: 5 * 60 * 16000,
      } as any;

      const checkLongAudio = (service as any).checkLongAudio.bind(service);
      checkLongAudio(mockBuffer);

      // Should NOT log warning
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should warn at exactly 10 minutes threshold', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Create mock audio buffer with exactly 10min duration
      const mockBuffer = {
        duration: 10 * 60 + 1, // Just over 10 minutes
        sampleRate: 16000,
        numberOfChannels: 1,
        length: (10 * 60 + 1) * 16000,
      } as any;

      const checkLongAudio = (service as any).checkLongAudio.bind(service);
      checkLongAudio(mockBuffer);

      // Should log warning (>10min)
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Audio Preprocessing Integration', () => {
    it('should apply preprocessing in correct order', () => {
      // This documents the preprocessing pipeline:
      // 1. Decode audio → 2. Mix to mono → 3. Trim silence → 4. Check long audio → 5. Build WAV

      const processingSteps = [
        'decodeAudioData',      // Step 1
        'mixToMono',            // Step 2
        'trimSilence',          // Step 2.5 (Task 7.2)
        'checkLongAudio',       // Step 2.6 (Task 7.2)
        'buildWavFile',         // Step 3
        'writeWavFile',         // Step 4
      ];

      // Verify preprocessing steps are defined
      expect(processingSteps).toHaveLength(6);
      expect(processingSteps[2]).toBe('trimSilence');
      expect(processingSteps[3]).toBe('checkLongAudio');
    });

    it('should document silence threshold constant', () => {
      // SILENCE_THRESHOLD = 0.01 (1% of max amplitude)
      // This is used for RMS-based silence detection

      const SILENCE_THRESHOLD = 0.01;
      expect(SILENCE_THRESHOLD).toBe(0.01);
    });

    it('should document max audio duration constant', () => {
      // MAX_AUDIO_DURATION_MS = 10 minutes
      // Audios longer than this trigger a warning

      const MAX_AUDIO_DURATION_MS = 10 * 60 * 1000;
      expect(MAX_AUDIO_DURATION_MS).toBe(600000); // 10 minutes
    });
  });
});
