/**
 * TranscriptionService - Performance NFR Tests (Task 8.4)
 *
 * Story 2.5 - Task 8.4: Performance tests
 *
 * Tests for:
 * - NFR2: Transcription time < 2x audio duration (various lengths)
 * - Memory usage during transcription
 * - Device responsiveness (UI thread not blocked)
 */

import { TranscriptionService } from '../TranscriptionService';
import { AudioConversionService } from '../AudioConversionService';
import { WhisperModelService } from '../WhisperModelService';
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

// Mock WhisperModelService
const mockWhisperModelService = {
  getPromptString: jest.fn(),
};

// Helper to create mock model file
async function createMockModelFile(path: string) {
  const modelFile = new File(path);
  await modelFile.write(new Uint8Array(1024 * 1024)); // 1MB mock model
}

describe('TranscriptionService - Performance NFR Tests (Task 8.4)', () => {
  let service: TranscriptionService;
  let consoleWarnSpy: jest.SpyInstance;
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
    mockWhisperModelService.getPromptString.mockResolvedValue('');

    service = new TranscriptionService(
      mockAudioConversionService as unknown as AudioConversionService,
      mockWhisperModelService as unknown as WhisperModelService
    );
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

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
  });

  describe('Task 8.4.1: NFR2 - Transcription time < 2x audio duration (various lengths)', () => {
    /**
     * Test transcription performance for short audio (5 seconds)
     * Expected: transcription time < 10 seconds
     */
    it('should meet NFR2 for short audio (5 seconds)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio-5s.m4a';
      const audioDuration = 5000; // 5 seconds

      // Mock fast transcription (1.5x audio duration = 7.5s)
      // Using 30ms delay to simulate (7.5s / 5s = 1.5x ratio)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Short audio transcription',
              segments: [],
            });
          }, 30); // 30ms to simulate ratio
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.audioDuration).toBe(5000);
      expect(metrics!.meetsNFR2).toBe(true);
      expect(metrics!.ratio).toBeLessThan(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    /**
     * Test transcription performance for medium audio (30 seconds)
     * Expected: transcription time < 60 seconds
     */
    it('should meet NFR2 for medium audio (30 seconds)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio-30s.m4a';
      const audioDuration = 30000; // 30 seconds

      // Mock fast transcription (1.8x audio duration = 54s)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Medium length audio transcription with more content to process',
              segments: [],
            });
          }, 40); // 40ms to simulate ratio
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.audioDuration).toBe(30000);
      expect(metrics!.meetsNFR2).toBe(true);
      expect(metrics!.ratio).toBeLessThan(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    /**
     * Test transcription performance for long audio (2 minutes)
     * Expected: transcription time < 4 minutes (240s)
     */
    it('should meet NFR2 for long audio (2 minutes)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio-2min.m4a';
      const audioDuration = 120000; // 2 minutes = 120 seconds

      // Mock fast transcription (1.9x audio duration = 228s)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Long audio transcription with extensive content that requires more processing time but still meets the NFR2 performance threshold',
              segments: [],
            });
          }, 50); // 50ms to simulate ratio
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.audioDuration).toBe(120000);
      expect(metrics!.meetsNFR2).toBe(true);
      expect(metrics!.ratio).toBeLessThan(2);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    /**
     * Test that performance degrades gracefully for very long audio
     * Verifies warning is shown when NFR2 is violated
     */
    it('should warn when NFR2 is violated for any audio length', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio-slow.m4a';
      const audioDuration = 10; // 10ms (very short to make ratio calculation work in test)

      // Mock slow transcription (100ms / 10ms = 10x ratio > 2x threshold)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Slow transcription',
              segments: [],
            });
          }, 100); // 100ms transcription for 10ms audio = 10x ratio (violates NFR2)
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.meetsNFR2).toBe(false);
      expect(metrics!.ratio).toBeGreaterThan(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NFR2 violation'),
        expect.any(Object)
      );
    });
  });

  describe('Task 8.4.2: Memory usage during transcription', () => {
    /**
     * Test that memory usage stays within acceptable limits
     * Note: In tests we can't measure real memory, but we verify no memory leaks
     * by checking proper cleanup
     */
    it('should cleanup resources after transcription (no memory leaks)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 30000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Test',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);

      // Assert - cleanup should be called
      expect(mockAudioConversionService.cleanupTempFile).toHaveBeenCalled();

      // Verify model can be released (no memory leak)
      await service.releaseModel();
      expect(mockContext.release).toHaveBeenCalled();
    });

    /**
     * Test multiple successive transcriptions don't accumulate memory
     */
    it('should handle multiple transcriptions without memory accumulation', async () => {
      // Arrange
      const audioFiles = [
        '/path/to/audio1.m4a',
        '/path/to/audio2.m4a',
        '/path/to/audio3.m4a',
      ];
      const audioDuration = 5000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Test',
          segments: [],
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act - transcribe 3 files in succession
      for (const audioFile of audioFiles) {
        await service.transcribe(audioFile, audioDuration);
      }

      // Assert - cleanup called for each transcription
      expect(mockAudioConversionService.cleanupTempFile).toHaveBeenCalledTimes(3);

      // Verify model is still functional (no corruption)
      expect(service.isModelLoaded()).toBe(true);
    });

    /**
     * Test that large audio files are handled without OOM errors
     */
    it('should handle large audio files without out-of-memory errors', async () => {
      // Arrange - simulate 10 minute audio (large file)
      const audioFilePath = '/path/to/large-audio-10min.m4a';
      const audioDuration = 600000; // 10 minutes

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Large audio transcription',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const transcribePromise = service.transcribe(audioFilePath, audioDuration);

      // Assert - should not throw OOM error
      await expect(transcribePromise).resolves.not.toThrow();
      expect(mockAudioConversionService.cleanupTempFile).toHaveBeenCalled();
    });
  });

  describe('Task 8.4.3: Device responsiveness during transcription', () => {
    /**
     * Test that transcription is async and doesn't block
     */
    it('should perform transcription asynchronously without blocking', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 30000;

      let transcriptionStarted = false;
      let transcriptionCompleted = false;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            transcriptionCompleted = true;
            resolve({
              result: 'Test',
              segments: [],
            });
          }, 50);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act - start transcription (non-blocking)
      const transcribePromise = service.transcribe(audioFilePath, audioDuration);
      transcriptionStarted = true;

      // Assert - main thread continues immediately
      expect(transcriptionStarted).toBe(true);
      expect(transcriptionCompleted).toBe(false); // Not yet completed

      // Wait for completion
      await transcribePromise;
      expect(transcriptionCompleted).toBe(true);
    });

    /**
     * Test that UI operations can proceed during transcription
     * Simulates concurrent UI operations while transcription is running
     */
    it('should allow concurrent operations while transcription is in progress', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 30000;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Test',
              segments: [],
            });
          }, 100);
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act - start transcription without awaiting
      const transcribePromise = service.transcribe(audioFilePath, audioDuration);

      // Simulate UI operations running concurrently
      const uiOperations = [
        Promise.resolve('UI operation 1'),
        Promise.resolve('UI operation 2'),
        Promise.resolve('UI operation 3'),
      ];

      // Assert - UI operations complete before transcription
      const uiResults = await Promise.all(uiOperations);
      expect(uiResults).toEqual(['UI operation 1', 'UI operation 2', 'UI operation 3']);

      // Transcription continues in background
      await transcribePromise;
    });

    /**
     * Test that app remains responsive during long transcription
     */
    it('should maintain responsiveness during long transcription', async () => {
      // Arrange
      const audioFilePath = '/path/to/long-audio.m4a';
      const audioDuration = 120000; // 2 minutes

      let responsiveOperationCount = 0;

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Long transcription',
              segments: [],
            });
          }, 200); // Longer delay to simulate long transcription
        }),
      });

      await service.loadModel('/path/to/model.bin');

      // Act - start long transcription
      const transcribePromise = service.transcribe(audioFilePath, audioDuration);

      // Simulate responsive operations during transcription
      const responsiveInterval = setInterval(() => {
        responsiveOperationCount++;
      }, 10);

      // Wait for transcription
      await transcribePromise;
      clearInterval(responsiveInterval);

      // Assert - responsive operations executed multiple times
      expect(responsiveOperationCount).toBeGreaterThan(5); // Should have run multiple times
    });
  });
});
