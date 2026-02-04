/**
 * Capture Repository Interface
 * Stub interface for Capture Context integration
 *
 * Story 4.1: This interface will be implemented by Capture Context
 * to allow Knowledge Context to update capture statuses
 */

export interface ICaptureRepository {
  /**
   * Update capture status during digestion lifecycle
   * @param captureId - Capture to update
   * @param status - New status
   * @param metadata - Optional metadata (timestamps, errors)
   */
  updateStatus(
    captureId: string,
    status: CaptureDigestionStatus,
    metadata?: CaptureStatusMetadata,
  ): Promise<void>;

  /**
   * Find capture by ID (for validation)
   * @param captureId - Capture to find
   * @returns Capture or null if not found
   */
  findById(captureId: string): Promise<CaptureBasicInfo | null>;
}

export type CaptureDigestionStatus =
  | 'queued_for_digestion'
  | 'digesting'
  | 'digested'
  | 'digestion_failed';

export interface CaptureStatusMetadata {
  processing_started_at?: Date;
  processing_completed_at?: Date;
  error_message?: string;
  error_stack?: string;
}

export interface CaptureBasicInfo {
  id: string;
  userId: string;
  type: 'AUDIO' | 'TEXT';
  status: string;
}
