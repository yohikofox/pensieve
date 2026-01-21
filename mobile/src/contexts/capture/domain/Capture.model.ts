import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Capture Model - WatermelonDB
 *
 * Represents a polymorphic capture: audio | text | image | url
 * Part of Capture Context (Supporting Domain in DDD)
 *
 * @aggregate Capture
 * @events CaptureRecorded, CaptureNormalized
 */
export class Capture extends Model {
  static table = 'captures';

  /**
   * Type of capture
   * Values: 'audio' | 'text' | 'image' | 'url'
   */
  @field('type') type!: string;

  /**
   * Current state of capture
   * Values: 'captured' | 'processing' | 'ready' | 'failed' | 'recording'
   */
  @field('state') state!: string;

  /**
   * Optional project association
   * Null for orphaned captures
   */
  @field('project_id') projectId!: string | null;

  /**
   * Raw content reference
   * - Audio/Image: file path
   * - Text: string content
   * - URL: URL string
   */
  @field('raw_content') rawContent!: string;

  /**
   * Normalized text after transcription
   * Null until transcription completes
   */
  @field('normalized_text') normalizedText!: string | null;

  /**
   * Timestamp when capture was created
   */
  @date('captured_at') capturedAt!: Date;

  /**
   * Optional geolocation (stored as JSON string)
   * Format: { latitude: number, longitude: number }
   */
  @field('location') location!: string | null;

  /**
   * Optional tags (stored as JSON array string)
   * Format: ["tag1", "tag2"]
   */
  @field('tags') tags!: string | null;

  /**
   * Sync status for offline-first
   * Values: 'pending' | 'synced'
   */
  @field('sync_status') syncStatus!: string;

  /**
   * Audio duration in milliseconds
   * Null for non-audio captures
   */
  @field('duration') duration!: number | null;

  /**
   * File size in bytes
   * Null for text/URL captures
   */
  @field('file_size') fileSize!: number | null;

  /**
   * Auto-managed timestamps
   */
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
