/**
 * Tests for Capture Repository - Data Access Layer
 *
 * Validates CRUD operations and querying capabilities
 * with WatermelonDB
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { CaptureRepository } from '../CaptureRepository';
import { database } from '../../../../database';

describe('CaptureRepository', () => {
  let repository: CaptureRepository;

  beforeEach(() => {
    repository = new CaptureRepository();
  });

  afterEach(async () => {
    // Clean up: delete all captures after each test
    await database.write(async () => {
      const allCaptures = await repository.findAll();
      await Promise.all(
        allCaptures.map((capture) => capture.destroyPermanently())
      );
    });
  });

  describe('create', () => {
    it('should create a new capture with required fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      expect(capture).toBeDefined();
      expect(capture._raw.type).toBe('audio');
      expect(capture._raw.state).toBe('recording');
      expect(capture._raw.raw_content).toBe('/path/to/audio.m4a');
      expect(capture._raw.sync_status).toBe('pending');
      expect(capture._raw.captured_at).toBeGreaterThan(0);
    });

    it('should create a capture with optional fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
        projectId: 'project-123',
        normalizedText: 'Transcribed text',
        location: JSON.stringify({ lat: 48.8566, lon: 2.3522 }),
        tags: JSON.stringify(['important', 'meeting']),
      });

      expect(capture._raw.project_id).toBe('project-123');
      expect(capture._raw.normalized_text).toBe('Transcribed text');
      expect(capture._raw.location).toBe(JSON.stringify({ lat: 48.8566, lon: 2.3522 }));
      expect(capture._raw.tags).toBe(JSON.stringify(['important', 'meeting']));
    });
  });

  describe('findById', () => {
    it('should find a capture by id', async () => {
      const created = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?._raw.type).toBe('audio');
    });

    it('should return null for non-existent id', async () => {
      const found = await repository.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update capture state', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/audio.m4a',
        syncStatus: 'pending',
      });

      const updated = await repository.update(capture.id, {
        state: 'captured',
      });

      expect(updated._raw.state).toBe('captured');
      expect(updated.id).toBe(capture.id);
    });

    it('should update multiple fields', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/path/to/temp.m4a',
        syncStatus: 'pending',
      });

      const updated = await repository.update(capture.id, {
        state: 'captured',
        rawContent: '/path/to/final.m4a',
        normalizedText: 'Transcribed content',
        syncStatus: 'synced',
      });

      expect(updated._raw.state).toBe('captured');
      expect(updated._raw.raw_content).toBe('/path/to/final.m4a');
      expect(updated._raw.normalized_text).toBe('Transcribed content');
      expect(updated._raw.sync_status).toBe('synced');
    });
  });

  describe('findAll', () => {
    it('should return empty array when no captures exist', async () => {
      const captures = await repository.findAll();

      expect(captures).toEqual([]);
    });

    it('should return all captures', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'text',
        state: 'captured',
        rawContent: 'Quick note',
        syncStatus: 'synced',
      });

      const captures = await repository.findAll();

      expect(captures).toHaveLength(2);
    });
  });

  describe('findByState', () => {
    it('should find captures by state', async () => {
      const c1 = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      const c2 = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio2.m4a',
        syncStatus: 'pending',
      });

      const c3 = await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/audio3.m4a',
        syncStatus: 'pending',
      });

      const recording = await repository.findByState('recording');

      expect(recording).toHaveLength(2);
      expect(recording.every((c) => c._raw.state === 'recording')).toBe(true);
    });
  });

  describe('findBySyncStatus', () => {
    it('should find captures by sync status', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio1.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio2.m4a',
        syncStatus: 'synced',
      });

      const pending = await repository.findBySyncStatus('pending');

      expect(pending).toHaveLength(1);
      expect(pending[0]._raw.sync_status).toBe('pending');
    });
  });

  describe('findByType', () => {
    it('should find captures by type', async () => {
      await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
      });

      await repository.create({
        type: 'text',
        state: 'captured',
        rawContent: 'Quick note',
        syncStatus: 'pending',
      });

      const audioCaptures = await repository.findByType('audio');

      expect(audioCaptures).toHaveLength(1);
      expect(audioCaptures[0]._raw.type).toBe('audio');
    });
  });

  describe('delete', () => {
    it('should soft delete a capture', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
      });

      const id = capture.id;
      await repository.delete(id);

      // Soft deleted records are not returned by findById
      // They remain in DB but are filtered out by WatermelonDB queries
      const allCaptures = await repository.findAll();
      const isDeleted = !allCaptures.some((c) => c.id === id);

      expect(isDeleted).toBe(true);
    });
  });

  describe('destroyPermanently', () => {
    it('should permanently delete a capture', async () => {
      const capture = await repository.create({
        type: 'audio',
        state: 'captured',
        rawContent: '/audio.m4a',
        syncStatus: 'pending',
      });

      await repository.destroyPermanently(capture.id);

      const found = await repository.findById(capture.id);
      expect(found).toBeNull();
    });
  });
});
