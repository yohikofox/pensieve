/**
 * Retry Logic - Fibonacci Backoff
 * Story 6.1 - Task 3.5: Fibonacci backoff retry logic
 *
 * Implements ADR-009.5: Fibonacci sequence for gradual backoff
 * Pattern: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55s] with 5min cap
 *
 * Rationale:
 * - Network hiccup: Fast recovery (1s, 1s, 2s)
 * - Backend down: Gradual backoff without stampede
 * - 5min cap prevents infinite wait
 */

// Fibonacci delays in seconds
const FIBONACCI_DELAYS = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
const MAX_DELAY_SECONDS = 5 * 60; // 5 minutes

/**
 * Get retry delay based on attempt count
 * @param attemptCount Number of retry attempts (0-indexed)
 * @returns Delay in milliseconds
 */
export function getRetryDelay(attemptCount: number): number {
  const index = Math.min(attemptCount, FIBONACCI_DELAYS.length - 1);
  const delaySeconds = FIBONACCI_DELAYS[index];
  const cappedDelay = Math.min(delaySeconds, MAX_DELAY_SECONDS);

  return cappedDelay * 1000; // Convert to milliseconds
}

/**
 * Sleep for specified duration
 * @param ms Duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with Fibonacci backoff
 *
 * @param fn Function to retry
 * @param maxAttempts Maximum retry attempts (default: 10 = full Fibonacci sequence)
 * @param onRetry Optional callback for retry events
 * @returns Result from successful function call
 */
export async function retryWithFibonacci<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 10,
  onRetry?: (attempt: number, delay: number) => void,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on last attempt
      if (attempt === maxAttempts - 1) {
        break;
      }

      const delay = getRetryDelay(attempt);

      if (onRetry) {
        onRetry(attempt + 1, delay);
      }

      console.log(
        `[Retry] Attempt ${attempt + 1}/${maxAttempts} failed. Retrying in ${delay / 1000}s...`,
      );

      await sleep(delay);
    }
  }

  // All attempts failed
  throw lastError || new Error('Retry failed');
}

/**
 * Check if error is retryable
 * Non-retryable errors: auth failures, client errors (4xx except 429)
 */
export function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error?.message?.includes('Network request failed')) {
    return true;
  }

  // Timeout errors are retryable
  if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
    return true;
  }

  // HTTP status codes
  if (error?.response?.status) {
    const status = error.response.status;

    // 5xx server errors are retryable
    if (status >= 500) {
      return true;
    }

    // 429 Too Many Requests is retryable
    if (status === 429) {
      return true;
    }

    // 408 Request Timeout is retryable
    if (status === 408) {
      return true;
    }

    // 4xx client errors (except above) are NOT retryable
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Unknown errors: retry by default (conservative approach)
  return true;
}
