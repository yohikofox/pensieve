/**
 * RetryLimitService - Transcription Retry Rate Limiting
 *
 * Enforces 3 retries per 20-minute sliding window to prevent excessive
 * transcription attempts and protect device resources.
 *
 * Business Rules:
 * - Maximum 3 retry attempts per capture
 * - 20-minute sliding window for retry counting
 * - Window resets after 20 minutes from first retry
 * - After limit reached, user must wait for window to expire
 *
 * @see Story 2.8 - Bouton Retry pour Transcriptions en Échec
 * @see AC-4: Rate limiting implementation
 */

export interface CaptureWithRetry {
  id: string;
  retryCount: number;
  retryWindowStartAt: Date | null;
  lastRetryAt: Date | null;
}

export interface RetryCheckResult {
  allowed: boolean;
  remainingTime?: number; // Minutes remaining until retry allowed
}

export class RetryLimitService {
  /**
   * Maximum number of retries allowed within the window
   */
  static readonly RETRY_LIMIT = 3;

  /**
   * Duration of the retry window in milliseconds (20 minutes)
   */
  static readonly WINDOW_DURATION_MS = 20 * 60 * 1000;

  /**
   * Check if a capture can be retried based on rate limiting rules
   *
   * @param capture - Capture with retry tracking fields
   * @returns Result indicating if retry is allowed and remaining wait time
   */
  canRetry(capture: CaptureWithRetry): RetryCheckResult {
    // No retry window started yet - allow retry
    if (!capture.retryWindowStartAt) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowStart = capture.retryWindowStartAt.getTime();
    const elapsed = now - windowStart;

    // Window has elapsed (>=20 minutes) - allow retry and reset window
    if (elapsed >= RetryLimitService.WINDOW_DURATION_MS) {
      return { allowed: true };
    }

    // Within window - check retry count
    if (capture.retryCount < RetryLimitService.RETRY_LIMIT) {
      return { allowed: true };
    }

    // Limit reached within window - deny retry and calculate remaining time
    const remainingMs = RetryLimitService.WINDOW_DURATION_MS - elapsed;
    const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);

    return {
      allowed: false,
      remainingTime: remainingMinutes,
    };
  }

  /**
   * Calculate when the next retry will be allowed
   *
   * @param capture - Capture with retry tracking
   * @returns Date when retry will be allowed, or null if already allowed
   */
  getNextRetryTime(capture: CaptureWithRetry): Date | null {
    const result = this.canRetry(capture);

    if (result.allowed) {
      return null;
    }

    if (!capture.retryWindowStartAt) {
      return null;
    }

    const nextRetryTime = new Date(
      capture.retryWindowStartAt.getTime() + RetryLimitService.WINDOW_DURATION_MS
    );

    return nextRetryTime;
  }

  /**
   * Get human-readable message about retry status
   *
   * @param capture - Capture with retry tracking
   * @returns Status message for UI display
   */
  getRetryStatusMessage(capture: CaptureWithRetry): string {
    const result = this.canRetry(capture);

    if (result.allowed) {
      return 'Vous pouvez réessayer la transcription';
    }

    const remainingMinutes = result.remainingTime || 0;

    if (remainingMinutes === 1) {
      return 'Limite atteinte. Réessayez dans 1 minute';
    }

    return `Limite atteinte. Réessayez dans ${remainingMinutes} minutes`;
  }
}
