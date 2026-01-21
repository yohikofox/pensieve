/**
 * Capture Repository - Data Access Layer
 *
 * Status: 🔴 RED PHASE - Stub for TDD
 *
 * This repository handles:
 * - CRUD operations on Capture entities
 * - Querying by state, syncStatus
 * - WatermelonDB integration (mocked in tests)
 *
 * Story: 2.1 - Capture Audio 1-Tap
 */

import { InMemoryDatabase, Capture } from '../../tests/acceptance/support/test-context';

export class CaptureRepository {
  private db: InMemoryDatabase;

  constructor(db: InMemoryDatabase) {
    this.db = db;
  }

  /**
   * Create a new Capture entity
   */
  async create(data: Partial<Capture>): Promise<Capture> {
    return await this.db.create(data);
  }

  /**
   * Update an existing Capture entity
   */
  async update(id: string, updates: Partial<Capture>): Promise<Capture> {
    return await this.db.update(id, updates);
  }

  /**
   * Find Capture by ID
   */
  async findById(id: string): Promise<Capture | null> {
    return await this.db.findById(id);
  }

  /**
   * Find all Captures
   */
  async findAll(): Promise<Capture[]> {
    return await this.db.findAll();
  }

  /**
   * Find Captures by state (RECORDING, CAPTURED, RECOVERED)
   */
  async findByState(state: Capture['state']): Promise<Capture[]> {
    return await this.db.findByState(state);
  }

  /**
   * Find Captures by syncStatus (pending, synced, failed)
   */
  async findBySyncStatus(syncStatus: Capture['syncStatus']): Promise<Capture[]> {
    return await this.db.findBySyncStatus(syncStatus);
  }

  /**
   * Delete a Capture
   */
  async delete(id: string): Promise<void> {
    await this.db.delete(id);
  }
}
