/**
 * SyncStorage
 * Manages sync metadata persistence in AsyncStorage
 *
 * Story 6.1 - Task 3.3: Implement tracking lastPulledAt per table
 * Stores sync timestamps for incremental sync protocol
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncMetadata } from './types';

const SYNC_PREFIX = 'sync_metadata_';

/**
 * Get storage key for entity
 */
function getKey(entity: string): string {
  return `${SYNC_PREFIX}${entity}`;
}

/**
 * Get sync metadata for entity
 */
export async function getSyncMetadata(
  entity: string,
): Promise<SyncMetadata | null> {
  try {
    const key = getKey(entity);
    const json = await AsyncStorage.getItem(key);

    if (!json) {
      return null;
    }

    return JSON.parse(json) as SyncMetadata;
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
    const key = getKey(entity);
    const json = JSON.stringify(metadata);
    await AsyncStorage.setItem(key, json);
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
    const entities = ['captures', 'thoughts', 'ideas', 'todos'];

    await Promise.all(
      entities.map((entity) => AsyncStorage.removeItem(getKey(entity))),
    );

    console.log('[SyncStorage] Cleared all sync metadata');
  } catch (error) {
    console.error('[SyncStorage] Failed to clear metadata:', error);
    throw error;
  }
}
