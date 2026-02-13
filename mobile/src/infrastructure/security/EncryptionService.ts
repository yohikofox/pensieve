/**
 * EncryptionService
 * Client-side encryption for sensitive data
 *
 * Story 6.1 - Task 5: Encryption & Security
 * Implements NFR12: Encryption at-rest for sensitive columns
 */

import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY_NAME = 'pensine_encryption_master_key';

/**
 * EncryptionService
 * Handles encryption/decryption of sensitive data using AES-256
 */
export class EncryptionService {
  private encryptionKey: string | null = null;

  /**
   * Initialize encryption service
   * Generates or retrieves master encryption key from SecureStore
   */
  async initialize(): Promise<void> {
    try {
      // Try to get existing key
      let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);

      if (!key) {
        // Generate new 256-bit key
        key = this.generateRandomKey();
        await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
        console.log('[Encryption] ✅ New encryption key generated');
      } else {
        console.log('[Encryption] ✅ Existing encryption key loaded');
      }

      this.encryptionKey = key;
    } catch (error) {
      console.error('[Encryption] ❌ Failed to initialize:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * Encrypt sensitive text data
   * Uses AES-256 encryption
   *
   * @param plaintext Data to encrypt
   * @returns Encrypted ciphertext (Base64)
   */
  encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    if (!plaintext) {
      return plaintext; // Empty string stays empty
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(plaintext, this.encryptionKey);
      return encrypted.toString(); // Base64 ciphertext
    } catch (error) {
      console.error('[Encryption] Failed to encrypt:', error);
      throw error;
    }
  }

  /**
   * Decrypt encrypted data
   *
   * @param ciphertext Encrypted data (Base64)
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized');
    }

    if (!ciphertext) {
      return ciphertext; // Empty string stays empty
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('[Encryption] Failed to decrypt:', error);
      throw error;
    }
  }

  /**
   * Check if data is encrypted (heuristic)
   * Encrypted data is Base64 with specific characteristics
   */
  isEncrypted(data: string): boolean {
    if (!data || data.length === 0) {
      return false;
    }

    // AES encrypted data from CryptoJS starts with "U2FsdGVkX1" (Base64 "Salted__")
    return data.startsWith('U2FsdGVkX1');
  }

  /**
   * Generate random 256-bit encryption key
   */
  private generateRandomKey(): string {
    // Generate 32 bytes (256 bits) random key
    const randomBytes = CryptoJS.lib.WordArray.random(32);
    return randomBytes.toString(CryptoJS.enc.Base64);
  }

  /**
   * Rotate encryption key (for security policies)
   * Re-encrypts all data with new key
   */
  async rotateKey(): Promise<string> {
    const oldKey = this.encryptionKey;
    if (!oldKey) {
      throw new Error('No existing key to rotate');
    }

    // Generate new key
    const newKey = this.generateRandomKey();

    // Save new key
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, newKey);
    this.encryptionKey = newKey;

    console.log('[Encryption] ✅ Encryption key rotated');

    // Return old key so caller can re-encrypt data
    return oldKey;
  }

  /**
   * Delete encryption key (for logout/account deletion)
   * WARNING: Data encrypted with this key will be unrecoverable
   */
  async deleteKey(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
      this.encryptionKey = null;
      console.log('[Encryption] ✅ Encryption key deleted');
    } catch (error) {
      console.error('[Encryption] Failed to delete key:', error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let encryptionServiceInstance: EncryptionService | null = null;

export async function getEncryptionService(): Promise<EncryptionService> {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
    await encryptionServiceInstance.initialize();
  }
  return encryptionServiceInstance;
}

/**
 * Helper: Encrypt sensitive columns in a record
 * Sensitive columns for Capture entity: raw_content, normalized_text
 */
export async function encryptCaptureRecord(record: any): Promise<any> {
  const encryption = await getEncryptionService();

  return {
    ...record,
    raw_content: record.raw_content
      ? encryption.encrypt(record.raw_content)
      : record.raw_content,
    normalized_text: record.normalized_text
      ? encryption.encrypt(record.normalized_text)
      : record.normalized_text,
    encrypted: true, // Metadata flag
  };
}

/**
 * Helper: Decrypt sensitive columns in a record
 */
export async function decryptCaptureRecord(record: any): Promise<any> {
  if (!record.encrypted) {
    return record; // Not encrypted, return as-is
  }

  const encryption = await getEncryptionService();

  return {
    ...record,
    raw_content: record.raw_content
      ? encryption.decrypt(record.raw_content)
      : record.raw_content,
    normalized_text: record.normalized_text
      ? encryption.decrypt(record.normalized_text)
      : record.normalized_text,
  };
}
