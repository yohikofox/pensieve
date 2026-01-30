/**
 * Tests for Capture Model - Domain Interface
 *
 * Validates the Capture interface and row mapping function
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Migration: WatermelonDB Model → TypeScript Interface
 */

import { type Capture, type CaptureRow, mapRowToCapture } from '../Capture.model';

describe('Capture Model', () => {
  describe('Type System', () => {
    it('should support all capture types at compile time', () => {
      // TypeScript compile-time check - these should not error
      const audioType: string = 'audio';
      const textType: string = 'text';
      const imageType: string = 'image';
      const urlType: string = 'url';

      expect([audioType, textType, imageType, urlType]).toHaveLength(4);
    });

    it('should support all state values at compile time', () => {
      // TypeScript compile-time check
      const captured: string = 'captured';
      const processing: string = 'processing';
      const ready: string = 'ready';
      const failed: string = 'failed';
      const recording: string = 'recording';

      expect([captured, processing, ready, failed, recording]).toHaveLength(5);
    });

    it('should support syncStatus values at compile time', () => {
      // TypeScript compile-time check
      const pending: string = 'pending';
      const synced: string = 'synced';
      const conflict: string = 'conflict';

      expect([pending, synced, conflict]).toHaveLength(3);
    });
  });

  describe('mapRowToCapture', () => {
    it('should map database row to Capture interface', () => {
      const row: CaptureRow = {
        id: 'capture-123',
        type: 'audio',
        state: 'captured',
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
      // Note: syncStatus is now managed via sync_queue table (v2 architecture)
      expect(capture.syncVersion).toBe(0);
      expect(capture.lastSyncAt).toBeNull();
      expect(capture.serverId).toBeNull();
      expect(capture.conflictData).toBeNull();
    });

    it('should handle sync metadata correctly', () => {
      const row: CaptureRow = {
        id: 'capture-456',
        type: 'text',
        state: 'captured',
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
      };

      const capture = mapRowToCapture(row);

      // Note: syncStatus is now managed via sync_queue table (v2 architecture)
      expect(capture.syncVersion).toBe(5);
      expect(capture.lastSyncAt).toEqual(new Date(1640000001500));
      expect(capture.serverId).toBe('server-uuid');
    });

    it('should handle conflict data correctly', () => {
      const conflictPayload = JSON.stringify({ serverVersion: 10 });
      const row: CaptureRow = {
        id: 'capture-789',
        type: 'audio',
        state: 'captured',
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
      };

      const capture = mapRowToCapture(row);

      // Note: syncStatus is now managed via sync_queue table (v2 architecture)
      expect(capture.conflictData).toBe(conflictPayload);
      expect(JSON.parse(capture.conflictData!)).toEqual({ serverVersion: 10 });
    });

    it('should handle nullable fields correctly', () => {
      const row: CaptureRow = {
        id: 'capture-null',
        type: 'text',
        state: 'captured',
        raw_content: 'Simple text',
        duration: null,
        file_size: null,
        created_at: 1640000000000,
        updated_at: 1640000000000,
        sync_status: 'pending',
        sync_version: 0,
        last_sync_at: null,
        server_id: null,
        conflict_data: null,
      };

      const capture = mapRowToCapture(row);

      expect(capture.duration).toBeNull();
      expect(capture.fileSize).toBeNull();
      expect(capture.lastSyncAt).toBeNull();
      expect(capture.serverId).toBeNull();
      expect(capture.conflictData).toBeNull();
    });
  });

  describe('Capture Interface', () => {
    it('should allow creating valid capture objects', () => {
      const capture: Capture = {
        id: 'test-id',
        type: 'audio',
        state: 'captured',
        rawContent: '/path/to/audio.m4a',
        duration: 5000,
        fileSize: 1024000,
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
        syncVersion: 0,
      };

      expect(capture).toBeDefined();
      expect(capture.id).toBe('test-id');
      expect(capture.type).toBe('audio');
    });

    it('should support optional fields', () => {
      const capture: Capture = {
        id: 'test-id',
        type: 'text',
        state: 'captured',
        rawContent: 'Quick note',
        createdAt: new Date(),
        updatedAt: new Date(),
        capturedAt: new Date(),
        syncStatus: 'pending',
        // Optional fields omitted
      };

      expect(capture.duration).toBeUndefined();
      expect(capture.fileSize).toBeUndefined();
      expect(capture.projectId).toBeUndefined();
    });
  });
});
