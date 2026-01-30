import { FilePath } from '../FilePath';

describe('FilePath Value Object', () => {
  describe('from()', () => {
    it('should create FilePath from absolute path', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.toAbsolutePath()).toBe('/path/to/file.wav');
    });

    it('should create FilePath from URI', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.toUri()).toBe('file:///path/to/file.wav');
    });

    it('should throw error for empty string', () => {
      expect(() => FilePath.from('')).toThrow('FilePath cannot be created from empty string');
    });
  });

  describe('fromAbsolute()', () => {
    it('should create FilePath from absolute path', () => {
      const path = FilePath.fromAbsolute('/path/to/file.wav');
      expect(path.toAbsolutePath()).toBe('/path/to/file.wav');
    });

    it('should throw error if path has file:// prefix', () => {
      expect(() => FilePath.fromAbsolute('file:///path/to/file.wav')).toThrow(
        'fromAbsolute expects path without file:// prefix'
      );
    });
  });

  describe('fromUri()', () => {
    it('should create FilePath from URI', () => {
      const path = FilePath.fromUri('file:///path/to/file.wav');
      expect(path.toUri()).toBe('file:///path/to/file.wav');
    });

    it('should throw error if path does not have file:// prefix', () => {
      expect(() => FilePath.fromUri('/path/to/file.wav')).toThrow(
        'fromUri expects URI with file:// prefix'
      );
    });
  });

  describe('toAbsolutePath()', () => {
    it('should return absolute path from URI', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.toAbsolutePath()).toBe('/path/to/file.wav');
    });

    it('should return absolute path as-is', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.toAbsolutePath()).toBe('/path/to/file.wav');
    });
  });

  describe('toUri()', () => {
    it('should add file:// prefix to absolute path', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.toUri()).toBe('file:///path/to/file.wav');
    });

    it('should return URI as-is', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.toUri()).toBe('file:///path/to/file.wav');
    });
  });

  describe('isUri()', () => {
    it('should return true for URI format', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.isUri()).toBe(true);
    });

    it('should return false for absolute path', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.isUri()).toBe(false);
    });
  });

  describe('getFilename()', () => {
    it('should extract filename from absolute path', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.getFilename()).toBe('file.wav');
    });

    it('should extract filename from URI', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.getFilename()).toBe('file.wav');
    });

    it('should return path as-is if no directory', () => {
      const path = FilePath.from('file.wav');
      expect(path.getFilename()).toBe('file.wav');
    });
  });

  describe('getBasename()', () => {
    it('should extract basename without extension', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.getBasename()).toBe('file');
    });

    it('should handle files with multiple dots', () => {
      const path = FilePath.from('/path/to/archive.tar.gz');
      expect(path.getBasename()).toBe('archive.tar');
    });

    it('should return filename if no extension', () => {
      const path = FilePath.from('/path/to/README');
      expect(path.getBasename()).toBe('README');
    });
  });

  describe('getDirectory()', () => {
    it('should extract directory from absolute path', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.getDirectory()).toBe('/path/to');
    });

    it('should extract directory from URI', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.getDirectory()).toBe('/path/to');
    });

    it('should return empty string if no directory', () => {
      const path = FilePath.from('file.wav');
      expect(path.getDirectory()).toBe('');
    });
  });

  describe('equals()', () => {
    it('should return true for equal absolute paths', () => {
      const path1 = FilePath.from('/path/to/file.wav');
      const path2 = FilePath.from('/path/to/file.wav');
      expect(path1.equals(path2)).toBe(true);
    });

    it('should return true for URI and absolute path pointing to same file', () => {
      const path1 = FilePath.from('file:///path/to/file.wav');
      const path2 = FilePath.from('/path/to/file.wav');
      expect(path1.equals(path2)).toBe(true);
    });

    it('should return false for different paths', () => {
      const path1 = FilePath.from('/path/to/file1.wav');
      const path2 = FilePath.from('/path/to/file2.wav');
      expect(path1.equals(path2)).toBe(false);
    });
  });

  describe('toString()', () => {
    it('should return raw path with file:// prefix', () => {
      const path = FilePath.from('file:///path/to/file.wav');
      expect(path.toString()).toBe('file:///path/to/file.wav');
    });

    it('should return raw path without file:// prefix', () => {
      const path = FilePath.from('/path/to/file.wav');
      expect(path.toString()).toBe('/path/to/file.wav');
    });
  });
});
