/**
 * Result<T> — Type de retour unifié pour les opérations critiques du backend
 *
 * ADR-023 : Stratégie Unifiée de Gestion des Erreurs
 * Story 12.4 : Suppression applicative des cascades TypeORM
 *
 * Usage :
 * ```typescript
 * async myOperation(): Promise<Result<void>> {
 *   try {
 *     await dataSource.transaction(async (manager) => { ... });
 *     return success(undefined);
 *   } catch (error) {
 *     return transactionError(`Failed: ${error.message}`);
 *   }
 * }
 * ```
 */

export type ResultType =
  | 'success'
  | 'not_found'
  | 'transaction_error'
  | 'validation_error'
  | 'unknown_error';

export interface Result<T> {
  type: ResultType;
  data?: T;
  error?: string;
}

export const success = <T>(data: T): Result<T> => ({
  type: 'success',
  data,
});

export const notFound = (error: string): Result<never> => ({
  type: 'not_found',
  error,
});

export const transactionError = (error: string): Result<never> => ({
  type: 'transaction_error',
  error,
});

export const validationError = (error: string): Result<never> => ({
  type: 'validation_error',
  error,
});

export const isSuccess = <T>(
  result: Result<T>,
): result is Result<T> & { data: T } => result.type === 'success';

export const isError = <T>(result: Result<T>): boolean =>
  result.type !== 'success';
