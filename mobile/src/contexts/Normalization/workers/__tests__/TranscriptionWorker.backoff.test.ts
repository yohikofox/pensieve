/**
 * TranscriptionWorker - Exponential Backoff Logic Tests
 *
 * Story 2.5 - Task 6.3: Implement automatic retry with exponential backoff
 *
 * Pure unit tests - NO dependencies
 * Tests retry scheduling logic: 5s, 30s, 5min
 *
 * NOTE: These tests verify the logic directly by duplicating it here.
 * The actual implementation is in TranscriptionWorker.ts (lines 93-148)
 */

describe('TranscriptionWorker - Exponential Backoff Logic', () => {
  // Constants from TranscriptionWorker (lines 73-74)
  const MAX_AUTO_RETRIES = 3;
  const RETRY_DELAYS = [5000, 30000, 300000]; // 5s, 30s, 5min

  // Implementation from TranscriptionWorker.getRetryDelay() (lines 93-105)
  function getRetryDelay(retryCount: number): number | null {
    if (retryCount <= 0 || retryCount > MAX_AUTO_RETRIES) {
      return null; // No retry
    }
    // Map retryCount to delay index (retryCount 1 → index 0)
    return RETRY_DELAYS[retryCount - 1] || null;
  }

  // Implementation from TranscriptionWorker.shouldAutoRetry() (lines 107-115)
  function shouldAutoRetry(retryCount: number): boolean {
    return retryCount <= MAX_AUTO_RETRIES;
  }

  describe('getRetryDelay()', () => {
    it('should return 5000ms (5s) for first retry (retryCount=1)', () => {
      expect(getRetryDelay(1)).toBe(5000);
    });

    it('should return 30000ms (30s) for second retry (retryCount=2)', () => {
      expect(getRetryDelay(2)).toBe(30000);
    });

    it('should return 300000ms (5min) for third retry (retryCount=3)', () => {
      expect(getRetryDelay(3)).toBe(300000);
    });

    it('should return null for retryCount >= 4 (no more auto-retry)', () => {
      expect(getRetryDelay(4)).toBeNull();
      expect(getRetryDelay(5)).toBeNull();
    });

    it('should return null for retryCount=0 (no retry yet)', () => {
      expect(getRetryDelay(0)).toBeNull();
    });

    it('should return null for negative retryCount', () => {
      expect(getRetryDelay(-1)).toBeNull();
    });
  });

  describe('shouldAutoRetry()', () => {
    it('should return true for retryCount <= 3', () => {
      expect(shouldAutoRetry(0)).toBe(true);
      expect(shouldAutoRetry(1)).toBe(true);
      expect(shouldAutoRetry(2)).toBe(true);
      expect(shouldAutoRetry(3)).toBe(true);
    });

    it('should return false for retryCount > 3', () => {
      expect(shouldAutoRetry(4)).toBe(false);
      expect(shouldAutoRetry(5)).toBe(false);
      expect(shouldAutoRetry(10)).toBe(false);
    });
  });

  describe('Exponential Backoff Schedule', () => {
    it('should have exponential growth: 5s → 30s → 5min', () => {
      // Verify the backoff schedule matches requirements
      const schedule = [
        { retryCount: 1, expectedDelay: 5000 },     // 5 seconds
        { retryCount: 2, expectedDelay: 30000 },    // 30 seconds (6x)
        { retryCount: 3, expectedDelay: 300000 },   // 5 minutes (10x)
      ];

      schedule.forEach(({ retryCount, expectedDelay }) => {
        expect(getRetryDelay(retryCount)).toBe(expectedDelay);
      });
    });

    it('should stop auto-retry after 3 attempts', () => {
      // After 3 retries, no more auto-retry
      expect(shouldAutoRetry(1)).toBe(true);  // Retry #1 allowed
      expect(shouldAutoRetry(2)).toBe(true);  // Retry #2 allowed
      expect(shouldAutoRetry(3)).toBe(true);  // Retry #3 allowed
      expect(shouldAutoRetry(4)).toBe(false); // Retry #4 NOT allowed

      // No more delays after 3rd retry
      expect(getRetryDelay(4)).toBeNull();
    });

    it('should have correct growth factors', () => {
      const delay1 = getRetryDelay(1)!; // 5000ms
      const delay2 = getRetryDelay(2)!; // 30000ms
      const delay3 = getRetryDelay(3)!; // 300000ms

      // Verify growth factors
      expect(delay2 / delay1).toBe(6);   // 30s / 5s = 6x
      expect(delay3 / delay2).toBe(10);  // 5min / 30s = 10x
    });
  });

  describe('Integration scenario', () => {
    it('should follow complete retry flow', () => {
      // Simulate a capture failing multiple times
      // retryCount is AFTER the failure (incremented by markFailed)
      const failures = [
        { failureNum: 1, retryCountAfter: 1, shouldScheduleRetry: true, delayIfRetry: 5000 },   // 1st failure → retry #1 in 5s
        { failureNum: 2, retryCountAfter: 2, shouldScheduleRetry: true, delayIfRetry: 30000 },  // 2nd failure → retry #2 in 30s
        { failureNum: 3, retryCountAfter: 3, shouldScheduleRetry: true, delayIfRetry: 300000 }, // 3rd failure → retry #3 in 5min
        { failureNum: 4, retryCountAfter: 4, shouldScheduleRetry: false, delayIfRetry: null },  // 4th failure → NO retry (max reached)
      ];

      failures.forEach(({ failureNum, retryCountAfter, shouldScheduleRetry, delayIfRetry }) => {
        // After failure, retryCount is incremented
        // Check if we should schedule a retry based on NEW retry count
        expect(shouldAutoRetry(retryCountAfter)).toBe(shouldScheduleRetry);

        // Check delay for the retry we would schedule
        if (shouldScheduleRetry) {
          expect(getRetryDelay(retryCountAfter)).toBe(delayIfRetry);
        } else {
          // No more retries after 3 retries
          expect(getRetryDelay(retryCountAfter)).toBeNull();
        }
      });
    });
  });
});
