/**
 * Content Chunker Service
 * Splits long content into manageable chunks for GPT processing
 *
 * Covers:
 * - Subtask 7.1: Implement token counter utility (tiktoken)
 * - Subtask 7.2: Create content chunking algorithm with overlap
 * - Subtask 7.4: Merge chunk summaries into coherent final summary
 *
 * AC6: Long Content Chunking Strategy
 */

import { Injectable, Logger } from '@nestjs/common';
import { encoding_for_model } from 'tiktoken';
import type { TiktokenModel } from 'tiktoken';
import type { DigestionResponse } from '../../domain/schemas/digestion-response.schema';
import { OpenAIService } from './openai.service';

export interface ChunkingResult {
  summary: string;
  ideas: string[];
  todos: Array<{
    description: string;
    deadline: string | null;
    priority: 'low' | 'medium' | 'high';
  }>; // Story 4.3
  confidence: 'high' | 'medium' | 'low';
  wasChunked: boolean;
  chunkCount?: number;
}

@Injectable()
export class ContentChunkerService {
  private readonly logger = new Logger(ContentChunkerService.name);
  private readonly model: TiktokenModel = 'gpt-4o-mini' as TiktokenModel;
  private readonly maxTokensPerChunk = 4000; // Target chunk size
  private readonly overlapTokens = 200; // Overlap to preserve context

  constructor(private readonly openaiService: OpenAIService) {}

  /**
   * Process content with chunking if needed
   * Subtask 7.2: Chunking algorithm with overlap
   *
   * @param content - Content to process
   * @param contentType - Type of content
   * @returns Digestion result (chunked or direct)
   */
  async processContent(
    content: string,
    contentType: 'text' | 'audio',
  ): Promise<ChunkingResult> {
    // Subtask 7.1: Count tokens
    const tokenCount = this.countTokens(content);

    this.logger.log(
      `📊 Content size: ${tokenCount} tokens, ${content.length} chars`,
    );

    // If within limits, process directly
    if (tokenCount <= this.maxTokensPerChunk) {
      this.logger.log('✅ Content within limits, processing directly');
      const result = await this.openaiService.digestContent(
        content,
        contentType,
      );
      return {
        ...result,
        wasChunked: false,
      };
    }

    // Content too long, needs chunking
    const estimatedChunks = Math.ceil(tokenCount / this.maxTokensPerChunk);
    this.logger.log(
      `🔪 Content exceeds limit, chunking into ~${estimatedChunks} chunks`,
    );

    // Warning: Sequential chunking may exceed job timeout (AC6 + NFR3 conflict)
    // Each chunk takes ~30s, job timeout is 60s
    // TODO Story 4.2 Follow-up: Implement parallel chunking or adaptive timeout
    if (estimatedChunks > 2) {
      this.logger.warn(
        `⚠️  ${estimatedChunks} chunks detected - may exceed 60s job timeout. ` +
          `Consider parallel processing for content > 8000 tokens.`,
      );
    }

    return await this.processChunkedContent(content, contentType);
  }

  /**
   * Count tokens in content
   * Subtask 7.1: Token counter utility
   *
   * @param content - Content to count tokens for
   * @returns Number of tokens
   */
  private countTokens(content: string): number {
    try {
      const encoding = encoding_for_model(this.model);
      const tokens = encoding.encode(content);
      encoding.free();
      return tokens.length;
    } catch (error) {
      this.logger.error('Error counting tokens', error);
      // Fallback: rough estimation (1 token ≈ 4 chars)
      return Math.ceil(content.length / 4);
    }
  }

  /**
   * Process content by splitting into chunks
   * Subtask 7.3: Process chunks sequentially with GPT-4o-mini
   *
   * @param content - Long content to chunk
   * @param contentType - Type of content
   * @returns Merged digestion result
   */
  private async processChunkedContent(
    content: string,
    contentType: 'text' | 'audio',
  ): Promise<ChunkingResult> {
    // Split into chunks with overlap
    const chunks = this.splitIntoChunks(content);
    this.logger.log(`📦 Split into ${chunks.length} chunks`);

    const chunkResults: DigestionResponse[] = [];

    // Subtask 7.3: Process each chunk sequentially
    for (let i = 0; i < chunks.length; i++) {
      this.logger.log(`⚙️  Processing chunk ${i + 1}/${chunks.length}...`);
      const result = await this.openaiService.digestContent(
        chunks[i],
        contentType,
      );
      chunkResults.push(result);
    }

    // Subtask 7.4: Merge chunk summaries and ideas
    return this.mergeChunkResults(chunkResults, chunks.length);
  }

  /**
   * Split content into overlapping chunks
   * Subtask 7.2: Content chunking algorithm with overlap
   *
   * @param content - Content to split
   * @returns Array of content chunks
   */
  private splitIntoChunks(content: string): string[] {
    const encoding = encoding_for_model(this.model);
    const tokens = encoding.encode(content);
    encoding.free();

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < tokens.length) {
      // Calculate chunk end with max tokens
      const endIndex = Math.min(
        startIndex + this.maxTokensPerChunk,
        tokens.length,
      );

      // Extract chunk tokens
      const chunkTokens = tokens.slice(startIndex, endIndex);

      // Decode back to text
      const encodingForDecode = encoding_for_model(this.model);
      const decoded = encodingForDecode.decode(chunkTokens);
      encodingForDecode.free();

      // Handle Uint8Array from tiktoken (convert to string)
      const chunkText =
        typeof decoded === 'string'
          ? decoded
          : new TextDecoder().decode(decoded);

      chunks.push(chunkText);

      // Move start index with overlap
      // If this is the last chunk, break
      if (endIndex >= tokens.length) break;

      // Next chunk starts with overlap
      startIndex = endIndex - this.overlapTokens;
    }

    return chunks;
  }

  /**
   * Merge results from multiple chunks
   * Subtask 7.4: Merge chunk summaries into coherent final summary
   *
   * @param chunkResults - Results from each chunk
   * @param chunkCount - Number of chunks processed
   * @returns Merged result
   */
  private mergeChunkResults(
    chunkResults: DigestionResponse[],
    chunkCount: number,
  ): ChunkingResult {
    // Merge summaries (take first 2-3 sentences from each, then synthesize)
    const allSummaries = chunkResults.map((r) => r.summary);
    const mergedSummary = this.synthesizeSummaries(allSummaries);

    // Merge and deduplicate ideas
    const allIdeas = chunkResults.flatMap((r) => r.ideas);
    const uniqueIdeas = this.deduplicateIdeas(allIdeas);

    // Story 4.3: Merge todos from all chunks (max 10)
    const allTodos = chunkResults.flatMap((r) => r.todos || []);
    const uniqueTodos = allTodos.slice(0, 10); // Simple truncation for now, could deduplicate by description

    // Determine overall confidence (lowest from all chunks)
    const confidenceLevels = ['high', 'medium', 'low'] as const;
    const minConfidence = chunkResults.reduce(
      (min, r) => {
        const currentLevel = confidenceLevels.indexOf(r.confidence || 'high');
        const minLevel = confidenceLevels.indexOf(min);
        return currentLevel > minLevel ? r.confidence || 'high' : min;
      },
      'high' as 'high' | 'medium' | 'low',
    );

    // Downgrade confidence for very long content
    const finalConfidence =
      chunkCount > 3 && minConfidence === 'high' ? 'medium' : minConfidence;

    this.logger.log(
      `✅ Merged ${chunkCount} chunks → ${uniqueIdeas.length} unique ideas, ${uniqueTodos.length} todos`,
    );

    return {
      summary: mergedSummary,
      ideas: uniqueIdeas.slice(0, 10), // Max 10 ideas
      todos: uniqueTodos, // Story 4.3: Include todos
      confidence: finalConfidence,
      wasChunked: true,
      chunkCount,
    };
  }

  /**
   * Synthesize multiple summaries into one coherent summary
   *
   * @param summaries - Array of chunk summaries
   * @returns Combined summary
   */
  private synthesizeSummaries(summaries: string[]): string {
    if (summaries.length === 1) return summaries[0];

    // Take key sentences from each summary
    const keySentences = summaries.map((s) => {
      const sentences = s
        .split(/[.!?]+/)
        .filter((sent) => sent.trim().length > 0);
      return sentences[0]?.trim(); // First sentence from each
    });

    // Combine into coherent summary (max 3 sentences)
    const combined = keySentences
      .filter((s) => s && s.length > 10)
      .slice(0, 3)
      .join('. ');

    return combined + (combined.endsWith('.') ? '' : '.');
  }

  /**
   * Deduplicate ideas by semantic similarity
   *
   * @param ideas - Array of all ideas from chunks
   * @returns Deduplicated ideas
   */
  private deduplicateIdeas(ideas: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const idea of ideas) {
      // Normalize for comparison
      const normalized = idea.toLowerCase().trim();

      // Simple deduplication: exact match or very similar
      let isDuplicate = false;
      for (const seenIdea of seen) {
        if (
          normalized === seenIdea ||
          this.calculateSimilarity(normalized, seenIdea) > 0.8
        ) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(idea);
        seen.add(normalized);
      }
    }

    return unique;
  }

  /**
   * Calculate simple string similarity (Jaccard similarity on words)
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score 0-1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }
}
