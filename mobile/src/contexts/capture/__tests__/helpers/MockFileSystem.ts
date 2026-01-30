/**
 * MockFileSystem - Test Double for IFileSystem (Capture context)
 *
 * Simple in-memory implementation of IFileSystem for unit tests.
 * Provides full control over filesystem behavior without depending on expo-file-system mocks.
 *
 * Tech Stack: Node 22, Expo SDK 54
 * Architecture: Hexagonal (Ports & Adapters)
 */

import { type IFileSystem } from '../../domain/IFileSystem';
import { type RepositoryResult, RepositoryResultType } from '../../domain/Result';

export class MockFileSystem implements IFileSystem {
  // In-memory file storage
  private files: Map<string, string> = new Map();

  // Spy methods for test assertions
  public writeFileSpy = jest.fn();
  public readFileSpy = jest.fn();
  public deleteFileSpy = jest.fn();
  public fileExistsSpy = jest.fn();

  async writeFile(path: string, content: string): Promise<RepositoryResult<void>> {
    this.writeFileSpy(path, content);
    this.files.set(path, content);
    return {
      type: RepositoryResultType.SUCCESS,
      data: undefined,
    };
  }

  async readFile(path: string): Promise<RepositoryResult<string>> {
    this.readFileSpy(path);
    const content = this.files.get(path);
    if (content === undefined) {
      return {
        type: RepositoryResultType.DATABASE_ERROR,
        error: 'File not found',
      };
    }
    return {
      type: RepositoryResultType.SUCCESS,
      data: content,
    };
  }

  async fileExists(path: string): Promise<RepositoryResult<boolean>> {
    this.fileExistsSpy(path);
    return {
      type: RepositoryResultType.SUCCESS,
      data: this.files.has(path),
    };
  }

  async deleteFile(path: string): Promise<RepositoryResult<void>> {
    this.deleteFileSpy(path);
    this.files.delete(path);
    return {
      type: RepositoryResultType.SUCCESS,
      data: undefined,
    };
  }

  // Test helpers
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  reset(): void {
    this.files.clear();
    this.writeFileSpy.mockClear();
    this.readFileSpy.mockClear();
    this.deleteFileSpy.mockClear();
    this.fileExistsSpy.mockClear();
  }
}
