/**
 * CapturesListScreen - Retry Button Integration Tests
 *
 * Tests retry button behavior with rate limiting (Story 2.8 - Task 3, 4)
 *
 * @see CapturesListScreen.tsx
 * @see RetryLimitService.ts
 */

import { RetryLimitService } from '../../../contexts/Normalization/services/RetryLimitService';
import type { Capture } from '../../../contexts/capture/domain/Capture.model';

describe('CapturesListScreen - Retry Button with Rate Limiting', () => {
  let retryService: RetryLimitService;

  beforeEach(() => {
    retryService = new RetryLimitService();
  });

  describe('Retry button enablement logic', () => {
    it('should allow retry when no previous retries', () => {
      const capture: Capture = {
        id: 'test-1',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 0,
        retryWindowStartAt: null,
        lastRetryAt: null,
        transcriptionError: 'Whisper error: timeout',
      };

      const result = retryService.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it('should allow retry when 2 attempts used within window', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago

      const capture: Capture = {
        id: 'test-2',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 2,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 3 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const result = retryService.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });

    it('should deny retry when 3 attempts exhausted within window', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 10 * 60 * 1000); // 10 min ago

      const capture: Capture = {
        id: 'test-3',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 2 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const result = retryService.canRetry(capture);

      expect(result.allowed).toBe(false);
      expect(result.remainingTime).toBe(10); // 20 - 10 = 10 minutes
    });

    it('should allow retry when window has elapsed', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 25 * 60 * 1000); // 25 min ago (> 20)

      const capture: Capture = {
        id: 'test-4',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 22 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const result = retryService.canRetry(capture);

      expect(result.allowed).toBe(true);
      expect(result.remainingTime).toBeUndefined();
    });
  });

  describe('Retry status messages', () => {
    it('should return correct message when retry allowed', () => {
      const capture: Capture = {
        id: 'test-5',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 1,
        retryWindowStartAt: new Date(Date.now() - 5 * 60 * 1000),
        lastRetryAt: new Date(Date.now() - 2 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const message = retryService.getRetryStatusMessage(capture);

      expect(message).toBe('Vous pouvez réessayer la transcription');
    });

    it('should return correct countdown message when limit reached', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago

      const capture: Capture = {
        id: 'test-6',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 1 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const message = retryService.getRetryStatusMessage(capture);

      expect(message).toBe('Limite atteinte. Réessayez dans 5 minutes');
    });

    it('should handle singular minute correctly', () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 19 * 60 * 1000); // 19 min ago

      const capture: Capture = {
        id: 'test-7',
        type: 'audio',
        state: 'failed',
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        retryCount: 3,
        retryWindowStartAt: windowStart,
        lastRetryAt: new Date(now.getTime() - 1 * 60 * 1000),
        transcriptionError: 'Whisper error: timeout',
      };

      const message = retryService.getRetryStatusMessage(capture);

      expect(message).toBe('Limite atteinte. Réessayez dans 1 minute');
    });
  });
});
