/**
 * LazyAudioDownloader Unit Tests
 * Story 6.3 - Task 2: Metadata First, Audio Lazy Loading
 *
 * Tests TDD - RED phase first
 */

import * as FileSystem from 'expo-file-system';
import { LazyAudioDownloader } from '../LazyAudioDownloader';
import { DatabaseConnection } from '../../../database';

// Mock dependencies
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-dir/',
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
}));

// Mock database to prevent real initialization
jest.mock('../../../database', () => ({
  DatabaseConnection: {
    getInstance: jest.fn(),
  },
}));

describe('LazyAudioDownloader', () => {
  let downloader: LazyAudioDownloader;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset FileSystem mocks
    (FileSystem.downloadAsync as jest.Mock).mockReset();
    (FileSystem.getInfoAsync as jest.Mock).mockReset();
    (FileSystem.makeDirectoryAsync as jest.Mock).mockReset();

    // Mock database
    mockDb = {
      executeSync: jest.fn(),
    };
    (DatabaseConnection.getInstance as jest.Mock).mockReturnValue({
      getDatabase: jest.fn().mockReturnValue(mockDb),
    });

    downloader = new LazyAudioDownloader();
  });

  describe('Task 2.4: Download audio on-demand', () => {
    it('should return local path if audio already downloaded', async () => {
      // ARRANGE - Audio already exists locally
      const captureId = 'capture-123';
      const localPath = `${FileSystem.documentDirectory}audio/capture-123.m4a`;

      mockDb.executeSync.mockReturnValue({
        rows: {
          _array: [
            {
              id: captureId,
              audio_url: 'https://minio.example.com/audio/user-1/capture-123.m4a',
              audio_local_path: localPath,
            },
          ],
        },
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        uri: localPath,
      });

      // ACT
      const result = await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(result).toBe(localPath);
      expect(FileSystem.downloadAsync).not.toHaveBeenCalled(); // No download needed
    });

    it('should download audio if not cached locally', async () => {
      // ARRANGE - Audio not downloaded yet
      const captureId = 'capture-456';
      const audioUrl = 'https://minio.example.com/audio/user-1/capture-456.m4a';
      const expectedLocalPath = `${FileSystem.documentDirectory}audio/capture-456.m4a`;

      mockDb.executeSync
        // First call: SELECT capture
        .mockReturnValueOnce({
          rows: {
            _array: [
              {
                id: captureId,
                audio_url: audioUrl,
                audio_local_path: null, // Not downloaded
              },
            ],
          },
        })
        // Second call: UPDATE with local path
        .mockReturnValueOnce({ rows: { _array: [] } });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        uri: expectedLocalPath,
        status: 200,
      });

      // ACT
      const result = await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(result).toBe(expectedLocalPath);
      expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
        audioUrl,
        expectedLocalPath
      );
    });

    it('should update database with local path after download', async () => {
      // ARRANGE
      const captureId = 'capture-789';
      const audioUrl = 'https://minio.example.com/audio/user-1/capture-789.m4a';
      const expectedLocalPath = `${FileSystem.documentDirectory}audio/capture-789.m4a`;

      mockDb.executeSync
        .mockReturnValueOnce({
          rows: {
            _array: [
              {
                id: captureId,
                audio_url: audioUrl,
                audio_local_path: null,
              },
            ],
          },
        })
        .mockReturnValueOnce({ rows: { _array: [] } });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        uri: expectedLocalPath,
        status: 200,
      });

      // ACT
      await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(mockDb.executeSync).toHaveBeenNthCalledWith(
        2, // Second call is UPDATE
        'UPDATE captures SET audio_local_path = ? WHERE id = ?',
        [expectedLocalPath, captureId]
      );
    });

    it('should return null if capture has no audio_url', async () => {
      // ARRANGE - Text capture (no audio)
      const captureId = 'capture-text-only';

      mockDb.executeSync.mockReturnValue({
        rows: {
          _array: [
            {
              id: captureId,
              type: 'text',
              audio_url: null, // Text capture
            },
          ],
        },
      });

      // ACT
      const result = await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(result).toBeNull();
      expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
    });

    it('should return null if capture not found', async () => {
      // ARRANGE - Capture doesn't exist
      const captureId = 'non-existent';

      mockDb.executeSync.mockReturnValue({
        rows: { _array: [] }, // No results
      });

      // ACT
      const result = await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(result).toBeNull();
    });
  });

  describe('Task 2.6: Priority queue (most recent first)', () => {
    it('should enqueue download request', async () => {
      // ARRANGE
      const captureId = 'capture-queue-1';

      mockDb.executeSync.mockReturnValue({
        rows: {
          _array: [
            {
              id: captureId,
              audio_url: 'https://example.com/audio.m4a',
              audio_local_path: null,
            },
          ],
        },
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        uri: `${FileSystem.documentDirectory}audio/${captureId}.m4a`,
        status: 200,
      });

      // ACT
      downloader.enqueueDownload(captureId);

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ASSERT
      expect(FileSystem.downloadAsync).toHaveBeenCalled();
    });

    it('should not enqueue duplicate capture IDs', async () => {
      // ARRANGE
      const captureId = 'capture-duplicate';

      mockDb.executeSync.mockReturnValue({
        rows: {
          _array: [
            {
              id: captureId,
              audio_url: 'https://example.com/audio.m4a',
              audio_local_path: null,
            },
          ],
        },
      });

      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        uri: `${FileSystem.documentDirectory}audio/${captureId}.m4a`,
        status: 200,
      });

      // ACT - Enqueue same ID twice
      downloader.enqueueDownload(captureId);
      downloader.enqueueDownload(captureId);

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ASSERT - Download called only once
      expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task 2.7: Cache management', () => {
    it('should create audio directory if it does not exist', async () => {
      // ARRANGE
      const captureId = 'capture-new-dir';
      const audioUrl = 'https://minio.example.com/audio/user-1/capture-new-dir.m4a';

      mockDb.executeSync
        .mockReturnValueOnce({
          rows: {
            _array: [
              {
                id: captureId,
                audio_url: audioUrl,
                audio_local_path: null,
              },
            ],
          },
        })
        .mockReturnValueOnce({ rows: { _array: [] } });

      (FileSystem.getInfoAsync as jest.Mock)
        // First check: directory doesn't exist
        .mockResolvedValueOnce({ exists: false })
        // Second check: file doesn't exist
        .mockResolvedValueOnce({ exists: false });

      (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);

      (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
        uri: `${FileSystem.documentDirectory}audio/${captureId}.m4a`,
        status: 200,
      });

      // ACT
      await downloader.downloadAudioIfNeeded(captureId);

      // ASSERT
      expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        `${FileSystem.documentDirectory}audio`,
        { intermediates: true }
      );
    });
  });
});
