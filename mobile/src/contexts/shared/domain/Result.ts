/**
 * Result Pattern - No Exceptions
 *
 * Based on Architecture Decision Document section 9.5
 */

export enum RepositoryResultType {
  SUCCESS = "success",
  NOT_FOUND = "not_found",
  DATABASE_ERROR = "database_error",
  VALIDATION_ERROR = "validation_error",
  NETWORK_ERROR = "network_error",
  AUTH_ERROR = "auth_error",
  BUSINESS_ERROR = "business_error",
  UNKNOWN_ERROR = "unknown_error",
}

export type RepositoryResult<T> = {
  type: RepositoryResultType;
  data?: T;
  error?: string;
  retryable?: boolean;
};

/** Alias canonique — utiliser Result<T> pour tout nouveau code (ADR-023) */
export type Result<T> = RepositoryResult<T>;
/** Alias canonique — utiliser ResultType pour tout nouveau code (ADR-023) */
export type ResultType = RepositoryResultType;

export function success<T>(data: T): RepositoryResult<T> {
  return {
    type: RepositoryResultType.SUCCESS,
    data,
  };
}

export function notFound<T>(error?: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.NOT_FOUND,
    error: error ?? "Resource not found",
  };
}

export function databaseError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.DATABASE_ERROR,
    error,
  };
}

export function validationError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.VALIDATION_ERROR,
    error,
  };
}

export function networkError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.NETWORK_ERROR,
    error,
  };
}

export function authError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.AUTH_ERROR,
    error,
  };
}

export function businessError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.BUSINESS_ERROR,
    error,
  };
}

export function unknownError<T>(error: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.UNKNOWN_ERROR,
    error,
  };
}
