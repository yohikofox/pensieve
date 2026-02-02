/**
 * Capture Repository Interface
 *
 * Abstraction for Capture persistence operations.
 * Used for dependency injection with TSyringe.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { type RepositoryResult } from './Result';
import { type Capture } from './Capture.model';

export interface ICaptureRepository {
  /**
   * Create a new Capture entity
   * Note: Sync status is now managed via sync_queue table (v2 architecture)
   */
  create(data: {
    type: 'audio' | 'text' | 'image' | 'url';
    state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
    rawContent: string;
    duration?: number;
  }): Promise<RepositoryResult<Capture>>;

  /**
   * Update an existing Capture entity
   */
  update(
    id: string,
    data: {
      state?: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
      rawContent?: string;
      duration?: number;
      rawTranscript?: string | null;
      normalizedText?: string;
      wavPath?: string | null;
      transcriptPrompt?: string | null;
    }
  ): Promise<RepositoryResult<Capture>>;

  /**
   * Delete a Capture entity
   */
  delete(id: string): Promise<RepositoryResult<void>>;

  /**
   * Find a Capture by ID
   */
  findById(id: string): Promise<Capture | null>;

  /**
   * Find all Captures by state
   */
  findByState(
    state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed'
  ): Promise<Capture[]>;

  /**
   * Find all Captures
   */
  findAll(): Promise<Capture[]>;

  /**
   * Find all Captures with pagination (Story 3.1 - AC4)
   * @param limit - Number of captures to return
   * @param offset - Number of captures to skip
   */
  findAllPaginated(limit: number, offset: number): Promise<Capture[]>;

  /**
   * Get total count of captures (Story 3.1 - for pagination)
   */
  count(): Promise<number>;

  /**
   * Find captures pending synchronization
   * Returns captures that exist in sync_queue with operation IN ('create', 'update', 'delete')
   */
  findPendingSync(): Promise<Capture[]>;

  /**
   * Find captures that are already synchronized
   * Returns captures that do NOT exist in sync_queue
   */
  findSynced(): Promise<Capture[]>;

  /**
   * Find captures with synchronization conflicts
   * Returns captures that exist in sync_queue with operation = 'conflict'
   */
  findConflicts(): Promise<Capture[]>;

  /**
   * Check if a capture is pending synchronization
   */
  isPendingSync(captureId: string): Promise<boolean>;

  /**
   * Check if a capture has a synchronization conflict
   */
  hasConflict(captureId: string): Promise<boolean>;

  /**
   * Observe a Capture by ID - returns Observable that emits on state changes
   * Used for live updates (e.g., transcription completion)
   * Story 3.2 - AC5: Live Transcription Updates
   */
  observeById(id: string): Observable<Capture | null>;
}

/**
 * Observable interface for reactive updates
 */
export interface Observable<T> {
  subscribe(observer: (value: T) => void): Subscription;
}

export interface Subscription {
  unsubscribe(): void;
}
