/**
 * UploadOrchestrator - Audio Upload Workflow Coordinator
 *
 * Story 6.2 - Task 6.6: Hook audio upload after metadata sync success
 *
 * Workflow:
 * 1. Listen for "SyncSuccess" events from SyncService
 * 2. For each synced capture with audio file (type='audio', raw_content exists):
 *    - Enqueue upload via AudioUploadService
 * 3. Background worker processes upload queue
 * 4. After upload success → update capture.audio_url → trigger re-sync
 *
 * Architecture Pattern: Event-Driven Orchestration
 * - SyncService doesn't know about uploads (separation of concerns)
 * - UploadOrchestrator reacts to sync events (loose coupling via EventBus)
 * - AudioUploadService handles actual upload (single responsibility)
 *
 * @architecture Layer: Infrastructure - Workflow orchestration
 * @pattern Event-driven architecture (ADR-019: EventBus)
 */

import type { Subscription } from 'rxjs';
import type { EventBus } from '@/contexts/shared/events/EventBus';
import type { DomainEvent } from '@/contexts/shared/events/DomainEvent';
import type { AudioUploadService } from './AudioUploadService';
import { database } from '../../database';
import { RepositoryResultType } from '@/contexts/shared/domain/Result';

/**
 * SyncSuccess event payload
 */
export interface SyncSuccessPayload {
  syncedCaptureIds: string[];
}

/**
 * SyncSuccess domain event
 */
export interface SyncSuccessEvent extends DomainEvent {
  type: 'SyncSuccess';
  payload: SyncSuccessPayload;
}

/**
 * Audio capture from database
 */
interface AudioCapture {
  id: string;
  type: string;
  raw_content: string | null;
  file_size: number | null;
}

/**
 * UploadOrchestrator - Coordinates audio uploads after metadata sync
 *
 * Lifecycle:
 * - Start: Call start() to begin listening for SyncSuccess events
 * - Stop: Call stop() to cleanup subscriptions
 */
export class UploadOrchestrator {
  private subscription: Subscription | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly audioUploadService: AudioUploadService,
  ) {
    // Auto-start listening on instantiation
    this.start();
  }

  /**
   * Start listening for SyncSuccess events
   */
  start(): void {
    if (this.subscription) {
      return; // Already started
    }

    this.subscription = this.eventBus.subscribe<SyncSuccessEvent>(
      'SyncSuccess',
      (event) => {
        // Handle event asynchronously (fire-and-forget)
        this.handleSyncSuccess(event).catch((error) => {
          console.error('[UploadOrchestrator] Error handling SyncSuccess:', error);
        });
      },
    );
  }

  /**
   * Set auth token for upload requests (mirrors SyncService pattern)
   *
   * @param token - Bearer token from the authenticated session
   */
  setAuthToken(token: string): void {
    this.audioUploadService.setAuthToken(token);
  }

  /**
   * Stop listening for events and cleanup
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  /**
   * Handle SyncSuccess event - enqueue audio uploads for synced captures
   *
   * @param event - SyncSuccess event with list of synced capture IDs
   */
  private async handleSyncSuccess(event: SyncSuccessEvent): Promise<void> {
    const { syncedCaptureIds } = event.payload;

    // Early exit if no captures synced
    if (!syncedCaptureIds || syncedCaptureIds.length === 0) {
      return;
    }

    try {
      // Query audio captures from database
      const audioCaptures = await this.fetchAudioCaptures(syncedCaptureIds);

      // Enqueue uploads for each audio capture with file
      for (const capture of audioCaptures) {
        await this.enqueueAudioUpload(capture);
      }

      // Process the upload queue immediately after enqueuing
      await this.processUploadQueue();
    } catch (error: any) {
      // Log error but don't throw (non-blocking background operation)
      console.error('[UploadOrchestrator] Failed to process audio uploads:', error.message);
    }
  }

  /**
   * Process pending uploads from the upload queue
   *
   * Consumes all pending entries in upload_queue, calling AudioUploadService.uploadFile()
   * for each, then persists the returned audioUrl into captures.audio_url.
   */
  private async processUploadQueue(): Promise<void> {
    const pendingResult = await this.audioUploadService.getPendingUploads();

    if (pendingResult.type !== RepositoryResultType.SUCCESS) {
      console.error('[UploadOrchestrator] Failed to read pending uploads:', pendingResult.error);
      return;
    }

    const pending = pendingResult.data ?? [];

    if (pending.length === 0) {
      return;
    }

    console.log(`[UploadOrchestrator] Processing ${pending.length} pending upload(s)...`);

    for (const upload of pending) {
      const uploadResult = await this.audioUploadService.uploadFile(
        upload.id,
        upload.capture_id,
        upload.file_path,
        upload.file_size,
      );

      if (uploadResult.type === RepositoryResultType.SUCCESS && uploadResult.data?.audioUrl) {
        console.log(`[UploadOrchestrator] Upload success for capture ${upload.capture_id}`);
        await this.updateCaptureAudioUrl(upload.capture_id, uploadResult.data.audioUrl);
      } else {
        console.error(
          `[UploadOrchestrator] Upload failed for capture ${upload.capture_id}:`,
          uploadResult.error,
        );
      }
    }
  }

  /**
   * Persist the audioUrl returned by the backend into captures.audio_url
   *
   * Allows LazyAudioDownloader to retrieve the file after reinstall.
   *
   * @param captureId - Local capture ID (primary key of captures table)
   * @param audioUrl  - MinIO path returned by the upload endpoint
   */
  private async updateCaptureAudioUrl(captureId: string, audioUrl: string): Promise<void> {
    try {
      database.execute(
        'UPDATE captures SET audio_url = ?, updated_at = ? WHERE id = ?',
        [audioUrl, Date.now(), captureId],
      );
      console.log(`[UploadOrchestrator] audio_url persisted for capture ${captureId}`);
    } catch (error: any) {
      console.error(
        `[UploadOrchestrator] Failed to persist audio_url for ${captureId}:`,
        error.message,
      );
    }
  }

  /**
   * Fetch audio captures from database
   *
   * Filters for:
   * - type = 'audio'
   * - raw_content IS NOT NULL (has file path)
   *
   * @param captureIds - List of capture IDs to query
   * @returns List of audio captures with file paths
   */
  private async fetchAudioCaptures(captureIds: string[]): Promise<AudioCapture[]> {
    if (captureIds.length === 0) {
      return [];
    }

    try {
      // Build placeholders for IN clause
      const placeholders = captureIds.map(() => '?').join(', ');

      const result = database.execute(
        `SELECT id, type, raw_content, file_size
         FROM captures
         WHERE id IN (${placeholders})
           AND type = 'audio'
           AND raw_content IS NOT NULL`,
        captureIds,
      );

      return (result.rows as AudioCapture[]) || [];
    } catch (error: any) {
      console.error('[UploadOrchestrator] Database query failed:', error.message);
      return [];
    }
  }

  /**
   * Enqueue audio upload for a capture
   *
   * @param capture - Audio capture with file path
   */
  private async enqueueAudioUpload(capture: AudioCapture): Promise<void> {
    const { id: captureId, raw_content: filePath, file_size: fileSize } = capture;

    // Validate required fields
    if (!filePath || !fileSize) {
      console.warn(`[UploadOrchestrator] Skipping capture ${captureId}: missing file path or size`);
      return;
    }

    try {
      const result = await this.audioUploadService.enqueueUpload(captureId, filePath, fileSize);

      if (result.type === RepositoryResultType.SUCCESS) {
        console.log(`[UploadOrchestrator] Enqueued upload for capture ${captureId}: ${result.data?.uploadId}`);
      } else {
        console.error(`[UploadOrchestrator] Failed to enqueue upload for capture ${captureId}:`, result.error);
      }
    } catch (error: any) {
      console.error(`[UploadOrchestrator] Error enqueuing upload for capture ${captureId}:`, error.message);
    }
  }
}
