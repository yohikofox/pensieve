/**
 * Content Extractor Service Tests
 * Covers Subtask 3.5: Add unit tests for content extraction logic
 *
 * Tests for:
 * - Subtask 3.1: Text capture content extraction
 * - Subtask 3.2: Audio transcription extraction
 * - Subtask 3.3: Content type-specific handling
 * - Subtask 3.4: Edge cases (empty content, special characters)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ContentExtractorService } from './content-extractor.service';
import type { ICaptureContentRepository } from '../../domain/interfaces/capture-content-repository.interface';

describe('ContentExtractorService', () => {
  let service: ContentExtractorService;
  let mockCaptureRepo: jest.Mocked<ICaptureContentRepository>;

  beforeEach(async () => {
    mockCaptureRepo = {
      getContent: jest.fn(),
      getTranscription: jest.fn(),
      getType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentExtractorService,
        {
          provide: 'CAPTURE_CONTENT_REPOSITORY',
          useValue: mockCaptureRepo,
        },
      ],
    }).compile();

    service = module.get<ContentExtractorService>(ContentExtractorService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Subtask 3.1: Text Capture Content Extraction', () => {
    it('should extract text content from TEXT capture', async () => {
      const captureId = 'test-text-capture';
      const textContent = 'This is a text capture with some content.';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(textContent);

      const result = await service.extractContent(captureId);

      expect(result.content).toBe(textContent);
      expect(result.contentType).toBe('text');
      expect(mockCaptureRepo.getContent).toHaveBeenCalledWith(captureId);
    });

    it('should handle long text captures', async () => {
      const captureId = 'long-text-capture';
      const longText = 'word '.repeat(1000); // ~1000 words

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(longText);

      const result = await service.extractContent(captureId);

      // Content is trimmed (trailing space removed)
      expect(result.content).toBe(longText.trim());
      expect(result.content.length).toBeGreaterThan(4000);
    });
  });

  describe('Subtask 3.2: Audio Transcription Extraction', () => {
    it('should extract transcription from AUDIO capture', async () => {
      const captureId = 'test-audio-capture';
      const transcription = 'This is a transcribed audio thought.';

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue(transcription);

      const result = await service.extractContent(captureId);

      expect(result.content).toBe(transcription);
      expect(result.contentType).toBe('audio');
      expect(mockCaptureRepo.getTranscription).toHaveBeenCalledWith(captureId);
    });

    it('should handle audio captures with long transcriptions', async () => {
      const captureId = 'long-audio-capture';
      const longTranscription = 'spoken word '.repeat(500);

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue(longTranscription);

      const result = await service.extractContent(captureId);

      // Content is trimmed (trailing space removed)
      expect(result.content).toBe(longTranscription.trim());
    });
  });

  describe('Subtask 3.3: Content Type-Specific Handling', () => {
    it('should correctly identify TEXT capture type', async () => {
      const captureId = 'text-id';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue('Text content');

      const result = await service.extractContent(captureId);

      expect(result.contentType).toBe('text');
    });

    it('should correctly identify AUDIO capture type', async () => {
      const captureId = 'audio-id';

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue('Transcription');

      const result = await service.extractContent(captureId);

      expect(result.contentType).toBe('audio');
    });
  });

  describe('Subtask 3.4: Edge Cases', () => {
    it('should handle empty text content', async () => {
      const captureId = 'empty-text';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue('');

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'Empty content',
      );
    });

    it('should handle empty transcription', async () => {
      const captureId = 'empty-audio';

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue('');

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'Empty content',
      );
    });

    it('should handle whitespace-only content', async () => {
      const captureId = 'whitespace';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue('     \n\n\t   ');

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'Empty content',
      );
    });

    it('should handle special characters in text', async () => {
      const captureId = 'special-chars';
      const specialContent = 'Content with émojis 🚀 and spéciàl çhàrs!@#$%';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(specialContent);

      const result = await service.extractContent(captureId);

      expect(result.content).toBe(specialContent);
    });

    it('should handle code snippets in text', async () => {
      const captureId = 'code-snippet';
      const codeContent = `
        function hello() {
          console.log("Hello world");
          return true;
        }
      `;

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(codeContent);

      const result = await service.extractContent(captureId);

      // Content is trimmed (leading/trailing whitespace removed)
      expect(result.content).toBe(codeContent.trim());
      expect(result.content).toContain('function hello()');
    });

    it('should handle null content', async () => {
      const captureId = 'null-content';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(null as any);

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'No content',
      );
    });

    it('should handle null transcription', async () => {
      const captureId = 'null-transcription';

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue(null as any);

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'No transcription',
      );
    });

    it('should handle repository errors gracefully', async () => {
      const captureId = 'error-capture';

      mockCaptureRepo.getType.mockRejectedValue(new Error('Database error'));

      await expect(service.extractContent(captureId)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('Content Trimming', () => {
    it('should trim whitespace from text content', async () => {
      const captureId = 'trim-test';
      const contentWithWhitespace = '  \n  Text with extra whitespace  \n  ';

      mockCaptureRepo.getType.mockResolvedValue('TEXT');
      mockCaptureRepo.getContent.mockResolvedValue(contentWithWhitespace);

      const result = await service.extractContent(captureId);

      expect(result.content).toBe('Text with extra whitespace');
    });

    it('should trim whitespace from transcription', async () => {
      const captureId = 'trim-audio';
      const transcriptionWithWhitespace = '\n\n  Transcribed text  \t\t';

      mockCaptureRepo.getType.mockResolvedValue('AUDIO');
      mockCaptureRepo.getTranscription.mockResolvedValue(
        transcriptionWithWhitespace,
      );

      const result = await service.extractContent(captureId);

      expect(result.content).toBe('Transcribed text');
    });
  });
});
