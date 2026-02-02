/**
 * Story 3.2 - Vue Détail d'une Capture
 * MINIMAL BDD Tests for RED phase validation
 */

import {
  TestContext,
  type Capture,
  createMockAudioCapture,
  createMockTextCapture,
} from './support/test-context';

describe('Story 3.2 - Capture Detail (Minimal Tests)', () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = new TestContext();
  });

  afterEach(() => {
    testContext.reset();
  });

  describe('AC2: Audio Capture Detail View', () => {
    it('loads audio capture with transcription data', async () => {
      const capture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio1',
          normalizedText: 'Test transcription',
          duration: 120000,
        })
      );

      const loaded = await testContext.db.findById('audio1');
      expect(loaded).not.toBeNull();
      expect(loaded?.type).toBe('AUDIO');
      expect(loaded?.normalizedText).toBe('Test transcription');
      expect(loaded?.duration).toBe(120000);
    });

    it('supports audio playback controls', async () => {
      const capture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));

      await testContext.audioPlayer.loadAudio(capture.filePath!, capture.duration!);
      await testContext.audioPlayer.play();

      expect(testContext.audioPlayer.isPlaying()).toBe(true);

      await testContext.audioPlayer.pause();
      expect(testContext.audioPlayer.isPlaying()).toBe(false);
    });
  });

  describe('AC3: Text Capture Detail View', () => {
    it('loads text capture with full content', async () => {
      const capture = await testContext.db.create(
        createMockTextCapture({
          id: 'text1',
          rawContent: 'Full text content with multiple lines',
        })
      );

      const loaded = await testContext.db.findById('text1');
      expect(loaded).not.toBeNull();
      expect(loaded?.type).toBe('TEXT');
      expect(loaded?.rawContent).toContain('Full text content');
    });
  });

  describe('AC4: Offline Access', () => {
    it('loads capture data while offline', async () => {
      testContext.network.setOffline(true);

      const capture = await testContext.db.create(createMockAudioCapture({ id: 'audio1' }));
      const loaded = await testContext.db.findById('audio1');

      expect(loaded).not.toBeNull();
      expect(testContext.network.isOffline()).toBe(true);
    });
  });

  describe('AC5: Live Transcription Updates', () => {
    it('updates capture when transcription completes', async () => {
      const capture = await testContext.db.create(
        createMockAudioCapture({
          id: 'audio1',
          state: 'processing',
          normalizedText: '',
        })
      );

      await testContext.db.update('audio1', {
        state: 'ready',
        normalizedText: 'Completed transcription',
      });

      const updated = await testContext.db.findById('audio1');
      expect(updated?.state).toBe('ready');
      expect(updated?.normalizedText).toBe('Completed transcription');
    });
  });
});
