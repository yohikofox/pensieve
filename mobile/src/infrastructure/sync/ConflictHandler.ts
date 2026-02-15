/**
 * ConflictHandler - Last-Write-Wins Conflict Resolution
 *
 * Story 6.2 - Task 8.3: Mobile conflict resolution handler
 *
 * Implements ADR-009.2: Last-Write-Wins Strategy
 * - Server timestamp determines winner
 * - Local DB updated with server version for server_wins
 * - Client version kept for client_wins
 * - Conflicts logged for audit trail
 *
 * @architecture Layer: Infrastructure - Conflict resolution
 * @pattern Last-Write-Wins (MVP approach)
 */

import { DatabaseConnection } from '../../database';
import type { DB } from '@op-engineering/op-sqlite';

/**
 * Conflict information from server
 */
export interface SyncConflict {
  entity: string;
  record_id: string;
  conflict_type: string;
  resolution: 'client_wins' | 'server_wins' | 'merged';
  serverVersion?: any; // Server's version of the record
}

/**
 * ConflictHandler
 *
 * Applies server conflict resolutions to local database
 */
export class ConflictHandler {
  private db: DB;

  // Valid entities for conflict resolution
  private readonly VALID_ENTITIES = ['captures', 'thoughts', 'ideas', 'todos'];

  constructor() {
    this.db = DatabaseConnection.getInstance().getDatabase();
  }

  /**
   * Apply conflict resolutions from server
   *
   * For each conflict:
   * - server_wins: Update local DB with server version
   * - client_wins: Keep local version (no action)
   * - merged: Apply merged version (not implemented in MVP)
   *
   * @param conflicts - Array of conflicts from server sync response
   */
  async applyConflicts(conflicts: SyncConflict[]): Promise<void> {
    if (!conflicts || conflicts.length === 0) {
      return;
    }

    console.log(`[ConflictHandler] Applying ${conflicts.length} conflict(s)...`);

    for (const conflict of conflicts) {
      try {
        await this.applyConflict(conflict);
      } catch (error: any) {
        console.error(
          `[ConflictHandler] Failed to apply conflict for ${conflict.entity}:${conflict.record_id}:`,
          error.message,
        );
        // Continue processing other conflicts
      }
    }

    console.log('[ConflictHandler] ✅ Conflicts applied');
  }

  /**
   * Apply single conflict resolution
   *
   * @param conflict - Conflict to resolve
   */
  private async applyConflict(conflict: SyncConflict): Promise<void> {
    const { entity, record_id, resolution, serverVersion } = conflict;

    // Validate entity
    if (!this.VALID_ENTITIES.includes(entity)) {
      console.warn(
        `[ConflictHandler] Invalid entity type: ${entity}. Skipping.`,
      );
      return;
    }

    // Log conflict
    console.log(
      `[ConflictHandler] Resolving ${entity}:${record_id} → ${resolution}`,
    );

    // Handle resolution strategy
    if (resolution === 'client_wins') {
      // Keep local version - no action needed
      return;
    }

    if (resolution === 'server_wins') {
      // Update local DB with server version
      await this.updateLocalRecord(entity, record_id, serverVersion);
      return;
    }

    if (resolution === 'merged') {
      // Merged resolution not implemented in MVP
      console.warn(
        `[ConflictHandler] Merged resolution not supported yet. Treating as server_wins.`,
      );
      await this.updateLocalRecord(entity, record_id, serverVersion);
      return;
    }
  }

  /**
   * Update local record with server version
   *
   * @param entity - Entity type (captures, todos, etc.)
   * @param recordId - Record ID
   * @param serverVersion - Server's version of the record
   */
  private async updateLocalRecord(
    entity: string,
    recordId: string,
    serverVersion: any,
  ): Promise<void> {
    if (!serverVersion) {
      console.warn(
        `[ConflictHandler] No server version provided for ${entity}:${recordId}`,
      );
      return;
    }

    // Build UPDATE statement dynamically
    const fields = Object.keys(serverVersion).filter((key) => key !== 'id');
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => serverVersion[field]);

    const sql = `UPDATE ${entity} SET ${setClause} WHERE id = ?`;
    const params = [...values, recordId];

    this.db.execute(sql, params);

    console.log(
      `[ConflictHandler] Updated ${entity}:${recordId} with server version`,
    );
  }
}

/**
 * Singleton ConflictHandler instance
 *
 * Export factory function for DI compatibility
 */
let conflictHandlerInstance: ConflictHandler | null = null;

export function getConflictHandler(): ConflictHandler {
  if (!conflictHandlerInstance) {
    conflictHandlerInstance = new ConflictHandler();
  }
  return conflictHandlerInstance;
}
