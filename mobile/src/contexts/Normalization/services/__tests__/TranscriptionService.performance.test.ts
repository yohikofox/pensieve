import { TranscriptionService } from '../TranscriptionService';
import { AudioConversionService } from '../AudioConversionService';
import { WhisperModelService } from '../WhisperModelService';
import { initWhisper, WhisperContext } from 'whisper.rn';

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

describe('TranscriptionService - Performance Monitoring', () => {
  let service: TranscriptionService;
  let consoleWarnSpy: jest.SpyInstance;
  let mockContext: {
    transcribe: jest.Mock;
    release: jest.Mock;
    gpu: boolean;
    id: number;
  };

  beforeEach(() => {
    // Reset mocks
    mockAudioConversionService.convertToWhisperFormat.mockReset();
    mockAudioConversionService.cleanupTempFile.mockReset();
    mockAudioConversionService.isDebugModeEnabled.mockReset();
    mockWhisperModelService.getPromptString.mockReset();

    // By default, conversion returns a .wav path
    mockAudioConversionService.convertToWhisperFormat.mockImplementation((inputPath: string) =>
      Promise.resolve(inputPath.replace(/\.[^.]+$/, '_whisper.wav'))
    );
    mockAudioConversionService.cleanupTempFile.mockResolvedValue(undefined);
    // By default, debug mode is off
    mockAudioConversionService.isDebugModeEnabled.mockReturnValue(false);
    // By default, no custom vocabulary
    mockWhisperModelService.getPromptString.mockResolvedValue('');

    service = new TranscriptionService(
      mockAudioConversionService as unknown as AudioConversionService,
      mockWhisperModelService as unknown as WhisperModelService
    );
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Create a mock WhisperContext
    mockContext = {
      transcribe: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
      gpu: true,
      id: 1,
    };

    // Mock initWhisper to return our mock context
    mockInitWhisper.mockResolvedValue(mockContext as unknown as WhisperContext);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('performance threshold monitoring (NFR2)', () => {
    it('should NOT warn if transcription time < 2x audio duration', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 60000; // 60 seconds

      // Mock fast transcription (< 2x audio duration)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: 'Test transcription',
          segments: [],
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);

      // Assert - no warning for fast transcription
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn if transcription time > 2x audio duration (NFR2 violation)', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 10; // 10ms - very short to make test fast

      // Mock slow transcription (will take > 20ms due to setTimeout)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Test transcription',
              segments: [],
            });
          }, 50); // 50ms transcription = 5x the 10ms audio duration
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);

      // Assert - warning for slow transcription
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('NFR2 violation'),
        expect.objectContaining({
          audioDuration: 10,
        })
      );
    });

    it('should calculate correct ratio for performance monitoring', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 10; // 10ms

      // Mock transcription that takes ~30ms (3x ratio)
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Test',
              segments: [],
            });
          }, 30);
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      await service.transcribe(audioFilePath, audioDuration);
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.ratio).toBeGreaterThan(2); // > 2x (actual time depends on execution)
      expect(metrics!.meetsNFR2).toBe(false);
    });
  });

  describe('getLastPerformanceMetrics', () => {
    it('should return performance metrics after transcription', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const audioDuration = 100; // 100ms

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
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).not.toBeNull();
      expect(metrics!.audioDuration).toBe(100);
      expect(metrics!.transcriptionDuration).toBeGreaterThanOrEqual(0); // Can be 0 for instant transcription
      expect(typeof metrics!.ratio).toBe('number');
      expect(typeof metrics!.meetsNFR2).toBe('boolean');
    });

    it('should return null if no transcription performed yet', () => {
      // Act
      const metrics = service.getLastPerformanceMetrics();

      // Assert
      expect(metrics).toBeNull();
    });
  });
});
