/**
 * Digestion Job Payload Interface
 * Defines the structure of messages published to RabbitMQ digestion queue
 *
 * Covers Subtask 2.2: Define DigestionJob payload interface
 */

export type ContentType = 'text' | 'audio_transcribed';
export type Priority = 'high' | 'normal';

export interface DigestionJobPayload {
  /**
   * UUID of the capture to digest
   */
  captureId: string;

  /**
   * UUID of the capture owner (for user data isolation - NFR13)
   */
  userId: string;

  /**
   * Type of content being digested
   * - 'text': Direct text capture (Story 2.2)
   * - 'audio_transcribed': Audio capture after transcription (Story 2.5)
   */
  contentType: ContentType;

  /**
   * Job priority
   * - 'high': User-initiated actions (immediate processing)
   * - 'normal': Auto-background processing
   */
  priority: Priority;

  /**
   * Timestamp when job was queued
   */
  queuedAt: Date;

  /**
   * Current retry attempt count (starts at 0)
   * Increments on each retry (max 3 attempts - AC5)
   */
  retryCount: number;
}

/**
 * Input data for creating a digestion job
 */
export interface CreateDigestionJobInput {
  captureId: string;
  userId: string;
  type: 'TEXT' | 'AUDIO';
  state: string;
  userInitiated?: boolean;
}
