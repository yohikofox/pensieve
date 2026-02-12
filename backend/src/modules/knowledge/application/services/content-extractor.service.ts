/**
 * Content Extractor Service
 * Extracts content from Capture entities for AI digestion
 *
 * Covers:
 * - Subtask 3.1: Implement text capture content extraction
 * - Subtask 3.2: Implement audio transcription extraction
 * - Subtask 3.3: Add content type-specific prompt adjustments
 * - Subtask 3.4: Handle edge cases (empty content, special characters)
 *
 * AC2: Text Capture Digestion (FR11)
 * AC3: Audio Capture with Transcription Digestion (FR12)
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  ICaptureContentRepository,
  ExtractedContent,
} from '../../domain/interfaces/capture-content-repository.interface';

@Injectable()
export class ContentExtractorService {
  private readonly logger = new Logger(ContentExtractorService.name);

  constructor(
    @Inject('CAPTURE_CONTENT_REPOSITORY')
    private readonly captureContentRepo: ICaptureContentRepository,
  ) {}

  /**
   * Extract content from capture based on type
   * Subtask 3.1 + 3.2: Content extraction logic
   *
   * @param captureId - Capture to extract content from
   * @returns Extracted content with type
   * @throws Error if content is empty or invalid
   */
  async extractContent(captureId: string): Promise<ExtractedContent> {
    this.logger.log(`📤 Extracting content from capture: ${captureId}`);

    try {
      // Subtask 3.3: Determine capture type
      const captureType = await this.captureContentRepo.getType(captureId);

      let content: string | null;
      let contentType: 'text' | 'audio';

      if (captureType === 'TEXT') {
        // Subtask 3.1: Extract text capture content
        this.logger.debug(`Extracting TEXT content for ${captureId}`);
        content = await this.captureContentRepo.getContent(captureId);
        contentType = 'text';

        if (content === null || content === undefined) {
          throw new Error(
            `No content available for TEXT capture: ${captureId}`,
          );
        }
      } else if (captureType === 'AUDIO') {
        // Subtask 3.2: Extract audio transcription
        this.logger.debug(`Extracting AUDIO transcription for ${captureId}`);
        content = await this.captureContentRepo.getTranscription(captureId);
        contentType = 'audio';

        if (content === null || content === undefined) {
          throw new Error(
            `No transcription available for AUDIO capture: ${captureId}`,
          );
        }
      } else {
        throw new Error(`Unknown capture type: ${captureType}`);
      }

      // Subtask 3.4: Handle edge cases - trim whitespace
      const trimmedContent = content.trim();

      // Subtask 3.4: Validate content is not empty after trimming
      if (trimmedContent.length === 0) {
        throw new Error(`Empty content: ${captureId}`);
      }

      this.logger.log(
        `✅ Content extracted (${contentType}): ${trimmedContent.length} chars`,
      );

      return {
        content: trimmedContent,
        contentType,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Content extraction failed: ${errorMessage}`, error);
      throw error;
    }
  }
}
