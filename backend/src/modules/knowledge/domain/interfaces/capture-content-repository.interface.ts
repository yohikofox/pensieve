/**
 * Capture Content Repository Interface
 * Extended interface for content extraction during digestion
 *
 * Story 4.2 Task 3: Content extraction from Capture entities
 * This interface will be implemented by Capture Context
 */

export interface ICaptureContentRepository {
  /**
   * Get raw text content from TEXT capture
   * Subtask 3.1: Text capture content extraction
   *
   * @param captureId - Capture to get content from
   * @returns Raw text content
   */
  getContent(captureId: string): Promise<string | null>;

  /**
   * Get transcription from AUDIO capture
   * Subtask 3.2: Audio transcription extraction
   *
   * @param captureId - Capture to get transcription from
   * @returns Transcribed text
   */
  getTranscription(captureId: string): Promise<string | null>;

  /**
   * Get capture type (TEXT or AUDIO)
   * Subtask 3.3: Content type-specific handling
   *
   * @param captureId - Capture to check
   * @returns Capture type
   */
  getType(captureId: string): Promise<'TEXT' | 'AUDIO'>;
}

/**
 * Extracted content result
 */
export interface ExtractedContent {
  content: string;
  contentType: 'text' | 'audio';
}
