/**
 * PATTERN: Result Pattern (ADR-023)
 *
 * Source: src/contexts/shared/domain/Result.ts
 *
 * RÈGLE: Toute méthode qui peut échouer DOIT retourner RepositoryResult<T>.
 * JAMAIS throw, JAMAIS retourner null pour signaler une erreur.
 *
 * Les imports viennent TOUJOURS depuis shared (pas depuis le context local).
 */

import {
  type RepositoryResult,
  RepositoryResultType,
  success,
  notFound,
  databaseError,
  validationError,
  businessError,
} from '../src/contexts/shared/domain/Result';

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : retourner un Result
// ─────────────────────────────────────────────────────────────────────────────

async function findEntity(id: string): Promise<RepositoryResult<string>> {
  try {
    const row = {} as { value: string } | undefined; // simulation DB

    if (!row) {
      return notFound(`Entity not found: ${id}`);
    }

    return success(row.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return databaseError(`Failed to find entity: ${message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ CORRECT : consommer un Result avec switch exhaustif
// ─────────────────────────────────────────────────────────────────────────────

async function consumeResult() {
  const result = await findEntity('abc');

  switch (result.type) {
    case RepositoryResultType.SUCCESS:
      console.log('Data:', result.data);
      break;
    case RepositoryResultType.NOT_FOUND:
      console.warn('Not found:', result.error);
      break;
    case RepositoryResultType.DATABASE_ERROR:
      console.error('DB error:', result.error);
      break;
    default:
      console.error('Unexpected result type:', result.type);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ❌ INTERDIT : throw dans un use case ou repository
// ─────────────────────────────────────────────────────────────────────────────

async function wrongWay(id: string): Promise<string> {
  // ❌ JAMAIS ça
  throw new Error('Not found');
}

// ─────────────────────────────────────────────────────────────────────────────
// Types d'erreur disponibles
// ─────────────────────────────────────────────────────────────────────────────
//
// success(data)          → RepositoryResultType.SUCCESS
// notFound(msg?)         → RepositoryResultType.NOT_FOUND
// databaseError(msg)     → RepositoryResultType.DATABASE_ERROR
// validationError(msg)   → RepositoryResultType.VALIDATION_ERROR
// networkError(msg)      → RepositoryResultType.NETWORK_ERROR
// authError(msg)         → RepositoryResultType.AUTH_ERROR
// businessError(msg)     → RepositoryResultType.BUSINESS_ERROR
// unknownError(msg)      → RepositoryResultType.UNKNOWN_ERROR
