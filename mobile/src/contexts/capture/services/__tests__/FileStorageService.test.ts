/**
 * Tests for File Storage Service - Audio File Management
 *
 * Tests the file operations for:
 * - Moving audio files from temp to permanent storage
 * - Extracting file metadata (size, duration, creation date)
 * - File cleanup and deletion
 * - File existence checks
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Task 3: Audio File Storage Management
 *
 * NFR6: Zero data loss tolerance - files must be persisted reliably
 * NFR7: 100% offline availability - local storage only
 */

import { FileStorageService } from '../FileStorageService';
import { FileStorageResultType } from '../FileStorageResult';
import * as FileSystem from 'expo-file-system/legacy';

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock/documents/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  moveAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

describe('FileStorageService', () => {
  let service: FileStorageService;
  const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;
  const mockMakeDirectoryAsync = FileSystem.makeDirectoryAsync as jest.Mock;
  const mockMoveAsync = FileSystem.moveAsync as jest.Mock;
  const mockDeleteAsync = FileSystem.deleteAsync as jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock directory exists by default
    mockGetInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: true,
    });

    service = new FileStorageService();
  });

  describe('constructor and initialization', () => {
    it('should create audio directory if it does not exist', async () => {
      // Mock directory does not exist
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      const newService = new FileStorageService();

      // Wait for constructor async call to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockMakeDirectoryAsync).toHaveBeenCalledWith(
        'file:///mock/documents/audio/',
        { intermediates: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true });

      const newService = new FileStorageService();

      // Wait for constructor async call to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockMakeDirectoryAsync).not.toHaveBeenCalled();
    });
  });

  describe('moveToStorage', () => {
    it('should move file from temp to permanent storage with correct naming', async () => {
      const tempUri = 'file:///temp/recording.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Mock temp file exists
      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: true, isDirectory: true }) // Audio directory check
        .mockResolvedValueOnce({ exists: true, size: 1024000, modificationTime: 1640000000000 }) // Temp file check
        .mockResolvedValueOnce({ exists: true, size: 1024000, modificationTime: 1640000000000 }); // Permanent file metadata

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data).toBeDefined();

      // Verify file was moved
      expect(mockMoveAsync).toHaveBeenCalledWith({
        from: tempUri,
        to: expect.stringContaining('capture_capture-123_'),
      });

      // Verify result contains permanent path
      expect(result.data?.permanentPath).toContain('file:///mock/documents/audio/');
      expect(result.data?.permanentPath).toContain('capture_capture-123_');
      expect(result.data?.permanentPath).toContain('.m4a');

      // Verify metadata
      expect(result.data?.metadata.size).toBe(1024000);
      expect(result.data?.metadata.duration).toBe(5000);
      expect(result.data?.metadata.createdAt).toBeInstanceOf(Date);
    });

    it('should return error if temp file does not exist', async () => {
      const tempUri = 'file:///temp/missing.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Mock directory exists
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true });

      // Mock temp file does not exist
      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.type).toBe(FileStorageResultType.FILE_NOT_FOUND);
      expect(result.error).toContain('Temporary file does not exist');
      expect(mockMoveAsync).not.toHaveBeenCalled();
    });

    it('should handle file system errors gracefully', async () => {
      const tempUri = 'file:///temp/recording.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Mock directory exists
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true, isDirectory: true });

      // Mock temp file exists
      mockGetInfoAsync.mockResolvedValueOnce({ exists: true, size: 1024000 });

      // Mock moveAsync throws error
      mockMoveAsync.mockRejectedValueOnce(new Error('Disk full'));

      await expect(
        service.moveToStorage(tempUri, captureId, durationMillis)
      ).rejects.toThrow('Disk full');
    });
  });

  describe('getFileMetadata', () => {
    it('should return correct file metadata', async () => {
      const fileUri = 'file:///mock/audio/capture.m4a';
      const durationMillis = 10000;

      mockGetInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 2048000,
        modificationTime: 1640000000000,
      });

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data?.size).toBe(2048000);
      expect(result.data?.duration).toBe(10000);
      expect(result.data?.createdAt).toEqual(new Date(1640000000000));
    });

    it('should return error if file does not exist', async () => {
      const fileUri = 'file:///mock/audio/missing.m4a';
      const durationMillis = 10000;

      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.FILE_NOT_FOUND);
      expect(result.error).toContain('File does not exist');
    });

    it('should handle missing file size gracefully', async () => {
      const fileUri = 'file:///mock/audio/capture.m4a';
      const durationMillis = 5000;

      mockGetInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: undefined, // Missing size
        modificationTime: 1640000000000,
      });

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data?.size).toBe(0);
      expect(result.data?.duration).toBe(5000);
    });
  });

  describe('deleteFile', () => {
    it('should delete file if it exists', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      mockGetInfoAsync.mockResolvedValueOnce({ exists: true });

      await service.deleteFile(permanentPath);

      expect(mockDeleteAsync).toHaveBeenCalledWith(permanentPath);
    });

    it('should not throw error if file does not exist', async () => {
      const permanentPath = 'file:///mock/audio/missing.m4a';

      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      await expect(service.deleteFile(permanentPath)).resolves.not.toThrow();

      expect(mockDeleteAsync).not.toHaveBeenCalled();
    });

    it('should propagate deletion errors', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      mockGetInfoAsync.mockResolvedValueOnce({ exists: true });
      mockDeleteAsync.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(service.deleteFile(permanentPath)).rejects.toThrow('Permission denied');
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      mockGetInfoAsync.mockResolvedValueOnce({ exists: true });

      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const permanentPath = 'file:///mock/audio/missing.m4a';

      mockGetInfoAsync.mockResolvedValueOnce({ exists: false });

      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      mockGetInfoAsync.mockRejectedValueOnce(new Error('File system error'));

      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(false);
    });
  });

  describe('getStorageDirectory', () => {
    it('should return audio storage directory path', () => {
      const directory = service.getStorageDirectory();

      expect(directory).toBe('file:///mock/documents/audio/');
    });
  });

  describe('file naming convention', () => {
    it('should generate unique filenames for each capture', async () => {
      const tempUri1 = 'file:///temp/recording1.m4a';
      const tempUri2 = 'file:///temp/recording2.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Mock file exists for both
      mockGetInfoAsync
        .mockResolvedValue({ exists: true, isDirectory: true })
        .mockResolvedValue({ exists: true, size: 1024000, modificationTime: 1640000000000 });

      const result1 = await service.moveToStorage(tempUri1, captureId, durationMillis);

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockGetInfoAsync
        .mockResolvedValue({ exists: true, isDirectory: true })
        .mockResolvedValue({ exists: true, size: 1024000, modificationTime: 1640000000000 });

      const result2 = await service.moveToStorage(tempUri2, captureId, durationMillis);

      // Filenames should be different due to timestamp
      expect(result1.data?.permanentPath).not.toBe(result2.data?.permanentPath);
      expect(result1.data?.permanentPath).toContain('capture_capture-123_');
      expect(result2.data?.permanentPath).toContain('capture_capture-123_');
    });

    it('should use correct file extension (.m4a)', async () => {
      const tempUri = 'file:///temp/recording.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: true, isDirectory: true })
        .mockResolvedValueOnce({ exists: true, size: 1024000, modificationTime: 1640000000000 })
        .mockResolvedValueOnce({ exists: true, size: 1024000, modificationTime: 1640000000000 });

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.data?.permanentPath).toMatch(/\.m4a$/);
    });
  });
});
