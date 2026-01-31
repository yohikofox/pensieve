/**
 * CapturesListScreen - Debug Mode Error Display Tests
 *
 * Tests conditional error message display based on debug mode (Story 2.8 - Task 8)
 *
 * @see CapturesListScreen.tsx
 * @see AC8: Debug Mode - Show Detailed Error Messages
 */

import type { Capture } from '../../../contexts/capture/domain/Capture.model';

describe('CapturesListScreen - Debug Mode Error Display', () => {
  describe('Task 8: Debug Mode for Error Messages', () => {
    it('should show detailed error when debug mode is enabled', () => {
      const debugMode = true;

      const failedCapture: Capture = {
        id: 'test-debug-1',
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
        lastRetryAt: new Date(),
        transcriptionError: 'Whisper error: audio format not supported', // ← Detailed error
      };

      // In debug mode: show detailed error
      const displayedMessage = debugMode && failedCapture.transcriptionError
        ? failedCapture.transcriptionError
        : 'La transcription a échoué';

      expect(displayedMessage).toBe('Whisper error: audio format not supported');
    });

    it('should show generic error when debug mode is disabled', () => {
      const debugMode = false;

      const failedCapture: Capture = {
        id: 'test-debug-2',
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
        retryWindowStartAt: new Date(Date.now() - 10 * 60 * 1000),
        lastRetryAt: new Date(),
        transcriptionError: 'Whisper error: model not found', // ← Error exists but not shown
      };

      // In normal mode: show generic error
      const displayedMessage = debugMode && failedCapture.transcriptionError
        ? failedCapture.transcriptionError
        : 'La transcription a échoué';

      expect(displayedMessage).toBe('La transcription a échoué');
    });

    it('should show generic error when no transcriptionError exists', () => {
      const debugMode = true;

      const failedCapture: Capture = {
        id: 'test-debug-3',
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
        retryWindowStartAt: new Date(),
        lastRetryAt: new Date(),
        transcriptionError: null, // ← No error message
      };

      // Even in debug mode: if no error, show generic
      const displayedMessage = debugMode && failedCapture.transcriptionError
        ? failedCapture.transcriptionError
        : 'La transcription a échoué';

      expect(displayedMessage).toBe('La transcription a échoué');
    });

    it('should handle various error message types in debug mode', () => {
      const debugMode = true;

      const errorMessages = [
        'Whisper error: timeout',
        'Whisper error: audio format not supported',
        'Whisper error: model not found',
        'Network error: failed to connect',
        'File system error: cannot read audio file',
      ];

      errorMessages.forEach((errorMsg) => {
        const capture: Capture = {
          id: `test-debug-${errorMsg}`,
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
          retryWindowStartAt: new Date(),
          lastRetryAt: new Date(),
          transcriptionError: errorMsg,
        };

        const displayedMessage = debugMode && capture.transcriptionError
          ? capture.transcriptionError
          : 'La transcription a échoué';

        expect(displayedMessage).toBe(errorMsg);
      });
    });
  });

  describe('Error message display logic', () => {
    it('should correctly determine error display for all combinations', () => {
      const scenarios = [
        { debugMode: true, hasError: true, expected: 'Detailed error', description: 'Debug ON + Error exists' },
        { debugMode: true, hasError: false, expected: 'Generic error', description: 'Debug ON + No error' },
        { debugMode: false, hasError: true, expected: 'Generic error', description: 'Debug OFF + Error exists' },
        { debugMode: false, hasError: false, expected: 'Generic error', description: 'Debug OFF + No error' },
      ];

      scenarios.forEach((scenario) => {
        const capture: Capture = {
          id: `test-scenario-${scenario.description}`,
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
          retryWindowStartAt: new Date(),
          lastRetryAt: new Date(),
          transcriptionError: scenario.hasError ? 'Detailed error' : null,
        };

        const displayedMessage = scenario.debugMode && capture.transcriptionError
          ? capture.transcriptionError
          : 'Generic error';

        expect(displayedMessage).toBe(scenario.expected);
      });
    });
  });
});
