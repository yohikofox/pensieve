import { ExpoFileSystem } from '../ExpoFileSystem';
import { Paths, File, Directory } from 'expo-file-system';

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  Paths: {
    cache: '/test/cache',
  },
  File: jest.fn(),
  Directory: jest.fn(),
}));

describe('ExpoFileSystem', () => {
  let fileSystem: ExpoFileSystem;

  beforeEach(() => {
    fileSystem = new ExpoFileSystem();
    jest.clearAllMocks();
  });

  describe('getCacheDirectory', () => {
    it('should return cache directory when Paths.cache is a string', () => {
      // Arrange
      (Paths as any).cache = '/test/cache';

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert
      expect(result).toBe('/test/cache');
    });

    it('should return null when Paths.cache is null', () => {
      // Arrange
      (Paths as any).cache = null;

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when Paths.cache is undefined', () => {
      // Arrange
      (Paths as any).cache = undefined;

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert
      expect(result).toBeNull();
    });

    it('should extract .uri when Paths.cache is an object (Bug #1 reproduction)', () => {
      // Arrange: Real-world bug - Paths.cache returns object with .uri property
      (Paths as any).cache = {
        exists: true,
        size: 56068,
        uri: 'file:///data/user/0/com.pensine.app.dev/cache/',
      };

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert: Should extract the .uri property
      expect(result).toBe('file:///data/user/0/com.pensine.app.dev/cache/');
    });

    it('should return null when Paths.cache is object without .uri property', () => {
      // Arrange: Edge case - object without uri
      (Paths as any).cache = { exists: true, size: 1234 };

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when Paths.cache is object with non-string .uri', () => {
      // Arrange: Edge case - uri is not a string
      (Paths as any).cache = { exists: true, uri: 123 };

      // Act
      const result = fileSystem.getCacheDirectory();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getFileInfo', () => {
    it('should return file info when path is a file', async () => {
      // Arrange
      const filePath = '/path/to/file.wav';
      const mockFileInfo = {
        exists: true,
        type: 'file',
        size: 12345,
      };
      const mockFile = {
        info: jest.fn().mockReturnValue(mockFileInfo),
      };
      (File as jest.Mock).mockReturnValue(mockFile);

      // Act
      const result = await fileSystem.getFileInfo(filePath);

      // Assert
      expect(File).toHaveBeenCalledWith(filePath);
      expect(mockFile.info).toHaveBeenCalled();
      expect(result).toEqual({
        exists: true,
        isDirectory: false,
        size: 12345,
        uri: filePath,
      });
    });

    it('should return file info when path is a file that does not exist', async () => {
      // Arrange
      const filePath = '/path/to/nonexistent.wav';
      const mockFileInfo = {
        exists: false,
        type: 'file',
        size: 0,
      };
      const mockFile = {
        info: jest.fn().mockReturnValue(mockFileInfo),
      };
      (File as jest.Mock).mockReturnValue(mockFile);

      // Act
      const result = await fileSystem.getFileInfo(filePath);

      // Assert
      expect(result).toEqual({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: filePath,
      });
    });

    it('should handle directory when path is a folder (Bug #2 reproduction)', async () => {
      // Arrange: Real-world bug - new File(path) fails when path is a directory
      const dirPath = 'file:///data/user/0/com.pensine.app.dev/cache';

      // Mock File constructor to throw when path is a directory
      const mockFile = {
        info: jest.fn().mockImplementation(() => {
          throw new Error('A folder with the same name already exists in the file location');
        }),
      };
      (File as jest.Mock).mockReturnValue(mockFile);

      // Mock Directory constructor to succeed
      const mockDirInfo = {
        exists: true,
        type: 'directory',
        size: 4096,
      };
      const mockDir = {
        info: jest.fn().mockReturnValue(mockDirInfo),
      };
      (Directory as jest.Mock).mockReturnValue(mockDir);

      // Act
      const result = await fileSystem.getFileInfo(dirPath);

      // Assert: Should try File first, then fallback to Directory
      expect(File).toHaveBeenCalledWith(dirPath);
      expect(Directory).toHaveBeenCalledWith(dirPath);
      expect(mockDir.info).toHaveBeenCalled();
      expect(result).toEqual({
        exists: true,
        isDirectory: true,
        size: 4096,
        uri: dirPath,
      });
    });

    it('should return exists: false when path does not exist as file or directory', async () => {
      // Arrange
      const path = '/path/to/nonexistent';

      // Mock File to throw
      const mockFile = {
        info: jest.fn().mockImplementation(() => {
          throw new Error('File not found');
        }),
      };
      (File as jest.Mock).mockReturnValue(mockFile);

      // Mock Directory to return exists: false
      const mockDirInfo = {
        exists: false,
        type: 'directory',
        size: 0,
      };
      const mockDir = {
        info: jest.fn().mockReturnValue(mockDirInfo),
      };
      (Directory as jest.Mock).mockReturnValue(mockDir);

      // Act
      const result = await fileSystem.getFileInfo(path);

      // Assert
      expect(result).toEqual({
        exists: false,
        isDirectory: false,
        size: 0,
        uri: path,
      });
    });
  });
});
