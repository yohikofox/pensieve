/**
 * LargeSecureStore — Supabase auth storage adapter using expo-secure-store
 *
 * ADR-022 + ADR-010 compliance: auth tokens MUST use expo-secure-store (Keychain iOS).
 * Problem: expo-secure-store has a ~2KB limit per entry on iOS Keychain.
 * Supabase sessions (JWT + refresh token + metadata) can exceed 2KB.
 * Solution: chunk large values across multiple Keychain entries.
 *
 * Based on Supabase's recommended React Native pattern.
 * See: https://supabase.com/docs/guides/auth/auth-helpers/auth-ui?framework=expo
 */

import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 2048;

/**
 * Get the chunk count key for a given storage key
 */
function chunkCountKey(key: string): string {
  return `${key}.__chunks`;
}

/**
 * Get the chunk key for a given storage key and chunk index (1-based)
 */
function chunkKey(key: string, index: number): string {
  return `${key}.__chunk_${index}`;
}

export const LargeSecureStore = {
  /**
   * Store a potentially large value by chunking it across multiple Keychain entries
   */
  async setItem(key: string, value: string): Promise<void> {
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(chunkCountKey(key), String(chunks));
    for (let i = 0; i < chunks; i++) {
      const chunk = value.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(chunkKey(key, i + 1), chunk);
    }
  },

  /**
   * Retrieve a stored value, reassembling chunks
   */
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(chunkCountKey(key));
    if (countStr === null) {
      return null;
    }
    const count = parseInt(countStr, 10);
    let value = '';
    for (let i = 1; i <= count; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
      if (chunk === null) {
        // Chunk missing — data corrupted, return null to force re-auth
        console.warn(`[LargeSecureStore] Missing chunk ${i} for key "${key}"`);
        return null;
      }
      value += chunk;
    }
    return value;
  },

  /**
   * Remove a stored value and all its chunks
   */
  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(chunkCountKey(key));
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      for (let i = 1; i <= count; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
      }
    }
    await SecureStore.deleteItemAsync(chunkCountKey(key));
  },
};
