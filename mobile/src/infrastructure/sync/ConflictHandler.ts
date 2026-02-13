/**
 * ConflictHandler
 * Client-side conflict resolution handler
 *
 * Story 6.1 - Task 4: Conflict Resolution Logic (Mobile)
 * Applies server-resolved conflicts to local database
 */

import type { SyncConflict } from './types';
import { DatabaseConnection } from '../../database';
import type { DB } from '@op-engineering/op-sqlite';

/**
 * ConflictHandler
 * Handles conflicts returned from server during sync
 */
export class ConflictHandler {
  private db: DB;

  constructor() {
    this.db = DatabaseConnection.getInstance().getDatabase();
  }

  /**
   * Apply conflicts resolved by server
   * Server has already determined the winning version - just apply it
   *
   * @param conflicts Array of conflicts from sync response
   */
  async applyConflicts(conflicts: SyncConflict[]): Promise<void> {
    if (!conflicts || conflicts.length === 0) {
      return;
    }

    console.log(`[ConflictHandler] Applying ${conflicts.length} conflict(s)...`);

    for (const conflict of conflicts) {
      try {
        await this.applyConflict(conflict);
      } catch (error) {
        console.error(
          `[ConflictHandler] Failed to apply conflict for ${conflict.entity}:${conflict.record_id}`,
          error,
        );
        // Continue with other conflicts even if one fails
      }
    }

    console.log('[ConflictHandler] ✅ Conflicts applied');
  }

  /**
   * Apply single conflict resolution
   */
  private async applyConflict(conflict: SyncConflict): Promise<void> {
    const { entity, record_id, resolution } = conflict;

    console.log(
      `[ConflictHandler] Applying conflict: ${entity}:${record_id} (${resolution})`,
    );

    // Server has resolved the conflict and will send the winning version
    // in the next pull response. We just need to:
    // 1. Mark the local record as no longer changed (_changed = 0)
    // 2. Log the conflict for user awareness (optional)

    try {
      // Mark as synced to prevent re-pushing the conflicted version
      this.db.executeSync(
        `UPDATE ${entity} SET _changed = 0 WHERE id = ?`,
        [record_id],
      );

      // Store conflict info in local conflict log (optional - for user UI)
      this.logConflictLocally(conflict);
    } catch (error) {
      console.error(`[ConflictHandler] Database update failed:`, error);
      throw error;
    }
  }

  /**
   * Log conflict locally for user notification
   * Can be used to show "Your changes were merged" notifications
   */
  private logConflictLocally(conflict: SyncConflict): void {
    try {
      // Create local conflicts table if not exists (on-demand)
      this.db.executeSync(`
        CREATE TABLE IF NOT EXISTS local_conflicts (
          id TEXT PRIMARY KEY,
          entity TEXT NOT NULL,
          record_id TEXT NOT NULL,
          conflict_type TEXT NOT NULL,
          resolution TEXT NOT NULL,
          resolved_at INTEGER NOT NULL,
          notified INTEGER NOT NULL DEFAULT 0
        )
      `);

      // Insert conflict record
      this.db.executeSync(
        `INSERT OR REPLACE INTO local_conflicts
         (id, entity, record_id, conflict_type, resolution, resolved_at, notified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${conflict.entity}_${conflict.record_id}_${Date.now()}`,
          conflict.entity,
          conflict.record_id,
          conflict.conflict_type,
          conflict.resolution,
          Date.now(),
          0, // Not yet notified to user
        ],
      );
    } catch (error) {
      // Non-critical - just log and continue
      console.warn('[ConflictHandler] Failed to log conflict locally:', error);
    }
  }

  /**
   * Get unnotified conflicts for user UI
   * Can be used to show a banner: "3 items were merged during sync"
   */
  async getUnnotifiedConflicts(): Promise<SyncConflict[]> {
    try {
      const result = this.db.executeSync(
        `SELECT * FROM local_conflicts WHERE notified = 0 ORDER BY resolved_at DESC`,
      );

      if (!result.rows || result.rows.length === 0) {
        return [];
      }

      const conflicts: SyncConflict[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        conflicts.push({
          entity: row.entity,
          record_id: row.record_id,
          conflict_type: row.conflict_type,
          resolution: row.resolution,
        });
      }

      return conflicts;
    } catch (error) {
      console.error('[ConflictHandler] Failed to get unnotified conflicts:', error);
      return [];
    }
  }

  /**
   * Mark conflicts as notified (after showing to user)
   */
  async markConflictsNotified(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;

    try {
      const placeholders = recordIds.map(() => '?').join(',');
      this.db.executeSync(
        `UPDATE local_conflicts SET notified = 1 WHERE record_id IN (${placeholders})`,
        recordIds,
      );
    } catch (error) {
      console.error('[ConflictHandler] Failed to mark conflicts notified:', error);
    }
  }

  /**
   * Clear old conflicts (older than 30 days)
   */
  async clearOldConflicts(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      this.db.executeSync(
        `DELETE FROM local_conflicts WHERE resolved_at < ?`,
        [thirtyDaysAgo],
      );

      console.log('[ConflictHandler] Old conflicts cleared');
    } catch (error) {
      console.error('[ConflictHandler] Failed to clear old conflicts:', error);
    }
  }
}

/**
 * Singleton instance
 */
let conflictHandlerInstance: ConflictHandler | null = null;

export function getConflictHandler(): ConflictHandler {
  if (!conflictHandlerInstance) {
    conflictHandlerInstance = new ConflictHandler();
  }
  return conflictHandlerInstance;
}
