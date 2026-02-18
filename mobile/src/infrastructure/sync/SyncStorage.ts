/**
 * SyncStorage
 * Manages sync metadata persistence in OP-SQLite
 *
 * ADR-022 compliance: sync metadata (lastPulledAt, sync queue) MUST use OP-SQLite.
 * Previously used AsyncStorage — migrated by Story 14.2 (audit ADR-022).
 *
 * Story 6.1 - Task 3.3: Implement tracking lastPulledAt per table
 * Stores sync timestamps for incremental sync protocol
 */

import { database } from '../../database';
import type { SyncMetadata } from './types';

/**
 * Get sync metadata for entity
 */
export async function getSyncMetadata(
  entity: string,
): Promise<SyncMetadata | null> {
  try {
    const db = database.getDatabase();
    const result = db.executeSync(
      'SELECT * FROM sync_metadata WHERE entity = ?',
      [entity],
    );
    const rows = result.rows ?? [];
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0] as any;
    return {
      entity: row.entity,
      last_pulled_at: row.last_pulled_at,
      last_pushed_at: row.last_pushed_at,
      last_sync_status: row.last_sync_status,
      last_sync_error: row.last_sync_error ?? undefined,
      updated_at: row.updated_at,
    } as SyncMetadata;
  } catch (error) {
    console.error(`[SyncStorage] Failed to get metadata for ${entity}:`, error);
    return null;
  }
}

/**
 * Set sync metadata for entity
 */
export async function setSyncMetadata(
  entity: string,
  metadata: SyncMetadata,
): Promise<void> {
  try {
    const db = database.getDatabase();
    db.executeSync(
      `INSERT INTO sync_metadata (
        entity, last_pulled_at, last_pushed_at, last_sync_status, last_sync_error, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity) DO UPDATE SET
        last_pulled_at = excluded.last_pulled_at,
        last_pushed_at = excluded.last_pushed_at,
        last_sync_status = excluded.last_sync_status,
        last_sync_error = excluded.last_sync_error,
        updated_at = excluded.updated_at`,
      [
        entity,
        metadata.last_pulled_at,
        metadata.last_pushed_at,
        metadata.last_sync_status,
        metadata.last_sync_error ?? null,
        metadata.updated_at,
      ],
    );
  } catch (error) {
    console.error(`[SyncStorage] Failed to set metadata for ${entity}:`, error);
    throw error;
  }
}

/**
 * Get lastPulledAt timestamp for entity
 */
export async function getLastPulledAt(entity: string): Promise<number> {
  const metadata = await getSyncMetadata(entity);
  return metadata?.last_pulled_at ?? 0; // 0 = full sync
}

/**
 * Update lastPulledAt timestamp for entity
 */
export async function updateLastPulledAt(
  entity: string,
  timestamp: number,
): Promise<void> {
  const existing = await getSyncMetadata(entity);

  const updated: SyncMetadata = {
    entity,
    last_pulled_at: timestamp,
    last_pushed_at: existing?.last_pushed_at ?? 0,
    last_sync_status: 'success',
    last_sync_error: undefined,
    updated_at: Date.now(),
  };

  await setSyncMetadata(entity, updated);
}

/**
 * Update lastPushedAt timestamp for entity
 */
export async function updateLastPushedAt(
  entity: string,
  timestamp: number,
): Promise<void> {
  const existing = await getSyncMetadata(entity);

  const updated: SyncMetadata = {
    entity,
    last_pulled_at: existing?.last_pulled_at ?? 0,
    last_pushed_at: timestamp,
    last_sync_status: 'success',
    last_sync_error: undefined,
    updated_at: Date.now(),
  };

  await setSyncMetadata(entity, updated);
}

/**
 * Update sync status (for error tracking)
 */
export async function updateSyncStatus(
  entity: string,
  status: 'success' | 'error' | 'in_progress',
  error?: string,
): Promise<void> {
  const existing = await getSyncMetadata(entity);

  const updated: SyncMetadata = {
    entity,
    last_pulled_at: existing?.last_pulled_at ?? 0,
    last_pushed_at: existing?.last_pushed_at ?? 0,
    last_sync_status: status,
    last_sync_error: error,
    updated_at: Date.now(),
  };

  await setSyncMetadata(entity, updated);
}

/**
 * Clear all sync metadata (for logout or reset)
 */
export async function clearAllSyncMetadata(): Promise<void> {
  try {
    const db = database.getDatabase();
    const entities = ['captures', 'thoughts', 'ideas', 'todos'];
    entities.forEach((entity) => {
      db.executeSync('DELETE FROM sync_metadata WHERE entity = ?', [entity]);
    });
    console.log('[SyncStorage] Cleared all sync metadata');
  } catch (error) {
    console.error('[SyncStorage] Failed to clear metadata:', error);
    throw error;
  }
}
