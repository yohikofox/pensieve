/**
 * Tests for Capture Row Mapper - Data Access Layer
 *
 * Validates CaptureRow → Capture mapping including retry fields.
 *
 * Extracted from domain/__tests__/Capture.model.test.ts and Capture.retry.test.ts
 */

import { type CaptureRow, mapRowToCapture } from '../capture.mapper';
import { CAPTURE_TYPES, CAPTURE_STATES } from '../../../domain/Capture.model';

describe('Capture Mapper', () => {
  describe('mapRowToCapture', () => {
    it('should map database row to Capture interface', () => {
      const row: CaptureRow = {
        id: 'capture-123',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        raw_content: '/path/to/audio.m4a',
        normalized_text: null,
        duration: 5000,
        file_size: 1024000,
        wav_path: null,
        created_at: 1640000000000,
        updated_at: 1640000001000,
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

      expect(capture.id).toBe('capture-123');
      expect(capture.type).toBe('audio');
      expect(capture.state).toBe('captured');
      expect(capture.rawContent).toBe('/path/to/audio.m4a');
      expect(capture.duration).toBe(5000);
      expect(capture.fileSize).toBe(1024000);
      expect(capture.createdAt).toEqual(new Date(1640000000000));
      expect(capture.updatedAt).toEqual(new Date(1640000001000));
      expect(capture.capturedAt).toEqual(new Date(1640000000000));
      expect(capture.syncVersion).toBe(0);
      expect(capture.lastSyncAt).toBeNull();
      expect(capture.serverId).toBeNull();
      expect(capture.conflictData).toBeNull();
    });

    it('should handle sync metadata correctly', () => {
      const row: CaptureRow = {
        id: 'capture-456',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        raw_content: 'Quick note',
        normalized_text: 'Quick note',
        duration: null,
        file_size: null,
        wav_path: null,
        created_at: 1640000000000,
        updated_at: 1640000002000,
        sync_version: 5,
        last_sync_at: 1640000001500,
        server_id: 'server-uuid',
        conflict_data: null,
        retry_count: 0,
        retry_window_start_at: null,
        last_retry_at: null,
        transcription_error: null,
      };

      const capture = mapRowToCapture(row);

      expect(capture.syncVersion).toBe(5);
      expect(capture.lastSyncAt).toEqual(new Date(1640000001500));
      expect(capture.serverId).toBe('server-uuid');
    });

    it('should handle conflict data correctly', () => {
      const conflictPayload = JSON.stringify({ serverVersion: 10 });
      const row: CaptureRow = {
        id: 'capture-789',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
        raw_content: '/path/to/audio.m4a',
        normalized_text: null,
        duration: 3000,
        file_size: 512000,
        wav_path: null,
        created_at: 1640000000000,
        updated_at: 1640000003000,
        sync_version: 8,
        last_sync_at: 1640000002000,
        server_id: 'server-uuid',
        conflict_data: conflictPayload,
        retry_count: 0,
        retry_window_start_at: null,
        last_retry_at: null,
        transcription_error: null,
      };

      const capture = mapRowToCapture(row);

      expect(capture.conflictData).toBe(conflictPayload);
      expect(JSON.parse(capture.conflictData!)).toEqual({ serverVersion: 10 });
    });

    it('should handle nullable fields correctly', () => {
      const row: CaptureRow = {
        id: 'capture-null',
        type: CAPTURE_TYPES.TEXT,
        state: CAPTURE_STATES.CAPTURED,
        raw_content: 'Simple text',
        normalized_text: null,
        duration: null,
        file_size: null,
        wav_path: null,
        created_at: 1640000000000,
        updated_at: 1640000000000,
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

      expect(capture.duration).toBeNull();
      expect(capture.fileSize).toBeNull();
      expect(capture.lastSyncAt).toBeNull();
      expect(capture.serverId).toBeNull();
      expect(capture.conflictData).toBeNull();
    });

    it('should map retry columns to Capture fields', () => {
      const now = Date.now();
      const windowStart = now - 12 * 60 * 1000; // 12 min ago
      const lastRetry = now - 3 * 60 * 1000; // 3 min ago

      const row: CaptureRow = {
        id: 'test-3',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.FAILED,
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
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.CAPTURED,
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

  describe('CaptureRow interface', () => {
    it('should include retry tracking columns', () => {
      const row: CaptureRow = {
        id: 'test-2',
        type: CAPTURE_TYPES.AUDIO,
        state: CAPTURE_STATES.FAILED,
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
});
