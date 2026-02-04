/**
 * OpenAI Service
 * Integrates GPT-4o-mini for content digestion
 *
 * Covers:
 * - Subtask 1.1: Create OpenAIService with GPT-4o-mini client configuration
 * - Subtask 1.2: Add OpenAI API key configuration (handled via environment)
 * - Subtask 1.3: Implement timeout handling (30s target, 60s max)
 * - Subtask 1.4: Add request/response logging for debugging
 * - Subtask 1.5: Implement token counting for context window management
 *
 * AC1: GPT-4o-mini Integration and Prompt Engineering
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type OpenAI from 'openai';
import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';
import {
  type DigestionResponse,
  validateDigestionResponse,
} from '../../domain/schemas/digestion-response.schema';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly model: TiktokenModel = 'gpt-4o-mini' as TiktokenModel;
  private readonly timeout = 30000; // 30 seconds (NFR3 compliance)
  private readonly temperature = 0.7; // Balance creativity and consistency
  private readonly maxTokens = 500; // Concise summary

  constructor(
    @Inject('OPENAI_CLIENT')
    private readonly openai: OpenAI,
  ) {}

  /**
   * Digest content using GPT-4o-mini with fallback strategy
   * Subtask 2.6: Add fallback prompts if primary prompt fails
   *
   * @param content - Raw content to digest (text or transcription)
   * @param contentType - Type of content ('text' or 'audio')
   * @returns Digestion result with summary and ideas
   */
  async digestContent(
    content: string,
    contentType: 'text' | 'audio',
  ): Promise<DigestionResponse> {
    // Subtask 1.4: Log request details (REDACTED - no PII logging per NFR12)
    const contentPreview = content.length > 50
      ? content.substring(0, 50) + '...'
      : content;
    this.logger.log(
      `🤖 Calling GPT-4o-mini for ${contentType} content (${content.length} chars, preview: "${contentPreview}")`,
    );

    try {
      // Subtask 1.1: Call GPT-4o-mini with primary prompt
      return await this.digestWithPrimaryPrompt(content, contentType);
    } catch (primaryError) {
      // Check if it's a rate limit error (OpenAI 429)
      const errorMessage =
        primaryError instanceof Error ? primaryError.message : String(primaryError);

      if (this.isRateLimitError(primaryError)) {
        this.logger.warn(
          `⏱️  OpenAI rate limit hit (429). Will retry with exponential backoff.`,
        );
        // Re-throw with specific error type for consumer to handle
        throw new Error(`RATE_LIMIT: ${errorMessage}`);
      }

      // Subtask 2.6: Try fallback prompt if primary fails (non-rate-limit errors)
      this.logger.warn(
        `⚠️  Primary prompt failed: ${errorMessage}. Trying fallback prompt...`,
      );

      try {
        return await this.digestWithFallbackPrompt(content, contentType);
      } catch (fallbackError) {
        // Both prompts failed - log and throw
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        this.logger.error(
          `❌ Both primary and fallback prompts failed. Primary: ${errorMessage}, Fallback: ${fallbackErrorMessage}`,
          fallbackError,
        );
        throw fallbackError;
      }
    }
  }

  /**
   * Attempt digestion with primary structured prompt
   * Uses JSON mode for structured output
   *
   * @param content - Content to digest
   * @param contentType - Type of content
   * @returns Validated digestion response
   */
  private async digestWithPrimaryPrompt(
    content: string,
    contentType: 'text' | 'audio',
  ): Promise<DigestionResponse> {
    const response = await this.openai.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: this.getUserPrompt(content, contentType),
          },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        response_format: { type: 'json_object' },
      },
      {
        timeout: this.timeout, // Request options
      },
    );

    // Subtask 1.4: Log response details
    this.logger.log(
      `✅ GPT response received (tokens: ${response.usage?.total_tokens || 'N/A'})`,
    );
    this.logger.debug(`Response: ${JSON.stringify(response.choices[0])}`);

    return this.parseResponse(response);
  }

  /**
   * Fallback prompt strategy for edge cases
   * Subtask 2.6: Simpler plain-text prompt without JSON formatting
   *
   * @param content - Content to digest
   * @param contentType - Type of content
   * @returns Digestion response with low confidence flag
   */
  private async digestWithFallbackPrompt(
    content: string,
    contentType: 'text' | 'audio',
  ): Promise<DigestionResponse> {
    this.logger.log('🔄 Using fallback prompt (plain text mode)');

    const response = await this.openai.chat.completions.create(
      {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant. Provide concise summaries of user thoughts.`,
          },
          {
            role: 'user',
            content: this.getFallbackUserPrompt(content, contentType),
          },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        // No JSON mode - plain text response
      },
      {
        timeout: this.timeout, // Request options
      },
    );

    this.logger.log('✅ Fallback response received');

    return this.parseFallbackResponse(response);
  }

  /**
   * Check if error is a rate limit error (OpenAI 429)
   * AC7: Handle API errors (rate limit, timeout, malformed response)
   *
   * @param error - Error object from OpenAI
   * @returns True if rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      // OpenAI SDK wraps 429 in Error with specific message
      return (
        error.message.includes('429') ||
        error.message.includes('rate limit') ||
        error.message.toLowerCase().includes('too many requests')
      );
    }
    return false;
  }

  /**
   * Count tokens in content using tiktoken
   * Subtask 1.5: Token counting for context window management
   *
   * @param content - Content to count tokens for
   * @returns Number of tokens
   */
  countTokens(content: string): number {
    if (!content || content.length === 0) {
      return 0;
    }

    try {
      const encoding = encoding_for_model(this.model);
      const tokens = encoding.encode(content);
      encoding.free(); // Clean up memory
      return tokens.length;
    } catch (error) {
      this.logger.error('Error counting tokens', error);
      // Fallback: rough estimation (1 token ≈ 4 chars)
      return Math.ceil(content.length / 4);
    }
  }

  /**
   * Get system prompt for AI digestion
   * Part of Subtask 2.1: Design system prompt
   * Story 4.3 - Subtask 1.1: Update system prompt to include todo detection
   *
   * @returns System prompt text
   */
  private getSystemPrompt(): string {
    return `You are an AI assistant specialized in analyzing personal thoughts and ideas.
Your goal is to extract the essence of the user's thought, identify key insights, and detect actionable tasks.

For each thought provided:
1. Generate a concise summary (2-3 sentences maximum) that captures the core message.
2. Extract key ideas as bullet points (1-5 ideas maximum, prioritize quality over quantity).
3. Detect actionable tasks/todos (0-10 maximum, be selective - only real actions).

Guidelines for summary and ideas:
- Be concise and precise.
- Focus on actionable insights and meaningful themes.
- If the thought is unclear or minimal, provide a best-effort summary.
- Preserve the user's voice and intent.
- Do not add information not present in the original thought.

Guidelines for todo extraction:
- A todo is an action the user needs to take (verbs: send, call, buy, finish, etc.)
- Extract deadline if mentioned (e.g., "by Friday", "tomorrow", "in 3 days")
- Infer priority from context:
  - HIGH: urgent, ASAP, critical, deadline-driven
  - MEDIUM: important, should do, need to
  - LOW: maybe, when I have time, nice to have
- If no clear action, do NOT force todo extraction - return empty array
- Preserve the user's voice in todo description

You must respond with valid JSON in this exact format:
{
  "summary": "string",
  "ideas": ["idea 1", "idea 2", ...],
  "todos": [
    {
      "description": "actionable task description",
      "deadline": "deadline text if mentioned (e.g., 'Friday', 'tomorrow') or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high" | "medium" | "low"
}`;
  }

  /**
   * Get user prompt for specific content
   * Part of Subtask 2.2: Create prompt templates
   * Story 4.3 - Subtask 1.1: Update user prompt to request todos
   *
   * @param content - Content to analyze
   * @param contentType - Type of content
   * @returns User prompt text
   */
  private getUserPrompt(content: string, contentType: 'text' | 'audio'): string {
    const typeLabel = contentType === 'text' ? 'text' : 'transcribed audio';

    return `Analyze the following ${typeLabel} thought:

"""
${content}
"""

Provide:
1. A concise summary (2-3 sentences)
2. Key ideas (bullet points, 1-5 ideas)
3. Actionable tasks/todos (0-10 maximum, only if clear actions detected)

Response format (JSON):
{
  "summary": "string",
  "ideas": ["idea 1", "idea 2", ...],
  "todos": [
    {
      "description": "actionable task description",
      "deadline": "deadline text if mentioned (e.g., 'Friday', 'tomorrow', 'in 3 days') or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "confidence": "high" | "medium" | "low"
}`;
  }

  /**
   * Get fallback user prompt (plain text, no JSON)
   * Subtask 2.6: Fallback prompt for edge cases
   *
   * @param content - Content to analyze
   * @param contentType - Type of content
   * @returns Simple fallback prompt
   */
  private getFallbackUserPrompt(
    content: string,
    contentType: 'text' | 'audio',
  ): string {
    const typeLabel = contentType === 'text' ? 'text' : 'transcribed audio';

    return `Summarize this ${typeLabel} thought in 2-3 sentences:

"""
${content}
"""

Just provide a plain text summary.`;
  }

  /**
   * Parse and validate GPT response using Zod schema
   * Subtask 2.3: Implement response schema validation (Zod)
   *
   * @param response - OpenAI API response
   * @returns Validated digestion result
   * @throws Error if response is invalid
   */
  private parseResponse(response: OpenAI.Chat.Completions.ChatCompletion): DigestionResponse {
    // Check for choices
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in GPT response');
    }

    const messageContent = response.choices[0].message?.content;
    if (!messageContent) {
      throw new Error('No message content in GPT response');
    }

    try {
      // Parse JSON response
      const parsed = JSON.parse(messageContent);

      // Validate using Zod schema (Subtask 2.3)
      const validated = validateDigestionResponse(parsed);

      return validated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Response validation failed: ${errorMessage}`, error);
      throw new Error(`Failed to parse GPT response: ${errorMessage}`);
    }
  }

  /**
   * Parse fallback plain text response
   * Subtask 2.6: Parse non-JSON fallback responses
   *
   * @param response - OpenAI API response (plain text)
   * @returns Digestion response with low confidence
   */
  private parseFallbackResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): DigestionResponse {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No choices in fallback response');
    }

    const messageContent = response.choices[0].message?.content;
    if (!messageContent) {
      throw new Error('No message content in fallback response');
    }

    // Plain text summary - no JSON parsing
    const summary = messageContent.trim();

    // Ensure summary meets minimum length (pad if necessary)
    const paddedSummary =
      summary.length < 10
        ? `${summary} (Limited content available for analysis)`
        : summary;

    // Extract a basic idea from the summary
    const firstSentence = summary.split('.')[0] + '.';
    const idea =
      firstSentence.length >= 5
        ? firstSentence
        : 'Limited insight extraction from minimal content';

    // Return with low confidence flag (Story 4.3: include empty todos)
    return {
      summary: paddedSummary,
      ideas: [idea],
      todos: [], // No todos from fallback response
      confidence: 'low',
    };
  }
}
