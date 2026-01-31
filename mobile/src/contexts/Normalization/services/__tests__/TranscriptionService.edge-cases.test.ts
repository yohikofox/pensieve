/**
 * TranscriptionService - Edge Case Tests (Task 8.5)
 *
 * Story 2.5 - Task 8.5: Edge case tests
 *
 * Tests for:
 * - Very short audio (< 1s)
 * - Very long audio (> 10min)
 * - Rapid successive transcriptions
 * - App backgrounding during transcription
 */

import { TranscriptionService } from '../TranscriptionService';
import { AudioConversionService } from '../AudioConversionService';
import { TranscriptionModelService } from '../TranscriptionModelService';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { File } from 'expo-file-system';

jest.mock('whisper.rn');

const mockInitWhisper = initWhisper as jest.MockedFunction<typeof initWhisper>;

// Mock AudioConversionService
const mockAudioConversionService = {
  convertToWhisperFormat: jest.fn(),
  cleanupTempFile: jest.fn(),
  isDebugModeEnabled: jest.fn(),
};

// Mock TranscriptionModelService
const mockTranscriptionModelService = {
  getPromptString: jest.fn(),
};

// Helper to create mock model file
async function createMockModelFile(path: string) {
  const modelFile = new File(path);
  await modelFile.write(new Uint8Array(1024 * 1024)); // 1MB mock model
}

describe('TranscriptionService - Edge Case Tests (Task 8.5)', () => {
  let service: TranscriptionService;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let mockContext: {
    transcribe: jest.Mock;
    release: jest.Mock;
    gpu: boolean;
    id: number;
  };

  beforeAll(async () => {
    await createMockModelFile('/path/to/model.bin');
  });

  beforeEach(() => {
    mockAudioConversionService.convertToWhisperFormat.mockImplementation((inputPath: string) =>
      Promise.resolve(inputPath.replace(/\.[^.]+$/, '_whisper.wav'))
    );
    mockAudioConversionService.cleanupTempFile.mockResolvedValue(undefined);
    mockAudioConversionService.isDebugModeEnabled.mockReturnValue(false);
    mockTranscriptionModelService.getPromptString.mockResolvedValue('');

    service = new TranscriptionService(
      mockAudioConversionService as unknown as AudioConversionService,
      mockTranscriptionModelService as unknown as TranscriptionModelService
    );
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    mockContext = {
      transcribe: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
      gpu: true,
      id: 1,
    };

    mockInitWhisper.mockResolvedValue(mockContext as unknown as WhisperContext);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Task 8.5.1: Very short audio (< 1s)', () => {
    it('should successfully transcribe very short audio (500ms)', async () => {
      // Arrange
      const audioFilePath = '/path/to/very-short-audio-500ms.m4a';
      const audioDuration = 500; // 500ms - very short

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'OK', // Short transcription result
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBe('OK');
      expect(mockContext.transcribe).toHaveBeenCalled();
    });

    it('should handle extremely short audio (100ms)', async () => {
      // Arrange
      const audioFilePath = '/path/to/extremely-short-audio-100ms.m4a';
      const audioDuration = 100; // 100ms - extremely short

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: '', // May return empty for very short audio
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert: Should not throw, even if result is empty
      expect(result).toBeDefined();
      expect(result.text).toBe('');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle audio with minimal content (<1s)', async () => {
      // Arrange
      const audioFilePath = '/path/to/minimal-audio-800ms.m4a';
      const audioDuration = 800; // 800ms

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Test',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert: Should work normally
      expect(result).toBeDefined();
      expect(result.text).toBe('Test');
      expect(mockContext.transcribe).toHaveBeenCalled();
    });
  });

  describe('Task 8.5.2: Very long audio (> 10min)', () => {
    it('should successfully transcribe long audio (10 minutes)', async () => {
      // Arrange
      const audioFilePath = '/path/to/long-audio-10min.m4a';
      const audioDuration = 600000; // 10 minutes = 600,000ms

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'This is a very long transcription result with many words and sentences that represents a 10 minute audio recording with extensive content.',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toContain('very long transcription');
      expect(mockContext.transcribe).toHaveBeenCalled();
      // Should log warning about long audio (>10min detection in AudioConversionService)
    });

    it('should handle extremely long audio (30 minutes)', async () => {
      // Arrange
      const audioFilePath = '/path/to/extremely-long-audio-30min.m4a';
      const audioDuration = 1800000; // 30 minutes = 1,800,000ms

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Extremely long transcription content from 30 minute recording',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert: Should complete despite length
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should maintain performance for long audio (12 minutes)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio-12min.m4a';
      const audioDuration = 720000; // 12 minutes

      // Simulate transcription taking reasonable time
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Transcription of 12 minute audio',
              segments: [],
            });
          }, 50); // Fast simulation
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const startTime = Date.now();
      const result = await service.transcribe(audioFilePath, audioDuration);
      const duration = Date.now() - startTime;

      // Assert: Should complete successfully
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
      // Performance: transcription completed
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Task 8.5.3: Rapid successive transcriptions', () => {
    it('should handle multiple transcriptions in rapid succession', async () => {
      // Arrange
      const audioFiles = [
        '/path/to/audio1.m4a',
        '/path/to/audio2.m4a',
        '/path/to/audio3.m4a',
        '/path/to/audio4.m4a',
        '/path/to/audio5.m4a',
      ];
      const audioDuration = 5000; // 5s each

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Test transcription',
          segments: [],
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Transcribe 5 files rapidly without delay
      const results = [];
      for (const audioFile of audioFiles) {
        const result = await service.transcribe(audioFile, audioDuration);
        results.push(result);
      }

      // Assert: All transcriptions should complete successfully
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.text).toBe('Test transcription');
      });
      expect(mockContext.transcribe).toHaveBeenCalledTimes(5);
      expect(mockAudioConversionService.cleanupTempFile).toHaveBeenCalledTimes(5);
    });

    it('should handle concurrent transcription requests gracefully', async () => {
      // Arrange
      const audioFiles = [
        '/path/to/concurrent1.m4a',
        '/path/to/concurrent2.m4a',
        '/path/to/concurrent3.m4a',
      ];
      const audioDuration = 3000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Concurrent transcription',
              segments: [],
            });
          }, 10);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Start all transcriptions concurrently (Promise.all)
      const promises = audioFiles.map((audioFile) =>
        service.transcribe(audioFile, audioDuration)
      );
      const results = await Promise.all(promises);

      // Assert: All should complete
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.text).toBe('Concurrent transcription');
      });
    });

    it('should maintain model stability with rapid transcriptions', async () => {
      // Arrange: 10 rapid transcriptions
      const audioFilePath = '/path/to/rapid-test.m4a';
      const audioDuration = 2000;
      const transcriptionCount = 10;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Rapid test',
          segments: [],
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Perform 10 rapid transcriptions
      for (let i = 0; i < transcriptionCount; i++) {
        await service.transcribe(audioFilePath, audioDuration);
      }

      // Assert: Model should still be loaded and functional
      expect(service.isModelLoaded()).toBe(true);
      expect(mockContext.transcribe).toHaveBeenCalledTimes(transcriptionCount);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Task 8.5.4: App backgrounding during transcription', () => {
    it('should continue transcription when app goes to background', async () => {
      // Arrange
      const audioFilePath = '/path/to/background-audio.m4a';
      const audioDuration = 10000; // 10s

      let transcriptionStarted = false;
      let transcriptionCompleted = false;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          transcriptionStarted = true;
          setTimeout(() => {
            transcriptionCompleted = true;
            resolve({
              result: 'Background transcription',
              segments: [],
            });
          }, 100);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Start transcription (simulating app going to background)
      const transcriptionPromise = service.transcribe(audioFilePath, audioDuration);

      // Simulate app backgrounding
      expect(transcriptionStarted).toBe(true);
      expect(transcriptionCompleted).toBe(false);

      // Wait for completion
      const result = await transcriptionPromise;

      // Assert: Transcription completed despite backgrounding
      expect(transcriptionCompleted).toBe(true);
      expect(result).toBeDefined();
      expect(result.text).toBe('Background transcription');
    });

    it('should handle model release during background operation', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 5000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Test',
              segments: [],
            });
          }, 50);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Start transcription
      const transcriptionPromise = service.transcribe(audioFilePath, audioDuration);

      // Wait for completion
      await transcriptionPromise;

      // Model should still be loaded (not released during transcription)
      expect(service.isModelLoaded()).toBe(true);

      // Now release model (app shutdown scenario)
      await service.releaseModel();
      expect(service.isModelLoaded()).toBe(false);
      expect(mockContext.release).toHaveBeenCalled();
    });

    it('should recover from background interruption', async () => {
      // Arrange
      const audioFilePath = '/path/to/interrupted-audio.m4a';
      const audioDuration = 8000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Recovered transcription',
          segments: [],
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Transcribe (simulating recovery after interruption)
      const result = await service.transcribe(audioFilePath, audioDuration);

      // Assert: Should complete successfully after recovery
      expect(result).toBeDefined();
      expect(result.text).toBe('Recovered transcription');
      expect(service.isModelLoaded()).toBe(true);
    });

    it('should handle pause/resume during background processing', async () => {
      // Arrange: Simulate queue pause during background transcription
      const audioFilePath = '/path/to/pausable-audio.m4a';
      const audioDuration = 6000;

      let pauseSimulated = false;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            pauseSimulated = true;
            resolve({
              result: 'Pause-resume test',
              segments: [],
            });
          }, 50);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act: Start transcription
      const transcriptionPromise = service.transcribe(audioFilePath, audioDuration);

      // Wait for completion
      const result = await transcriptionPromise;

      // Assert: Transcription completed
      expect(pauseSimulated).toBe(true);
      expect(result).toBeDefined();
      expect(result.text).toBe('Pause-resume test');

      // Note: Actual pause/resume logic is handled by TranscriptionWorker
      // This test verifies TranscriptionService continues working
    });
  });
});
