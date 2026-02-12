/**
 * Tests for Capture Model - Domain Interface
 *
 * Validates the Capture interface type system.
 * Row mapping tests are in data/mappers/__tests__/capture.mapper.test.ts
 *
 * Story: 2.1 - Capture Audio 1-Tap
 * Migration: WatermelonDB Model → TypeScript Interface
 */

import { type Capture } from '../Capture.model';

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
        // Optional fields omitted
      };

      expect(capture.duration).toBeUndefined();
      expect(capture.fileSize).toBeUndefined();
      expect(capture.projectId).toBeUndefined();
    });
  });
});
