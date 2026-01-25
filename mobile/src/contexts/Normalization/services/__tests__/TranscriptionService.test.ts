import { TranscriptionService } from '../TranscriptionService';
import { AudioConversionService } from '../AudioConversionService';
import { initWhisper, WhisperContext } from 'whisper.rn';

// Mock whisper.rn
jest.mock('whisper.rn');

const mockInitWhisper = initWhisper as jest.MockedFunction<typeof initWhisper>;

// Mock AudioConversionService
const mockAudioConversionService = {
  convertToWhisperFormat: jest.fn(),
  cleanupTempFile: jest.fn(),
};

describe('TranscriptionService', () => {
  let service: TranscriptionService;
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

    // By default, conversion returns a .wav path
    mockAudioConversionService.convertToWhisperFormat.mockImplementation((inputPath: string) =>
      Promise.resolve(inputPath.replace(/\.[^.]+$/, '_whisper.wav'))
    );
    mockAudioConversionService.cleanupTempFile.mockResolvedValue(undefined);

    service = new TranscriptionService(mockAudioConversionService as unknown as AudioConversionService);
    jest.clearAllMocks();

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

  describe('constructor', () => {
    it('should initialize service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('transcribe', () => {
    it('should throw error if model is not loaded', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';

      // Act & Assert
      await expect(service.transcribe(audioFilePath)).rejects.toThrow(
        'Whisper model not loaded. Call loadModel() first.'
      );
    });

    it('should transcribe audio file using loaded Whisper model', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      const expectedText = 'Hello world this is a test transcription';

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.resolve({
          result: expectedText,
          segments: [],
          isAborted: false,
        }),
      });

      // Act
      await service.loadModel('/path/to/model.bin');
      const result = await service.transcribe(audioFilePath);

      // Assert
      expect(result).toBe(expectedText);
      // Should convert m4a to wav before transcription
      expect(mockAudioConversionService.convertToWhisperFormat).toHaveBeenCalledWith(audioFilePath);
      // Whisper should receive the converted WAV path
      expect(mockContext.transcribe).toHaveBeenCalledWith(
        '/path/to/audio_whisper.wav',
        expect.objectContaining({
          language: 'fr',
        })
      );
      // Cleanup should be called after transcription
      expect(mockAudioConversionService.cleanupTempFile).toHaveBeenCalledWith('/path/to/audio_whisper.wav');
    });

    it('should throw error if audio file path is invalid', async () => {
      // Arrange
      const invalidPath = '';
      await service.loadModel('/path/to/model.bin');

      // Act & Assert
      await expect(service.transcribe(invalidPath)).rejects.toThrow(
        'Invalid audio file path'
      );
    });

    it('should throw error if Whisper transcription fails', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      await service.loadModel('/path/to/model.bin');

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.reject(new Error('Model error')),
      });

      // Act & Assert
      await expect(service.transcribe(audioFilePath)).rejects.toThrow(
        'Transcription failed: Model error'
      );
    });

    it('should handle timeout errors', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      await service.loadModel('/path/to/model.bin');

      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: Promise.reject(new Error('Timeout exceeded')),
      });

      // Act & Assert
      await expect(service.transcribe(audioFilePath)).rejects.toThrow(
        'Transcription failed: Timeout exceeded'
      );
    });
  });

  describe('loadModel', () => {
    it('should load Whisper model once and cache in memory', async () => {
      // Arrange
      const modelPath = '/path/to/model.bin';

      // Act
      await service.loadModel(modelPath);
      await service.loadModel(modelPath); // Second call should use cache

      // Assert
      expect(mockInitWhisper).toHaveBeenCalledTimes(1);
      expect(mockInitWhisper).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: modelPath,
          useGpu: true,
        })
      );
    });

    it('should throw error if model loading fails', async () => {
      // Arrange
      mockInitWhisper.mockRejectedValue(new Error('Failed to load model'));

      // Act & Assert
      await expect(service.loadModel('/invalid/path.bin')).rejects.toThrow(
        'Failed to load Whisper model: Failed to load model'
      );
    });

    it('should release model on explicit request', async () => {
      // Arrange
      const modelPath = '/path/to/model.bin';

      // Act
      await service.loadModel(modelPath);
      await service.releaseModel();

      // Assert
      expect(mockContext.release).toHaveBeenCalled();
    });

    it('should allow re-loading model after release', async () => {
      // Arrange
      const modelPath = '/path/to/model.bin';

      // Act
      await service.loadModel(modelPath);
      await service.releaseModel();
      await service.loadModel(modelPath);

      // Assert
      expect(mockInitWhisper).toHaveBeenCalledTimes(2);
    });
  });

  describe('isModelLoaded', () => {
    it('should return false before model is loaded', () => {
      expect(service.isModelLoaded()).toBe(false);
    });

    it('should return true after model is loaded', async () => {
      await service.loadModel('/path/to/model.bin');
      expect(service.isModelLoaded()).toBe(true);
    });

    it('should return false after model is released', async () => {
      await service.loadModel('/path/to/model.bin');
      await service.releaseModel();
      expect(service.isModelLoaded()).toBe(false);
    });
  });

  describe('getLastTranscriptionDuration', () => {
    it('should return duration of transcription in milliseconds', async () => {
      // Arrange
      const audioFilePath = '/path/to/audio.m4a';
      await service.loadModel('/path/to/model.bin');

      // Mock a transcription that takes some time
      mockContext.transcribe.mockReturnValue({
        stop: jest.fn(),
        promise: new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              result: 'Test',
              segments: [],
              isAborted: false,
            });
          }, 50); // Simulate 50ms transcription time
        }),
      });

      // Act
      await service.transcribe(audioFilePath);
      const duration = service.getLastTranscriptionDuration();

      // Assert
      expect(duration).toBeGreaterThan(0);
    });
  });
});
