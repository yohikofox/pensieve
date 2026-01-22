/**
 * File System Interface
 *
 * Abstraction for file system operations.
 * Production implementation uses expo-file-system.
 * Test implementation uses in-memory mocks.
 *
 * Uses Result<> pattern - no exceptions thrown
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import { type RepositoryResult } from './Result';

export interface IFileSystem {
  /**
   * Write content to file
   * Optional method for file writing
   */
  writeFile?(path: string, content: string): Promise<RepositoryResult<void>>;

  /**
   * Read content from file
   * Optional method for file reading
   */
  readFile?(path: string): Promise<RepositoryResult<string>>;

  /**
   * Check if file exists
   * Optional method for file existence check
   */
  fileExists?(path: string): Promise<RepositoryResult<boolean>>;

  /**
   * Delete file
   * Optional method for file deletion
   */
  deleteFile?(path: string): Promise<RepositoryResult<void>>;
}
