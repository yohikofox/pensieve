/**
 * Upload Retry Logic - Exponential Backoff Strategy
 *
 * Story 6.2 - Task 6.5: Exponential backoff retry for audio uploads
 *
 * Différence avec Fibonacci (utilisé pour sync):
 * - Exponential: Meilleur pour uploads (charge serveur plus constante)
 * - Fibonacci: Meilleur pour récupération réseau rapide
 *
 * Exponential delays: 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s (capped at 5min)
 * Fibonacci delays: 1s, 1s, 2s, 3s, 5s, 8s, 13s, 21s, 34s, 55s (capped at 5min)
 *
 * @architecture Layer: Infrastructure - Retry logic for external services
 * @pattern Exponential backoff with jitter (prevent thundering herd)
 */

import type { RepositoryResult } from '@/contexts/shared/domain/Result';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';

/**
 * Calculate exponential backoff delay for upload retries
 *
 * Formula: baseDelay * 2^attemptCount (capped at maxDelay)
 * Base delay: 2 seconds
 * Max delay: 5 minutes
 *
 * @param attemptCount - Number of retry attempts (0-indexed)
 * @param jitter - Add random jitter ±20% to prevent thundering herd (default: true)
 * @returns Delay in milliseconds
 */
export function getExponentialBackoffDelay(attemptCount: number, jitter: boolean = true): number {
  const BASE_DELAY_MS = 2000; // 2 seconds
  const MAX_DELAY_MS = 5 * 60 * 1000; // 5 minutes

  // Calculate exponential delay: 2 * 2^attemptCount
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attemptCount);

  // Cap at max delay
  let delay = Math.min(exponentialDelay, MAX_DELAY_MS);

  // Add jitter ±20% to prevent thundering herd
  if (jitter) {
    const jitterFactor = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Determine if upload error is retryable
 *
 * Retryable errors:
 * - NETWORK_ERROR: Temporary network issues, timeout, connection refused
 *
 * Non-retryable errors:
 * - VALIDATION_ERROR: Invalid file format, file too large (client-side issue)
 * - DATABASE_ERROR: Local database issue (not server-side)
 * - NOT_FOUND: Upload entry doesn't exist (data inconsistency)
 * - SUCCESS: Operation succeeded
 *
 * @param result - Repository result to check
 * @returns True if error should be retried
 */
export function shouldRetryUploadError<T>(result: RepositoryResult<T>): boolean {
  return result.type === RepositoryResultType.NETWORK_ERROR;
}

/**
 * Retry options for exponential backoff
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 5)
   */
  maxRetries?: number;

  /**
   * Add random jitter to delays (default: true)
   */
  jitter?: boolean;

  /**
   * Callback invoked on each retry attempt
   * @param attempt - Current retry attempt number (1-indexed)
   */
  onRetry?: (attempt: number) => void;
}

/**
 * Retry operation with exponential backoff
 *
 * Automatically retries NETWORK_ERROR results using exponential backoff.
 * Non-retryable errors (VALIDATION_ERROR, DATABASE_ERROR) fail immediately.
 *
 * Example usage:
 * ```typescript
 * const result = await retryWithExponentialBackoff(
 *   () => uploadChunk(uploadId, chunkData, chunkIndex),
 *   {
 *     maxRetries: 5,
 *     onRetry: (attempt) => console.log(`Retry ${attempt}/5`)
 *   }
 * );
 * ```
 *
 * @param operation - Async operation to retry (returns RepositoryResult<T>)
 * @param options - Retry options (maxRetries, jitter, onRetry callback)
 * @returns Final result after retries (success or last error)
 */
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<RepositoryResult<T>>,
  options: RetryOptions = {},
): Promise<RepositoryResult<T>> {
  const { maxRetries = 5, jitter = true, onRetry } = options;

  let attemptCount = 0;
  let lastResult: RepositoryResult<T>;

  while (attemptCount <= maxRetries) {
    // Execute operation
    lastResult = await operation();

    // Success - return immediately
    if (lastResult.type === RepositoryResultType.SUCCESS) {
      return lastResult;
    }

    // Non-retryable error - fail immediately
    if (!shouldRetryUploadError(lastResult)) {
      return lastResult;
    }

    // Max retries exhausted - return last error
    if (attemptCount >= maxRetries) {
      return lastResult;
    }

    // Calculate delay and retry
    attemptCount++;
    const delay = getExponentialBackoffDelay(attemptCount - 1, jitter);

    // Notify retry callback
    if (onRetry) {
      onRetry(attemptCount);
    }

    // Wait before retry
    await sleep(delay);
  }

  // Fallback (should never reach here)
  return lastResult!;
}

/**
 * Sleep helper for retry delays
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
