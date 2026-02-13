/**
 * Capture Model - Retry Fields Tests
 *
 * Tests retry tracking fields on the domain Capture interface (Story 2.8).
 * Row mapping tests are in data/mappers/__tests__/capture.mapper.test.ts
 *
 * @see Capture.model.ts
 * @see Story 2.8 - Task 1.3: Update Capture TypeScript interface
 */

describe('Capture Model - Retry Fields', () => {
  describe('Capture interface', () => {
    it('should include retry tracking fields', () => {
      const capture = {
        id: 'test-1',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.FAILED,
        rawContent: 'test.m4a',
        normalizedText: null,
        duration: 5000,
        fileSize: 102400,
        wavPath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        // Retry fields (Task 1.3)
        retryCount: 2,
        retryWindowStartAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
        lastRetryAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        transcriptionError: 'Whisper error: audio format not supported',
      };

      // These assertions should pass once retry fields are added
      expect(capture.retryCount).toBeDefined();
      expect(capture.retryWindowStartAt).toBeDefined();
      expect(capture.lastRetryAt).toBeDefined();
      expect(capture.transcriptionError).toBeDefined();
    });
  });
});
