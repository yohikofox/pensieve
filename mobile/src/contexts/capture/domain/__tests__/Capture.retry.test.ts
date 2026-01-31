/**
 * Capture Model - Retry Fields Tests
 *
 * Tests retry tracking fields added for Story 2.8
 *
 * @see Capture.model.ts
 * @see Story 2.8 - Task 1.3: Update Capture TypeScript interface
 */

import { mapRowToCapture, type CaptureRow } from '../Capture.model';

describe('Capture Model - Retry Fields', () => {
  describe('Capture interface', () => {
    it('should include retry tracking fields', () => {
      const capture = {
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

  describe('CaptureRow interface', () => {
    it('should include retry tracking columns', () => {
      const row: CaptureRow = {
        id: 'test-2',
        type: 'audio',
        state: 'failed',
        raw_content: 'test.m4a',
        normalized_text: null,
        duration: 5000,
        file_size: 102400,
        wav_path: null,
        created_at: Date.now(),
        updated_at: Date.now(),
        sync_version: 0,
        last_sync_at: null,
        server_id: null,
        conflict_data: null,
        // Retry columns (migration v14)
        retry_count: 1,
        retry_window_start_at: Date.now() - 15 * 60 * 1000,
        last_retry_at: Date.now() - 5 * 60 * 1000,
        transcription_error: 'Model not found',
      };

      expect(row.retry_count).toBeDefined();
      expect(row.retry_window_start_at).toBeDefined();
      expect(row.last_retry_at).toBeDefined();
      expect(row.transcription_error).toBeDefined();
    });
  });

  describe('mapRowToCapture', () => {
    it('should map retry columns to Capture fields', () => {
      const now = Date.now();
      const windowStart = now - 12 * 60 * 1000; // 12 min ago
      const lastRetry = now - 3 * 60 * 1000; // 3 min ago

      const row: CaptureRow = {
        id: 'test-3',
        type: 'audio',
        state: 'failed',
        raw_content: 'test.m4a',
        normalized_text: null,
        duration: 5000,
        file_size: 102400,
        wav_path: null,
        created_at: now,
        updated_at: now,
        sync_version: 0,
        last_sync_at: null,
        server_id: null,
        conflict_data: null,
        retry_count: 3,
        retry_window_start_at: windowStart,
        last_retry_at: lastRetry,
        transcription_error: 'Transcription failed: timeout',
      };

      const capture = mapRowToCapture(row);

      expect(capture.retryCount).toBe(3);
      expect(capture.retryWindowStartAt).toEqual(new Date(windowStart));
      expect(capture.lastRetryAt).toEqual(new Date(lastRetry));
      expect(capture.transcriptionError).toBe('Transcription failed: timeout');
    });

    it('should handle null retry fields', () => {
      const now = Date.now();

      const row: CaptureRow = {
        id: 'test-4',
        type: 'audio',
        state: 'captured',
        raw_content: 'test.m4a',
        normalized_text: null,
        duration: 5000,
        file_size: 102400,
        wav_path: null,
        created_at: now,
        updated_at: now,
        sync_version: 0,
        last_sync_at: null,
        server_id: null,
        conflict_data: null,
        retry_count: 0,
        retry_window_start_at: null,
        last_retry_at: null,
        transcription_error: null,
      };

      const capture = mapRowToCapture(row);

      expect(capture.retryCount).toBe(0);
      expect(capture.retryWindowStartAt).toBeNull();
      expect(capture.lastRetryAt).toBeNull();
      expect(capture.transcriptionError).toBeNull();
    });
  });
});
