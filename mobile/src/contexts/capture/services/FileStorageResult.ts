/**
 * Result Pattern for FileStorageService
 *
 * Wraps expo-file-system operations to avoid throw/catch
 */

export enum FileStorageResultType {
  SUCCESS = "success",
  FILE_NOT_FOUND = "file_not_found",
  PERMISSION_DENIED = "permission_denied",
  STORAGE_ERROR = "storage_error",
}

export type FileStorageResult<T> = {
  type: FileStorageResultType;
  data?: T;
  error?: string;
};

export function storageSuccess<T>(data: T): FileStorageResult<T> {
  return {
    type: FileStorageResultType.SUCCESS,
    data,
  };
}

export function fileNotFound<T>(error?: string): FileStorageResult<T> {
  return {
    type: FileStorageResultType.FILE_NOT_FOUND,
    error: error ?? "File not found",
  };
}

export function permissionDenied<T>(error?: string): FileStorageResult<T> {
  return {
    type: FileStorageResultType.PERMISSION_DENIED,
    error: error ?? "Permission denied",
  };
}

export function storageError<T>(error: string): FileStorageResult<T> {
  return {
    type: FileStorageResultType.STORAGE_ERROR,
    error,
  };
}
