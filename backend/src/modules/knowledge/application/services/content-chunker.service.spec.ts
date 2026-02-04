/**
 * Content Chunker Service Tests
 * Covers Subtask 7.5: Add unit tests for chunking logic
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ContentChunkerService } from './content-chunker.service';
import { OpenAIService } from './openai.service';

describe('ContentChunkerService', () => {
  let service: ContentChunkerService;
  let mockOpenAIService: jest.Mocked<OpenAIService>;

  beforeEach(async () => {
    mockOpenAIService = {
      digestContent: jest.fn(),
      countTokens: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentChunkerService,
        {
          provide: OpenAIService,
          useValue: mockOpenAIService,
        },
      ],
    }).compile();

    service = module.get<ContentChunkerService>(ContentChunkerService);
  });

  describe('processContent', () => {
    it('should process short content directly without chunking', async () => {
      const shortContent = 'This is a short content.';
      const contentType = 'text';

      mockOpenAIService.digestContent.mockResolvedValue({
        summary: 'Short summary',
        ideas: ['Idea 1'],
        confidence: 'high',
      });

      const result = await service.processContent(shortContent, contentType);

      expect(result.wasChunked).toBe(false);
      expect(result.summary).toBe('Short summary');
      expect(mockOpenAIService.digestContent).toHaveBeenCalledTimes(1);
    });

    it('should chunk and merge long content', async () => {
      const longContent = 'word '.repeat(5000); // Very long content
      const contentType = 'text';

      // Mock multiple chunk responses
      mockOpenAIService.digestContent
        .mockResolvedValueOnce({
          summary: 'Summary chunk 1',
          ideas: ['Idea 1', 'Idea 2'],
          confidence: 'high',
        })
        .mockResolvedValueOnce({
          summary: 'Summary chunk 2',
          ideas: ['Idea 2', 'Idea 3'],
          confidence: 'high',
        });

      const result = await service.processContent(longContent, contentType);

      expect(result.wasChunked).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(1);
      expect(mockOpenAIService.digestContent).toHaveBeenCalledTimes(
        result.chunkCount,
      );
    });

    it('should deduplicate ideas from multiple chunks', async () => {
      const longContent = 'word '.repeat(5000);
      const contentType = 'text';

      // Mock chunks with duplicate ideas
      mockOpenAIService.digestContent
        .mockResolvedValueOnce({
          summary: 'Summary 1',
          ideas: ['Same idea', 'Unique idea 1'],
          confidence: 'high',
        })
        .mockResolvedValueOnce({
          summary: 'Summary 2',
          ideas: ['Same idea', 'Unique idea 2'], // Duplicate "Same idea"
          confidence: 'high',
        });

      const result = await service.processContent(longContent, contentType);

      expect(result.wasChunked).toBe(true);
      // Should have 3 unique ideas (not 4)
      expect(result.ideas.length).toBeLessThanOrEqual(3);
    });
  });
});
