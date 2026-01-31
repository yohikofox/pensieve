/**
 * RetryLimitService Unit Tests
 *
 * Tests retry rate limiting logic with 3 retries per 20-minute window.
 *
 * @see RetryLimitService.ts
 * @see Story 2.8 - Bouton Retry pour Transcriptions en Échec
 */

import { RetryLimitService } from '../RetryLimitService';

// Mock Capture type
interface MockCapture {
  id: string;
  retryCount: number;
  retryWindowStartAt: Date | null;
  lastRetryAt: Date | null;
}

describe('RetryLimitService', () => {
  let service: RetryLimitService;

  beforeEach(() => {
    service = new RetryLimitService();
  });

  describe('canRetry', () => {
    it('should allow retry when no retries have been attempted yet', () => {
      const capture: MockCapture = {
        id: 'test-1',
        retryCount: 0,
        retryWindowStartAt: null,
        lastRetryAt: null,
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it('should allow retry when retry count is less than 3 within window', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

      const capture: MockCapture = {
        id: 'test-2',
        retryCount: 2,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 5 * 60 * 1000),
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it('should deny retry when 3 retries exhausted within 20-minute window', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago

      const capture: MockCapture = {
        id: 'test-3',
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 2 * 60 * 1000),
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(false);
      expect(result.remainingTime).toBe(10); // 10 minutes remaining
    });

    it('should allow retry when 20-minute window has elapsed', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 25 * 60 * 1000); // 25 minutes ago (> 20)

      const capture: MockCapture = {
        id: 'test-4',
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 22 * 60 * 1000),
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it('should calculate correct remaining time', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago

      const capture: MockCapture = {
        id: 'test-5',
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 5 * 60 * 1000),
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(false);
      expect(result.remainingTime).toBe(5); // 20 - 15 = 5 minutes remaining
    });

    it('should handle edge case: exactly at 20-minute mark', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 20 * 60 * 1000); // Exactly 20 minutes ago

      const capture: MockCapture = {
        id: 'test-6',
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 1 * 60 * 1000),
      };

      const result = service.canRetry(capture);

      // Should allow retry when exactly at 20 minutes (window elapsed)
      expect(result.allowed).toBe(true);
    });

    it('should handle capture with retryWindowStartAt but zero retries', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 5 * 60 * 1000);

      const capture: MockCapture = {
        id: 'test-7',
        retryCount: 0,
        retryWindowStartAt: windowStart,
        lastRetryAt: null,
      };

      const result = service.canRetry(capture);

      expect(result.allowed).toBe(true);
    });
  });

  describe('constants', () => {
    it('should have correct retry limit constant', () => {
      expect(RetryLimitService.RETRY_LIMIT).toBe(3);
    });

    it('should have correct window duration constant', () => {
      expect(RetryLimitService.WINDOW_DURATION_MS).toBe(20 * 60 * 1000);
    });
  });
});
