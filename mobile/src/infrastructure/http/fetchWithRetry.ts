/**
 * fetchWithRetry - HTTP Client Wrapper
 *
 * Implements retry logic with Fibonacci backoff and configurable timeout.
 * Replaces axios to reduce bundle size (-13 KB).
 *
 * ADR-025: HTTP Client Strategy - fetch natif + wrapper custom
 *
 * Features:
 * - Automatic retry on 5xx, 408, 429, network errors
 * - Fibonacci backoff (1s, 1s, 2s, 3s, 5s...)
 * - Configurable timeout with AbortController
 * - TypeScript strict typing
 * - Zero external dependencies
 */

export interface FetchOptions extends RequestInit {
  /**
   * Number of retry attempts (default: 3)
   */
  retries?: number;

  /**
   * Timeout in milliseconds (default: 30000 = 30s)
   */
  timeout?: number;

  /**
   * Callback invoked on each retry attempt
   * @param attempt - Current attempt number (1-based)
   * @param error - Error that triggered the retry
   */
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Network errors that should trigger a retry
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // fetch throws TypeError for network errors
    return true;
  }

  if (error && typeof error === 'object' && 'name' in error) {
    // AbortError when timeout is triggered
    return error.name === 'AbortError';
  }

  return false;
}

/**
 * HTTP status codes that should trigger a retry
 */
function isRetryableStatus(status: number): boolean {
  return (
    status >= 500 || // Server errors (500, 502, 503, 504...)
    status === 408 || // Request Timeout
    status === 429 // Too Many Requests
  );
}

/**
 * Fibonacci sequence for backoff delays
 * Returns delay in milliseconds
 */
function fibonacci(n: number): number {
  if (n <= 1) return 1000; // 1 second
  if (n === 2) return 1000; // 1 second
  if (n === 3) return 2000; // 2 seconds
  if (n === 4) return 3000; // 3 seconds
  if (n === 5) return 5000; // 5 seconds
  return 8000; // 8 seconds for n >= 6
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with automatic retry and timeout
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with retry/timeout extensions
 * @returns Promise<Response>
 *
 * @throws {TypeError} - Network error after all retries exhausted
 * @throws {Error} - HTTP error (4xx) or timeout after all retries exhausted
 *
 * @example
 * ```typescript
 * const response = await fetchWithRetry('https://api.example.com/data', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ foo: 'bar' }),
 *   timeout: 30000,
 *   retries: 3,
 *   onRetry: (attempt, error) => {
 *     console.log(`Retry attempt ${attempt}: ${error.message}`);
 *   }
 * });
 *
 * if (!response.ok) {
 *   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 * }
 *
 * const data = await response.json();
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 3, timeout = 30000, onRetry, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Retry on 5xx or specific retryable status codes
    if (!response.ok && retries > 0 && isRetryableStatus(response.status)) {
      const delay = fibonacci(3 - retries + 1);
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);

      onRetry?.(3 - retries + 1, error);

      await sleep(delay);
      return fetchWithRetry(url, { ...options, retries: retries - 1 });
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Retry on network errors (TypeError) or timeout (AbortError)
    if (retries > 0 && isNetworkError(error)) {
      const delay = fibonacci(3 - retries + 1);

      onRetry?.(3 - retries + 1, error as Error);

      await sleep(delay);
      return fetchWithRetry(url, { ...options, retries: retries - 1 });
    }

    // All retries exhausted, throw original error
    throw error;
  }
}
