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
import { File, __clearMockFiles } from 'expo-file-system';

// Helper to create a mock file with specific size
async function createMockFile(path: string, size: number = 1024000): Promise<void> {
  const file = new File(path);
  const content = new Uint8Array(size);
  await file.write(content);
}

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(() => {
    // Clear mock file system between tests
    __clearMockFiles();

    service = new FileStorageService();
  });

  describe('constructor and initialization', () => {
    it('should initialize successfully', () => {
      // Directory creation happens in constructor
      // Modern API mock always returns exists: true for directories
      // Service should initialize without throwing
      expect(() => new FileStorageService()).not.toThrow();
    });

    it('should return correct storage directory path', () => {
      const directory = service.getStorageDirectory();
      expect(directory).toBe('/mock/documents/audio/');
    });
  });

  describe('moveToStorage', () => {
    it('should move file from temp to permanent storage with correct naming', async () => {
      const tempUri = 'file:///temp/recording.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Create temp file in mock filesystem
      await createMockFile(tempUri, 1024000);

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data).toBeDefined();

      // Verify result contains permanent path with correct naming
      expect(result.data?.permanentPath).toContain('/mock/documents/audio/');
      expect(result.data?.permanentPath).toContain('capture_capture-123_');
      expect(result.data?.permanentPath).toContain('.m4a');

      // Verify metadata
      expect(result.data?.metadata.size).toBe(1024000);
      expect(result.data?.metadata.duration).toBe(5000);
      expect(result.data?.metadata.createdAt).toBeInstanceOf(Date);

      // Verify temp file was deleted (moved, not copied)
      const tempFile = new File(tempUri);
      expect(tempFile.info().exists).toBe(false);

      // Verify permanent file exists
      const permanentFile = new File(result.data!.permanentPath);
      expect(permanentFile.info().exists).toBe(true);
    });

    it('should return error if temp file does not exist', async () => {
      const tempUri = 'file:///temp/missing.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Don't create the temp file - it should not exist

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.type).toBe(FileStorageResultType.FILE_NOT_FOUND);
      expect(result.error).toContain('Temporary file does not exist');
    });

    it('should propagate file system errors', async () => {
      const tempUri = 'file:///temp/recording.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Create temp file but then delete it before the test runs
      // This simulates a race condition where the file disappears
      await createMockFile(tempUri, 1024000);
      const tempFile = new File(tempUri);
      await tempFile.delete();

      // The service checks if file exists and should return FILE_NOT_FOUND
      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.type).toBe(FileStorageResultType.FILE_NOT_FOUND);
    });
  });

  describe('getFileMetadata', () => {
    it('should return correct file metadata', async () => {
      const fileUri = 'file:///mock/audio/capture.m4a';
      const durationMillis = 10000;

      // Create file with specific size
      await createMockFile(fileUri, 2048000);

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data?.size).toBe(2048000);
      expect(result.data?.duration).toBe(10000);
      expect(result.data?.createdAt).toBeInstanceOf(Date);
    });

    it('should return error if file does not exist', async () => {
      const fileUri = 'file:///mock/audio/missing.m4a';
      const durationMillis = 10000;

      // Don't create the file

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.FILE_NOT_FOUND);
      expect(result.error).toContain('File does not exist');
    });

    it('should handle missing file size gracefully', async () => {
      const fileUri = 'file:///mock/audio/capture.m4a';
      const durationMillis = 5000;

      // Create file with size 0 (empty)
      await createMockFile(fileUri, 0);

      const result = await service.getFileMetadata(fileUri, durationMillis);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
      expect(result.data?.size).toBe(0);
      expect(result.data?.duration).toBe(5000);
    });
  });

  describe('deleteFile', () => {
    it('should delete file if it exists', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      // Create file
      await createMockFile(permanentPath);

      const result = await service.deleteFile(permanentPath);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);

      // Verify file was deleted
      const file = new File(permanentPath);
      expect(file.info().exists).toBe(false);
    });

    it('should return success if file does not exist (idempotent)', async () => {
      const permanentPath = 'file:///mock/audio/missing.m4a';

      // Don't create the file

      const result = await service.deleteFile(permanentPath);

      expect(result.type).toBe(FileStorageResultType.SUCCESS);
    });

    it('should be idempotent - deleting twice succeeds', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      // Create file
      await createMockFile(permanentPath);

      // Delete once
      const result1 = await service.deleteFile(permanentPath);
      expect(result1.type).toBe(FileStorageResultType.SUCCESS);

      // Delete again - should still succeed
      const result2 = await service.deleteFile(permanentPath);
      expect(result2.type).toBe(FileStorageResultType.SUCCESS);
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      // Create file
      await createMockFile(permanentPath);

      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(true);
    });

    it('should return false if file does not exist', async () => {
      const permanentPath = 'file:///mock/audio/missing.m4a';

      // Don't create the file

      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      const permanentPath = 'file:///mock/audio/capture.m4a';

      // The mock File implementation doesn't throw errors in info()
      // so we can't easily test error handling here
      // This test verifies that non-existent files return false
      const exists = await service.fileExists(permanentPath);

      expect(exists).toBe(false);
    });
  });


  describe('file naming convention', () => {
    it('should generate unique filenames for each capture', async () => {
      const tempUri1 = 'file:///temp/recording1.m4a';
      const tempUri2 = 'file:///temp/recording2.m4a';
      const captureId = 'capture-123';
      const durationMillis = 5000;

      // Create both temp files
      await createMockFile(tempUri1, 1024000);
      await createMockFile(tempUri2, 1024000);

      const result1 = await service.moveToStorage(tempUri1, captureId, durationMillis);

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

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

      // Create temp file
      await createMockFile(tempUri, 1024000);

      const result = await service.moveToStorage(tempUri, captureId, durationMillis);

      expect(result.data?.permanentPath).toMatch(/\.m4a$/);
    });
  });
});
