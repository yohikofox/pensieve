import { WhisperModelService } from '../WhisperModelService';
import { fetch } from 'expo/fetch';
import { Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system';

// Mocks are set up in jest-setup.js
const mockFetch = fetch as jest.Mock;

/**
 * Helper to create a mock ReadableStream with chunks
 */
function createMockReadableStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0;
  return {
    getReader: () => ({
      read: jest.fn().mockImplementation(() => {
        if (index < chunks.length) {
          const chunk = chunks[index];
          index++;
          return Promise.resolve({ done: false, value: chunk });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

/**
 * Helper to create a mock Response
 */
function createMockResponse(options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  contentLength?: number;
  chunks?: Uint8Array[];
}): Response {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    contentLength = 1024,
    chunks = [new Uint8Array(1024)],
  } = options;

  return {
    ok,
    status,
    statusText,
    headers: {
      get: (name: string) => {
        if (name === 'content-length') {
          return contentLength.toString();
        }
        return null;
      },
    },
    body: createMockReadableStream(chunks),
  } as unknown as Response;
}

describe('WhisperModelService', () => {
  let service: WhisperModelService;

  beforeEach(() => {
    service = new WhisperModelService();
    jest.clearAllMocks();
    // Clear mock files between tests
    (FileSystem as any).__clearMockFiles?.();
  });

  describe('downloadModel', () => {
    it('should download Whisper tiny model to secure directory', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      const mockChunk = new Uint8Array(1024);
      mockFetch.mockResolvedValue(
        createMockResponse({
          contentLength: 1024,
          chunks: [mockChunk],
        })
      );

      // Act
      const result = await service.downloadModel('tiny', mockProgressCallback);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ggml-tiny.bin'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Pensieve-App/1.0',
          }),
        })
      );
      expect(result).toContain('whisper-tiny.bin');
    });

    it('should report progress during download', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      const chunk1 = new Uint8Array(512);
      const chunk2 = new Uint8Array(512);

      mockFetch.mockResolvedValue(
        createMockResponse({
          contentLength: 1024,
          chunks: [chunk1, chunk2],
        })
      );

      // Act
      await service.downloadModel('tiny', mockProgressCallback);

      // Assert
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalBytesWritten: 512,
          totalBytesExpectedToWrite: 1024,
          progress: 0.5,
        })
      );
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalBytesWritten: 1024,
          totalBytesExpectedToWrite: 1024,
          progress: 1,
        })
      );
    });

    it('should throw error on HTTP error response', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      );

      // Act & Assert
      await expect(
        service.downloadModel('tiny', mockProgressCallback)
      ).rejects.toThrow('HTTP error: 404 Not Found');
    });

    it('should throw error on network failure', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.downloadModel('tiny', mockProgressCallback)
      ).rejects.toThrow('Network error');
    });

    it('should handle unsupported model size', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();

      // Act & Assert
      await expect(
        service.downloadModel('large' as any, mockProgressCallback)
      ).rejects.toThrow('Unsupported model size');
    });

    it('should use expected size if content-length header is missing', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      const mockChunk = new Uint8Array(1024);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: () => null, // No content-length header
        },
        body: createMockReadableStream([mockChunk]),
      } as unknown as Response);

      // Act
      await service.downloadModel('tiny', mockProgressCallback);

      // Assert - should use expectedSize from config (75MB)
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          totalBytesExpectedToWrite: 75 * 1024 * 1024,
        })
      );
    });
  });

  describe('isModelDownloaded', () => {
    it('should return false for non-existent model (new File instance)', async () => {
      // Act - File mock starts with exists = false
      const result = await service.isModelDownloaded('tiny');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getModelPath', () => {
    it('should return correct path for tiny model', () => {
      // Act
      const path = service.getModelPath('tiny');

      // Assert
      expect(path).toContain('whisper-tiny.bin');
      expect(path).toContain(Paths.document);
    });

    it('should return correct path for base model', () => {
      // Act
      const path = service.getModelPath('base');

      // Assert
      expect(path).toContain('whisper-base.bin');
    });
  });

  describe('deleteModel', () => {
    it('should not throw when deleting non-existent model', async () => {
      // Act & Assert - should not throw for non-existent file
      await expect(service.deleteModel('tiny')).resolves.not.toThrow();
    });
  });

  describe('getExpectedSize', () => {
    it('should return correct size for tiny model', () => {
      expect(service.getExpectedSize('tiny')).toBe(75 * 1024 * 1024);
    });

    it('should return correct size for base model', () => {
      expect(service.getExpectedSize('base')).toBe(142 * 1024 * 1024);
    });
  });

  describe('getModelUrl', () => {
    it('should return correct URL for tiny model', () => {
      const url = service.getModelUrl('tiny');
      expect(url).toBe(
        'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin'
      );
    });

    it('should return correct URL for base model', () => {
      const url = service.getModelUrl('base');
      expect(url).toBe(
        'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
      );
    });
  });
});
