/**
 * OpenAI Service Unit Tests
 * Covers Subtask 1.6: Add unit tests for OpenAIService
 *
 * Tests for:
 * - Subtask 1.1: GPT-4o-mini client configuration
 * - Subtask 1.3: Timeout handling (30s target, 60s max)
 * - Subtask 1.4: Request/response logging
 * - Subtask 1.5: Token counting for context window management
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import type OpenAI from 'openai';

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(async () => {
    // Mock OpenAI client
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAIService,
        {
          provide: 'OPENAI_CLIENT',
          useValue: mockOpenAI,
        },
      ],
    }).compile();

    service = module.get<OpenAIService>(OpenAIService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Subtask 1.1: GPT-4o-mini Configuration', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should call GPT-4o-mini with correct model name', async () => {
      const content = 'Test thought content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                summary: 'Test summary',
                ideas: ['Idea 1', 'Idea 2'],
                confidence: 'high',
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      } as any);

      await service.digestContent(content, contentType);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        }),
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    it('should use correct temperature (0.7)', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'This is a valid summary that meets the minimum length requirement.',
                ideas: ['First key idea here', 'Second important point'],
                confidence: 'high',
              }),
            },
          },
        ],
      } as any);

      await service.digestContent(content, contentType);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
        }),
        expect.any(Object), // options argument
      );
    });

    it('should limit max_tokens to 500', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'This is a valid summary that meets the minimum length requirement.',
                ideas: ['First key idea here', 'Second important point'],
                confidence: 'high',
              }),
            },
          },
        ],
      } as any);

      await service.digestContent(content, contentType);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 500,
        }),
        expect.any(Object), // options argument
      );
    });
  });

  describe('Subtask 1.3: Timeout Handling', () => {
    it('should handle timeout errors gracefully', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Request timeout after 30000ms'),
      );

      await expect(service.digestContent(content, contentType)).rejects.toThrow(
        'Request timeout',
      );
    });

    it('should set timeout to 30 seconds', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'This is a valid summary that meets the minimum length requirement.',
                ideas: ['First key idea here', 'Second important point'],
                confidence: 'high',
              }),
            },
          },
        ],
      } as any);

      await service.digestContent(content, contentType);

      // timeout is now in options (2nd argument)
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.any(Object), // body argument
        expect.objectContaining({
          timeout: 30000, // 30 seconds (NFR3 compliance)
        }),
      );
    });
  });

  describe('Subtask 1.4: Request/Response Logging', () => {
    it('should log request details before API call', async () => {
      const content = 'Test content';
      const contentType = 'text';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'This is a valid summary that meets the minimum length requirement.',
                ideas: ['First key idea here', 'Second important point'],
                confidence: 'high',
              }),
            },
          },
        ],
      } as any);

      await service.digestContent(content, contentType);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('🤖 Calling GPT-4o-mini'),
      );
    });

    it('should log response details after API call', async () => {
      const content = 'Test content';
      const contentType = 'text';
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  'This is a valid summary that meets the minimum length requirement.',
                ideas: ['First key idea here', 'Second important point'],
                confidence: 'high',
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      } as any);

      await service.digestContent(content, contentType);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ GPT response received'),
      );
    });

    it('should log errors with details', async () => {
      const content = 'Test content';
      const contentType = 'text';
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const testError = new Error('API Error');
      // Mock both primary and fallback to fail
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(testError)
        .mockRejectedValueOnce(testError);

      await expect(
        service.digestContent(content, contentType),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Both primary and fallback prompts failed'),
        expect.anything(),
      );
    });
  });

  describe('Subtask 1.5: Token Counting', () => {
    it('should return token count for content', () => {
      const content = 'This is a test message with multiple words';

      const tokenCount = service.countTokens(content);

      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });

    it('should handle empty content', () => {
      const content = '';

      const tokenCount = service.countTokens(content);

      expect(tokenCount).toBe(0);
    });

    it('should count tokens accurately for long content', () => {
      const longContent = 'word '.repeat(1000); // ~1000 words

      const tokenCount = service.countTokens(longContent);

      // Approximate: 1000 words ≈ 1300-1500 tokens
      expect(tokenCount).toBeGreaterThan(1000);
      expect(tokenCount).toBeLessThan(2000);
    });
  });

  describe('Subtask 2.6: Fallback Prompt Strategy', () => {
    it('should use fallback prompt when primary prompt fails validation', async () => {
      const content = 'Test content for fallback';
      const contentType = 'text';

      // First call fails with malformed JSON
      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Invalid JSON response',
              },
            },
          ],
        } as any)
        // Second call (fallback) succeeds with plain text
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'This is a simple summary of the test content.',
              },
            },
          ],
        } as any);

      const result = await service.digestContent(content, contentType);

      expect(result.confidence).toBe('low');
      expect(result.summary).toContain('This is a simple summary');
      expect(result.ideas.length).toBeGreaterThan(0);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should mark fallback responses with low confidence', async () => {
      const content = 'Very short';
      const contentType = 'text';

      // Primary fails, fallback succeeds
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Primary prompt failed'))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Summary of short content.',
              },
            },
          ],
        } as any);

      const result = await service.digestContent(content, contentType);

      expect(result.confidence).toBe('low');
    });

    it('should handle very short fallback responses', async () => {
      const content = 'Ok';
      const contentType = 'text';

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Ok', // Very short response
              },
            },
          ],
        } as any);

      const result = await service.digestContent(content, contentType);

      expect(result.summary.length).toBeGreaterThanOrEqual(10); // Padded
      expect(result.summary).toContain('Limited content');
      expect(result.confidence).toBe('low');
    });

    it('should throw if both primary and fallback fail', async () => {
      const content = 'Test content';
      const contentType = 'text';

      // Both calls fail
      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Fallback also failed'));

      await expect(service.digestContent(content, contentType)).rejects.toThrow(
        'Fallback also failed',
      );

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed GPT response with fallback', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Invalid JSON response',
              },
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Fallback summary works correctly.',
              },
            },
          ],
        } as any);

      const result = await service.digestContent(content, contentType);

      expect(result).toBeDefined();
      expect(result.confidence).toBe('low');
    });

    it('should handle missing choices in response', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [],
      } as any);

      await expect(
        service.digestContent(content, contentType),
      ).rejects.toThrow();
    });

    it('should handle API rate limit errors', async () => {
      const content = 'Test content';
      const contentType = 'text';

      mockOpenAI.chat.completions.create.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      await expect(service.digestContent(content, contentType)).rejects.toThrow(
        'Rate limit',
      );
    });
  });
});
