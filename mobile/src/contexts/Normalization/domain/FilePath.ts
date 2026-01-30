/**
 * FilePath Value Object
 *
 * Encapsulates file path logic with support for:
 * - Absolute paths: /path/to/file.wav
 * - URI format: file:///path/to/file.wav
 *
 * Prevents bugs related to string manipulation of file paths.
 */
export class FilePath {
  private readonly path: string;

  private constructor(path: string) {
    this.path = path;
  }

  /**
   * Create FilePath from any string (with or without file:// prefix)
   */
  static from(path: string): FilePath {
    if (!path) {
      throw new Error('FilePath cannot be created from empty string');
    }
    return new FilePath(path);
  }

  /**
   * Create FilePath from absolute path (without file:// prefix)
   */
  static fromAbsolute(absolutePath: string): FilePath {
    if (absolutePath.startsWith('file://')) {
      throw new Error('fromAbsolute expects path without file:// prefix');
    }
    return new FilePath(absolutePath);
  }

  /**
   * Create FilePath from URI (with file:// prefix)
   */
  static fromUri(uri: string): FilePath {
    if (!uri.startsWith('file://')) {
      throw new Error('fromUri expects URI with file:// prefix');
    }
    return new FilePath(uri);
  }

  /**
   * Get absolute path (without file:// prefix)
   * Example: /path/to/file.wav
   */
  toAbsolutePath(): string {
    if (this.path.startsWith('file://')) {
      return this.path.replace('file://', '');
    }
    return this.path;
  }

  /**
   * Get URI format (with file:// prefix)
   * Example: file:///path/to/file.wav
   */
  toUri(): string {
    if (this.path.startsWith('file://')) {
      return this.path;
    }
    return `file://${this.path}`;
  }

  /**
   * Get raw path as-is (may or may not have file:// prefix)
   */
  toString(): string {
    return this.path;
  }

  /**
   * Check if path has file:// prefix
   */
  isUri(): boolean {
    return this.path.startsWith('file://');
  }

  /**
   * Get filename with extension
   * Example: /path/to/file.wav -> file.wav
   */
  getFilename(): string {
    const absolutePath = this.toAbsolutePath();
    const lastSlashIndex = absolutePath.lastIndexOf('/');
    return lastSlashIndex === -1
      ? absolutePath
      : absolutePath.substring(lastSlashIndex + 1);
  }

  /**
   * Get basename (filename without extension)
   * Example: /path/to/file.wav -> file
   */
  getBasename(): string {
    const filename = this.getFilename();
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
  }

  /**
   * Get directory path
   * Example: /path/to/file.wav -> /path/to
   */
  getDirectory(): string {
    const absolutePath = this.toAbsolutePath();
    const lastSlashIndex = absolutePath.lastIndexOf('/');
    return lastSlashIndex === -1 ? '' : absolutePath.substring(0, lastSlashIndex);
  }

  /**
   * Value Objects are equal if their paths are equal
   */
  equals(other: FilePath): boolean {
    if (!(other instanceof FilePath)) {
      return false;
    }
    // Compare normalized absolute paths
    return this.toAbsolutePath() === other.toAbsolutePath();
  }
}
