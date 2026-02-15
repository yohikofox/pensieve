/**
 * Upload Retry Logic Tests
 *
 * Story 6.2 - Task 6.5: Exponential backoff retry logic for audio uploads
 *
 * Différence avec Fibonacci sync retry:
 * - Exponential: Pour uploads (charge serveur plus constante)
 * - Fibonacci: Pour sync (récupération réseau rapide)
 */

import {
  getExponentialBackoffDelay,
  retryWithExponentialBackoff,
  shouldRetryUploadError,
} from '../retry-logic';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';
import type { RepositoryResult } from '@/contexts/shared/domain/Result';

describe('Upload Retry Logic', () => {
  describe('getExponentialBackoffDelay()', () => {
    it('should calculate exponential backoff delays', () => {
      // Base 2 seconds, exponent 2^attemptCount (disable jitter for exact values)
      expect(getExponentialBackoffDelay(0, false)).toBe(2000); // 2 * 2^0 = 2s
      expect(getExponentialBackoffDelay(1, false)).toBe(4000); // 2 * 2^1 = 4s
      expect(getExponentialBackoffDelay(2, false)).toBe(8000); // 2 * 2^2 = 8s
      expect(getExponentialBackoffDelay(3, false)).toBe(16000); // 2 * 2^3 = 16s
      expect(getExponentialBackoffDelay(4, false)).toBe(32000); // 2 * 2^4 = 32s
    });

    it('should cap delay at 5 minutes maximum', () => {
      const maxDelay = 5 * 60 * 1000; // 5 minutes

      expect(getExponentialBackoffDelay(10, false)).toBe(maxDelay); // 2^10 = 1024s > 300s
      expect(getExponentialBackoffDelay(20, false)).toBe(maxDelay);
      expect(getExponentialBackoffDelay(100, false)).toBe(maxDelay);
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays = [];
      for (let i = 0; i < 100; i++) {
        delays.push(getExponentialBackoffDelay(3, true));
      }

      // All delays should be within ±20% of base delay
      const baseDelay = 16000;
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(baseDelay * 0.8);
        expect(delay).toBeLessThanOrEqual(baseDelay * 1.2);
      });

      // Ensure variance (not all same value)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(10); // At least 10 different values
    });

    it('should return exact delay when jitter disabled', () => {
      const delay1 = getExponentialBackoffDelay(2, false);
      const delay2 = getExponentialBackoffDelay(2, false);

      expect(delay1).toBe(8000);
      expect(delay2).toBe(8000);
      expect(delay1).toBe(delay2);
    });
  });

  describe('shouldRetryUploadError()', () => {
    it('should retry network errors', () => {
      expect(
        shouldRetryUploadError({
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Connection timeout',
        }),
      ).toBe(true);
    });

    it('should NOT retry validation errors', () => {
      expect(
        shouldRetryUploadError({
          type: RepositoryResultType.VALIDATION_ERROR,
          error: 'Invalid file format',
        }),
      ).toBe(false);
    });

    it('should NOT retry database errors', () => {
      expect(
        shouldRetryUploadError({
          type: RepositoryResultType.DATABASE_ERROR,
          error: 'Database connection lost',
        }),
      ).toBe(false);
    });

    it('should NOT retry not found errors', () => {
      expect(
        shouldRetryUploadError({
          type: RepositoryResultType.NOT_FOUND,
          error: 'Upload not found',
        }),
      ).toBe(false);
    });

    it('should NOT retry success results', () => {
      expect(
        shouldRetryUploadError({
          type: RepositoryResultType.SUCCESS,
          data: { uploaded: true },
        }),
      ).toBe(false);
    });
  });

  describe('retryWithExponentialBackoff()', () => {
    // Mock operation to retry
    let operation: jest.Mock<Promise<RepositoryResult<string>>>;
    let attemptCount: number;

    beforeEach(() => {
      attemptCount = 0;
      operation = jest.fn();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should succeed on first attempt if operation succeeds', async () => {
      operation.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: 'uploaded',
      });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        onRetry: (attempt) => {
          attemptCount = attempt;
        },
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toBe('uploaded');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(attemptCount).toBe(0); // No retries
    });

    it('should retry on network errors up to maxRetries', async () => {
      operation
        .mockResolvedValueOnce({
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Timeout',
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Timeout',
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: 'uploaded',
        });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        onRetry: (attempt) => {
          attemptCount = attempt;
        },
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(operation).toHaveBeenCalledTimes(3); // 2 retries + 1 success
      expect(attemptCount).toBe(2); // onRetry called twice
    });

    it('should stop retrying after maxRetries exhausted', async () => {
      operation.mockResolvedValue({
        type: RepositoryResultType.NETWORK_ERROR,
        error: 'Persistent timeout',
      });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        onRetry: (attempt) => {
          attemptCount = attempt;
        },
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.type).toBe(RepositoryResultType.NETWORK_ERROR);
      expect(result.error).toContain('Persistent timeout');
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(attemptCount).toBe(3);
    });

    it('should NOT retry non-retryable errors (validation)', async () => {
      operation.mockResolvedValue({
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'Invalid file',
      });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
      });

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.type).toBe(RepositoryResultType.VALIDATION_ERROR);
      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should use exponential backoff delays between retries', async () => {
      const delays: number[] = [];

      operation.mockImplementation(async () => {
        delays.push(Date.now());
        return {
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Timeout',
        };
      });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        jitter: false, // Disable jitter for predictable delays
      });

      await jest.runAllTimersAsync();
      await resultPromise;

      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(delays.length).toBe(4);

      // Check delays between attempts (exponential: 2s, 4s, 8s)
      const delay1 = delays[1] - delays[0];
      const delay2 = delays[2] - delays[1];
      const delay3 = delays[3] - delays[2];

      expect(delay1).toBe(2000); // 2 * 2^0
      expect(delay2).toBe(4000); // 2 * 2^1
      expect(delay3).toBe(8000); // 2 * 2^2
    });

    it('should call onRetry callback with attempt number', async () => {
      const retryAttempts: number[] = [];

      operation
        .mockResolvedValueOnce({
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Fail 1',
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.NETWORK_ERROR,
          error: 'Fail 2',
        })
        .mockResolvedValueOnce({
          type: RepositoryResultType.SUCCESS,
          data: 'uploaded',
        });

      const resultPromise = retryWithExponentialBackoff(operation, {
        maxRetries: 3,
        onRetry: (attempt) => {
          retryAttempts.push(attempt);
        },
      });

      await jest.runAllTimersAsync();
      await resultPromise;

      expect(retryAttempts).toEqual([1, 2]); // Two retries (attempt 1, attempt 2)
    });
  });
});
