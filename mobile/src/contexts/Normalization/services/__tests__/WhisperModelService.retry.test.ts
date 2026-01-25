import { WhisperModelService } from '../WhisperModelService';
import { fetch } from 'expo/fetch';

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
 * Helper to create a successful mock Response
 */
function createSuccessResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (name: string) => (name === 'content-length' ? '1024' : null),
    },
    body: createMockReadableStream([new Uint8Array(1024)]),
  } as unknown as Response;
}

describe('WhisperModelService - Retry Logic', () => {
  let service: WhisperModelService;
  let originalSetTimeout: typeof setTimeout;

  beforeEach(() => {
    service = new WhisperModelService();
    jest.clearAllMocks();
    originalSetTimeout = global.setTimeout;
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
  });

  describe('downloadModelWithRetry', () => {
    it('should succeed on first attempt if download works', async () => {
      // Arrange
      mockFetch.mockResolvedValue(createSuccessResponse());

      // Mock setTimeout to resolve immediately
      global.setTimeout = ((callback: any) => {
        callback();
        return 0 as any;
      }) as any;

      // Act
      const result = await service.downloadModelWithRetry('tiny');

      // Assert
      expect(result).toContain('whisper-tiny.bin');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry 3 times with exponential backoff on failure', async () => {
      // Arrange
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Error(`Network error ${callCount}`));
        }
        return Promise.resolve(createSuccessResponse());
      });

      // Mock setTimeout to resolve immediately
      global.setTimeout = ((callback: any) => {
        callback();
        return 0 as any;
      }) as any;

      // Act
      const result = await service.downloadModelWithRetry('tiny');

      // Assert
      expect(result).toContain('whisper-tiny.bin');
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should throw error after 3 failed retries', async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error('Permanent network error'));

      // Mock setTimeout to resolve immediately
      global.setTimeout = ((callback: any) => {
        callback();
        return 0 as any;
      }) as any;

      // Act & Assert
      await expect(service.downloadModelWithRetry('tiny')).rejects.toThrow(
        'Failed to download tiny model: Permanent network error'
      );
      expect(mockFetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should use exponential backoff delays: 5s, 30s, 5min', async () => {
      // Arrange
      const delays: number[] = [];

      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay?: number) => {
        if (delay) delays.push(delay);
        // Call callback immediately to avoid hanging
        Promise.resolve().then(() => callback());
        return 0 as any;
      });

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Error(`Error ${callCount}`));
        }
        return Promise.resolve(createSuccessResponse());
      });

      // Act
      await service.downloadModelWithRetry('tiny');

      // Assert
      expect(delays).toEqual([5000, 30000, 5 * 60 * 1000]);
    });

    it('should pass progress callback to download', async () => {
      // Arrange
      const mockProgressCallback = jest.fn();
      mockFetch.mockResolvedValue(createSuccessResponse());

      // Mock setTimeout
      global.setTimeout = ((callback: any) => {
        callback();
        return 0 as any;
      }) as any;

      // Act
      await service.downloadModelWithRetry('tiny', mockProgressCallback);

      // Assert
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });
});
