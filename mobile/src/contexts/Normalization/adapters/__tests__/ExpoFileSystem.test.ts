import { ExpoFileSystem } from '../ExpoFileSystem';
import { Paths } from 'expo-file-system';

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
});
