/**
 * ExpoFileSystem - Concrete implementation using expo-file-system (Modern API)
 *
 * Adapter for expo-file-system SDK 54+ that implements IFileSystem interface.
 * Uses the modern object-based API (File, Directory, Paths) introduced in SDK 54.
 *
 * Tech Stack:
 * - Node.js: 22.x
 * - Expo SDK: 54
 * - expo-file-system: 19.x (Modern API)
 *
 * TESTING EXCEPTION:
 * This adapter does NOT have unit tests because:
 * 1. It's a thin wrapper around expo-file-system with no business logic
 * 2. Testing it would mean testing expo-file-system itself (3rd party library)
 * 3. Integration tests cover the filesystem behavior via AudioConversionService
 * 4. The IFileSystem interface allows easy mocking in dependent services
 *
 * This follows the hexagonal architecture pattern where adapters are simple
 * and the core domain logic (AudioConversionService) is thoroughly tested.
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { File, Directory, Paths } from 'expo-file-system';
import type { IFileSystem, FileInfo } from '../ports/IFileSystem';

@injectable()
export class ExpoFileSystem implements IFileSystem {
  getCacheDirectory(): string | null {
    return Paths.cache ?? null;
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    const file = new File(path);
    const info = file.info();

    return {
      exists: info.exists,
      isDirectory: info.type === 'directory',
      size: info.size,
      uri: path,
    };
  }

  async writeFile(path: string, content: string, encoding: 'base64' | 'utf8'): Promise<void> {
    const file = new File(path);

    if (encoding === 'base64') {
      // Decode base64 to binary for the modern API
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await file.write(bytes);
    } else {
      await file.write(content);
    }
  }

  async deleteFile(path: string, options?: { idempotent?: boolean }): Promise<void> {
    const file = new File(path);

    if (options?.idempotent) {
      // Only delete if exists
      const info = file.info();
      if (info.exists) {
        await file.delete();
      }
    } else {
      await file.delete();
    }
  }

  async makeDirectory(path: string, options?: { intermediates?: boolean }): Promise<void> {
    const dir = new Directory(path);
    await dir.create({ intermediates: options?.intermediates });
  }
}
