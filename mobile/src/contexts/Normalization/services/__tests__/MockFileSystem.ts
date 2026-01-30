/**
 * MockFileSystem - Simple test double for IFileSystem
 *
 * Allows full control over filesystem behavior in tests without
 * depending on expo-file-system mocks.
 */

import type { IFileSystem, FileInfo } from '../../ports/IFileSystem';

export class MockFileSystem implements IFileSystem {
  private cacheDir: string | null = '/test/cache';
  private files: Map<string, string> = new Map();
  private fileInfos: Map<string, FileInfo> = new Map();

  // Spy methods for test assertions
  public writeFileSpy = jest.fn();
  public deleteFileSpy = jest.fn();
  public makeDirectorySpy = jest.fn();

  getCacheDirectory(): string | null {
    return this.cacheDir;
  }

  setCacheDirectory(dir: string | null): void {
    this.cacheDir = dir;
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    if (this.fileInfos.has(path)) {
      return this.fileInfos.get(path)!;
    }
    // Default: file exists
    return { exists: true, size: 1000 };
  }

  setFileInfo(path: string, info: FileInfo): void {
    this.fileInfos.set(path, info);
  }

  async writeFile(path: string, content: string, encoding: 'base64' | 'utf8'): Promise<void> {
    this.writeFileSpy(path, content, encoding);
    this.files.set(path, content);
  }

  async deleteFile(path: string, options?: { idempotent?: boolean }): Promise<void> {
    this.deleteFileSpy(path, options);
    this.files.delete(path);
  }

  async makeDirectory(path: string, options?: { intermediates?: boolean }): Promise<void> {
    this.makeDirectorySpy(path, options);
  }

  // Test helpers
  getWrittenFile(path: string): string | undefined {
    return this.files.get(path);
  }

  reset(): void {
    this.cacheDir = '/test/cache';
    this.files.clear();
    this.fileInfos.clear();
    this.writeFileSpy.mockClear();
    this.deleteFileSpy.mockClear();
    this.makeDirectorySpy.mockClear();
  }
}
