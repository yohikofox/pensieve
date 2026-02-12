/**
 * Integration Tests: TextCaptureService
 *
 * Story 2.2 - AC2, AC4, AC5
 * Tests failing in RED phase - waiting for implementation
 * Run: npm run test:acceptance
 */

import { TextCaptureService } from '@/contexts/Capture/services/TextCaptureService';
import { Database } from '@nozbe/watermelondb';
import { Capture } from '@/contexts/Capture/domain/Capture.model';
import { createCaptureFactory } from '../../support/factories/capture.factory';

// Mock expo modules
jest.mock('expo-haptics');

describe('TextCaptureService Integration Tests', () => {
  let database: Database;
  let textCaptureService: TextCaptureService;
  let captureFactory: ReturnType<typeof createCaptureFactory>;

  beforeEach(() => {
    // Setup in-memory test database
    database = new Database({
      adapter: null as any, // TODO: SQLite in-memory adapter
      modelClasses: [Capture],
      actionsEnabled: true,
    });

    textCaptureService = new TextCaptureService(database);
    captureFactory = createCaptureFactory(database);
  });

  afterEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  describe('AC2: Save Text Capture with Metadata', () => {
    it('should create Capture entity with type "text"', async () => {
      // GIVEN: Valid text content
      const textContent = 'This is my brilliant idea';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: Capture is created with type "text"
      expect(capture.type).toBe('text');
      expect(capture.state).toBe('captured');
    });

    it('should store text content in rawContent', async () => {
      // GIVEN: Text content
      const textContent = 'Important note to remember';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: Text is stored in rawContent
      expect(capture.rawContent).toBe(textContent);
    });

    it('should set normalizedText equal to rawContent for text captures', async () => {
      // GIVEN: Text content (no normalization needed)
      const textContent = 'No transformation required';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: normalizedText equals rawContent
      expect(capture.normalizedText).toBe(textContent);
      expect(capture.normalizedText).toBe(capture.rawContent);
    });

    it('should record timestamp when capture is created', async () => {
      // GIVEN: Current timestamp
      const beforeSave = new Date();

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture('Timestamped thought');

      // THEN: capturedAt is set to current time
      const afterSave = new Date();
      expect(capture.capturedAt).toBeInstanceOf(Date);
      expect(capture.capturedAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(capture.capturedAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
    });

    it('should set status to "captured" immediately', async () => {
      // GIVEN: Text content
      const textContent = 'Immediate capture';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: State is "captured" (not "processing" like audio)
      expect(capture.state).toBe('captured');
    });
  });

  describe('AC4: Offline Text Capture Functionality', () => {
    it('should work without network connectivity', async () => {
      // GIVEN: No network (service is network-independent)
      const textContent = 'Offline thought';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: Capture is saved successfully
      expect(capture.id).toBeDefined();
      expect(capture.rawContent).toBe(textContent);
    });

    it('should mark Capture as pending sync', async () => {
      // GIVEN: Offline mode (simulated)
      const textContent = 'Needs sync';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textContent);

      // THEN: syncStatus is "pending"
      expect(capture.syncStatus).toBe('pending');
    });

    it('should add capture to sync queue', async () => {
      // GIVEN: Multiple offline captures
      await textCaptureService.saveTextCapture('First offline');
      await textCaptureService.saveTextCapture('Second offline');
      await textCaptureService.saveTextCapture('Third offline');

      // WHEN: Query pending sync captures
      const pendingCaptures = await database
        .get<Capture>('captures')
        .query(/* Q.where('syncStatus', 'pending') */)
        .fetch();

      // THEN: All captures are in sync queue
      expect(pendingCaptures.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('AC5: Empty Text Validation', () => {
    it('should reject empty text', async () => {
      // GIVEN: Empty text content
      const emptyText = '';

      // WHEN: Attempt to save empty text
      // THEN: Throws validation error
      await expect(async () => {
        await textCaptureService.saveTextCapture(emptyText);
      }).rejects.toThrow('Text content cannot be empty');
    });

    it('should reject whitespace-only text', async () => {
      // GIVEN: Whitespace-only content
      const whitespaceText = '   \n\t   ';

      // WHEN: Attempt to save
      // THEN: Throws validation error
      await expect(async () => {
        await textCaptureService.saveTextCapture(whitespaceText);
      }).rejects.toThrow('Text content cannot be empty');
    });

    it('should accept text with leading/trailing whitespace', async () => {
      // GIVEN: Text with surrounding whitespace
      const textWithWhitespace = '  Valid content  ';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(textWithWhitespace);

      // THEN: Capture is created (whitespace trimmed)
      expect(capture.rawContent).toBe(textWithWhitespace.trim());
    });

    it('should not create Capture entity for invalid text', async () => {
      // GIVEN: Invalid text
      const invalidText = '';

      // WHEN: Attempt to save
      let captureCreated = false;
      try {
        await textCaptureService.saveTextCapture(invalidText);
        captureCreated = true;
      } catch (error) {
        // Expected validation error
      }

      // THEN: No Capture entity is created
      expect(captureCreated).toBe(false);

      const allCaptures = await database.get<Capture>('captures').query().fetch();
      expect(allCaptures.length).toBe(0);
    });
  });

  describe('Additional Validation Logic', () => {
    it('should validate text content is a string', async () => {
      // GIVEN: Non-string input
      const invalidInput = null;

      // WHEN: Attempt to save
      // THEN: Throws type error
      await expect(async () => {
        await textCaptureService.saveTextCapture(invalidInput as any);
      }).rejects.toThrow();
    });

    it('should handle very long text content', async () => {
      // GIVEN: Very long text (e.g., 10,000 characters)
      const longText = 'A'.repeat(10000);

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(longText);

      // THEN: Capture is created successfully
      expect(capture.rawContent).toBe(longText);
      expect(capture.rawContent.length).toBe(10000);
    });

    it('should handle special characters and emojis', async () => {
      // GIVEN: Text with special characters and emojis
      const specialText = 'Hello! 👋 This is a test with "quotes", \n newlines, and émojis 🚀';

      // WHEN: Save text capture
      const capture = await textCaptureService.saveTextCapture(specialText);

      // THEN: All characters are preserved
      expect(capture.rawContent).toBe(specialText);
    });
  });

  describe('Service Integration', () => {
    it('should integrate with existing Capture factory', async () => {
      // GIVEN: Capture factory from Story 2.1
      const textCapture = await captureFactory.create({
        type: 'text',
        rawContent: 'Factory-created text capture',
      });

      // WHEN: Query captures
      const allCaptures = await database.get<Capture>('captures').query().fetch();

      // THEN: Text capture is in database
      expect(allCaptures.length).toBe(1);
      expect(allCaptures[0].type).toBe('text');
    });

    it('should coexist with audio captures', async () => {
      // GIVEN: Mix of audio and text captures
      await captureFactory.createAudioCapture();
      await textCaptureService.saveTextCapture('Text capture');
      await captureFactory.createAudioCapture();

      // WHEN: Query all captures
      const allCaptures = await database.get<Capture>('captures').query().fetch();

      // THEN: Both types are stored
      expect(allCaptures.length).toBe(3);
      expect(allCaptures.filter(c => c.type === 'audio').length).toBe(2);
      expect(allCaptures.filter(c => c.type === 'text').length).toBe(1);
    });
  });
});
