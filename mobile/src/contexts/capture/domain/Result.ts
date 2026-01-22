/**
 * Result Pattern - No Exceptions
 *
 * Based on Architecture Decision Document section 9.5
 */

export enum RepositoryResultType {
  SUCCESS = 'success',
  NOT_FOUND = 'not_found',
  DATABASE_ERROR = 'database_error',
  VALIDATION_ERROR = 'validation_error',
}

export type RepositoryResult<T> = {
  type: RepositoryResultType;
  data?: T;
  error?: string;
};

export function success<T>(data: T): RepositoryResult<T> {
  return {
    type: RepositoryResultType.SUCCESS,
    data,
  };
}

export function notFound<T>(error?: string): RepositoryResult<T> {
  return {
    type: RepositoryResultType.NOT_FOUND,
    error: error ?? 'Resource not found',
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
