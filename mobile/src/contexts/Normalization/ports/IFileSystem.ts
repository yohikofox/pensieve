/**
 * IFileSystem - Filesystem abstraction for dependency injection
 *
 * Allows AudioConversionService to be tested without depending on expo-file-system mocks.
 * Follows Dependency Inversion Principle (SOLID).
 */

export interface FileInfo {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  uri?: string;
}

export interface IFileSystem {
  /**
   * Get cache directory path (may include file:// prefix)
   */
  getCacheDirectory(): string | null;

  /**
   * Get file information
   */
  getFileInfo(path: string): Promise<FileInfo>;

  /**
   * Write string to file
   */
  writeFile(path: string, content: string, encoding: 'base64' | 'utf8'): Promise<void>;

  /**
   * Delete file
   */
  deleteFile(path: string, options?: { idempotent?: boolean }): Promise<void>;

  /**
   * Create directory
   */
  makeDirectory(path: string, options?: { intermediates?: boolean }): Promise<void>;
}
