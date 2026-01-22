/**
 * Capture Repository Interface
 *
 * Abstraction for Capture persistence operations.
 * Used for dependency injection with TSyringe.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { type RepositoryResult } from './Result';
import { type Capture } from './Capture';

export interface ICaptureRepository {
  /**
   * Create a new Capture entity
   */
  create(data: {
    type: 'audio' | 'text' | 'image' | 'url';
    state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
    rawContent: string;
    syncStatus: 'pending' | 'synced';
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
      syncStatus?: 'pending' | 'synced';
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
   * Find all Captures by sync status
   */
  findBySyncStatus(syncStatus: 'pending' | 'synced'): Promise<Capture[]>;

  /**
   * Find all Captures
   */
  findAll(): Promise<Capture[]>;
}
