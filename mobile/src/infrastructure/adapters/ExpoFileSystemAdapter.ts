/**
 * Expo File System Adapter - IFileSystem Implementation
 *
 * Wraps expo-file-system SDK to implement IFileSystem interface.
 * Provides file system operations using Expo SDK 54+ MODERN API.
 *
 * Uses Result<> pattern - no exceptions thrown from public methods.
 *
 * Tech Stack:
 * - Node.js: 22.x
 * - Expo SDK: 54
 * - expo-file-system: 19.x (Modern API - File, Directory, Paths)
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 *
 * Docs: https://docs.expo.dev/versions/latest/sdk/filesystem/
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { File } from 'expo-file-system';
import { type IFileSystem } from '../../contexts/capture/domain/IFileSystem';
import {
  type RepositoryResult,
  success,
  validationError,
  databaseError,
} from '../../contexts/capture/domain/Result';

@injectable()
export class ExpoFileSystemAdapter implements IFileSystem {
  /**
   * Write content to file
   *
   * Uses modern expo-file-system File API
   */
  async writeFile(path: string, content: string): Promise<RepositoryResult<void>> {
    try {
      const file = new File(path);
      await file.write(content);
      return success(undefined as void);
    } catch (error) {
      console.error('[ExpoFileSystemAdapter] Failed to write file:', error);
      return databaseError(
        error instanceof Error ? error.message : 'Failed to write file'
      );
    }
  }

  /**
   * Read content from file
   *
   * Uses modern expo-file-system File API
   */
  async readFile(path: string): Promise<RepositoryResult<string>> {
    try {
      const file = new File(path);
      const content = await file.text();
      return success(content);
    } catch (error) {
      console.error('[ExpoFileSystemAdapter] Failed to read file:', error);
      return databaseError(
        error instanceof Error ? error.message : 'Failed to read file'
      );
    }
  }

  /**
   * Check if file exists
   *
   * Uses modern expo-file-system File API
   */
  async fileExists(path: string): Promise<RepositoryResult<boolean>> {
    try {
      const file = new File(path);
      const info = file.info();
      return success(info.exists);
    } catch (error) {
      console.error('[ExpoFileSystemAdapter] Failed to check file existence:', error);
      // Non-fatal error - return false instead of error
      return success(false);
    }
  }

  /**
   * Delete file
   *
   * Uses modern expo-file-system File API
   */
  async deleteFile(path: string): Promise<RepositoryResult<void>> {
    try {
      // Check if file exists first
      const file = new File(path);
      const info = file.info();
      if (!info.exists) {
        return validationError('File does not exist');
      }

      await file.delete();
      return success(undefined as void);
    } catch (error) {
      console.error('[ExpoFileSystemAdapter] Failed to delete file:', error);
      return databaseError(
        error instanceof Error ? error.message : 'Failed to delete file'
      );
    }
  }
}
