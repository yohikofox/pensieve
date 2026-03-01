/**
 * Manual mock for expo-file-system
 *
 * Provides Jest-compatible mocks for FileSystem operations
 * used in tests that require file download, storage, and management.
 *
 * Includes the Expo SDK 54 File class (modern API).
 */

export const documentDirectory = 'file:///mock/documents/';
export const cacheDirectory = 'file:///mock/cache/';

export class File {
  constructor(public readonly uri: string) {}

  info(): { exists: boolean; size?: number; modificationTime?: number } {
    return { exists: false };
  }
}

// Explicit getter via Object.defineProperty so jest.spyOn can spy on it
// (Babel legacy decorator mode compiles class getters as instance assignments,
// not as prototype property descriptors — this ensures configurable: true)
Object.defineProperty(File.prototype, 'exists', {
  get(): boolean {
    return false;
  },
  enumerable: true,
  configurable: true,
});

export const downloadAsync = jest.fn();
export const getInfoAsync = jest.fn();
export const makeDirectoryAsync = jest.fn();
export const deleteAsync = jest.fn();
export const readAsStringAsync = jest.fn();
export const writeAsStringAsync = jest.fn();
export const moveAsync = jest.fn();
export const copyAsync = jest.fn();

export const createDownloadResumable = jest.fn((url, fileUri, options, callback) => ({
  downloadAsync: jest.fn(),
  pauseAsync: jest.fn(),
  resumeAsync: jest.fn(),
  savable: jest.fn(),
}));

const expoFileSystem = {
  documentDirectory,
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
  makeDirectoryAsync,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  moveAsync,
  copyAsync,
  createDownloadResumable,
};

export default expoFileSystem;
