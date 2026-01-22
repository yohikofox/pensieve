/**
 * Mock Capture Repository for Acceptance Tests
 *
 * In-memory implementation of ICaptureRepository for BDD tests.
 * Uses Map for fast lookups and state management.
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { v4 as uuidv4 } from 'uuid';
import { type ICaptureRepository } from '../../../../src/contexts/capture/domain/ICaptureRepository';
import { type Capture } from '../../../../src/contexts/capture/domain/Capture.model';
import { type RepositoryResult, success, databaseError } from '../../../../src/contexts/capture/domain/Result';

export class MockCaptureRepository implements ICaptureRepository {
  private captures: Map<string, Capture> = new Map();

  async create(data: {
    type: 'audio' | 'text' | 'image' | 'url';
    state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
    rawContent: string;
    syncStatus: 'pending' | 'synced';
    duration?: number;
  }): Promise<RepositoryResult<Capture>> {
    const id = uuidv4();
    const now = Date.now();

    const capture: Capture = {
      id,
      type: data.type,
      state: data.state.toUpperCase() as any,
      rawContent: data.rawContent,
      duration: data.duration,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      capturedAt: new Date(now),
      syncStatus: data.syncStatus,
      syncVersion: 0,
    };

    this.captures.set(id, capture);
    return success(capture);
  }

  async update(
    id: string,
    updates: {
      state?: 'recording' | 'captured' | 'processing' | 'ready' | 'failed';
      rawContent?: string;
      duration?: number;
      syncStatus?: 'pending' | 'synced';
    }
  ): Promise<RepositoryResult<Capture>> {
    const capture = this.captures.get(id);

    if (!capture) {
      return databaseError(`Capture not found: ${id}`);
    }

    const updated: Capture = {
      ...capture,
      state: updates.state ? (updates.state.toUpperCase() as any) : capture.state,
      rawContent: updates.rawContent ?? capture.rawContent,
      duration: updates.duration ?? capture.duration,
      syncStatus: updates.syncStatus ?? capture.syncStatus,
      updatedAt: new Date(),
      syncVersion: (capture.syncVersion ?? 0) + 1,
    };

    this.captures.set(id, updated);
    return success(updated);
  }

  async delete(id: string): Promise<RepositoryResult<void>> {
    this.captures.delete(id);
    return success(undefined as void);
  }

  async findByState(
    state: 'recording' | 'captured' | 'processing' | 'ready' | 'failed'
  ): Promise<Capture[]> {
    const stateUpper = state.toUpperCase();
    return Array.from(this.captures.values()).filter((c) => c.state === stateUpper);
  }

  async findBySyncStatus(syncStatus: 'pending' | 'synced'): Promise<Capture[]> {
    return Array.from(this.captures.values()).filter((c) => c.syncStatus === syncStatus);
  }

  async findAll(): Promise<Capture[]> {
    return Array.from(this.captures.values());
  }

  // Test helpers
  reset() {
    this.captures.clear();
  }

  getById(id: string): Capture | undefined {
    return this.captures.get(id);
  }
}
