/**
 * Expo File System Adapter - IFileSystem Implementation
 *
 * Wraps expo-file-system SDK to implement IFileSystem interface.
 * Provides file system operations using Expo SDK 54+.
 *
 * Uses Result<> pattern - no exceptions thrown from public methods.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 *
 * Docs: https://docs.expo.dev/versions/latest/sdk/filesystem/
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import * as FileSystem from 'expo-file-system/legacy';
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
   * Uses expo-file-system writeAsStringAsync
   */
  async writeFile(path: string, content: string): Promise<RepositoryResult<void>> {
    try {
      await FileSystem.writeAsStringAsync(path, content);
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
   * Uses expo-file-system readAsStringAsync
   */
  async readFile(path: string): Promise<RepositoryResult<string>> {
    try {
      const content = await FileSystem.readAsStringAsync(path);
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
   * Uses expo-file-system getInfoAsync
   */
  async fileExists(path: string): Promise<RepositoryResult<boolean>> {
    try {
      const info = await FileSystem.getInfoAsync(path);
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
   * Uses expo-file-system deleteAsync
   */
  async deleteFile(path: string): Promise<RepositoryResult<void>> {
    try {
      // Check if file exists first
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        return validationError('File does not exist');
      }

      await FileSystem.deleteAsync(path);
      return success(undefined as void);
    } catch (error) {
      console.error('[ExpoFileSystemAdapter] Failed to delete file:', error);
      return databaseError(
        error instanceof Error ? error.message : 'Failed to delete file'
      );
    }
  }
}
