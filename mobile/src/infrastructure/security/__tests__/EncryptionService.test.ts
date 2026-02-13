/**
 * EncryptionService Unit Tests
 * Story 6.1 - Task 5.5: Test encryption/decryption round-trip
 */

import { EncryptionService, encryptCaptureRecord, decryptCaptureRecord } from '../EncryptionService';
import * as SecureStore from 'expo-secure-store';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('EncryptionService', () => {
  let service: EncryptionService;
  const mockKey = 'dGVzdF9lbmNyeXB0aW9uX2tleV8yNTZiaXRz'; // Base64 mock key

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EncryptionService();
  });

  describe('Initialization', () => {
    it('should generate new key if none exists', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

      await service.initialize();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('pensine_encryption_master_key');
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should load existing key if present', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);

      await service.initialize();

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('pensine_encryption_master_key');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should throw error if initialization fails', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('SecureStore error'));

      await expect(service.initialize()).rejects.toThrow('Encryption initialization failed');
    });
  });

  describe('Encrypt/Decrypt Round-Trip', () => {
    beforeEach(async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);
      await service.initialize();
    });

    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Sensitive business idea: AI-powered task manager';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const encrypted = service.encrypt('');
      expect(encrypted).toBe('');

      const decrypted = service.decrypt('');
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Émojis: 🔒🔑 | Français: àéêïôù | Math: ∑∫∂';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long text (10KB)', () => {
      const plaintext = 'A'.repeat(10000); // 10KB
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(plaintext.length); // Encrypted is larger
    });

    it('should throw error if service not initialized', () => {
      const uninitializedService = new EncryptionService();

      expect(() => uninitializedService.encrypt('test')).toThrow('Encryption service not initialized');
      expect(() => uninitializedService.decrypt('test')).toThrow('Encryption service not initialized');
    });
  });

  describe('isEncrypted Detection', () => {
    beforeEach(async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);
      await service.initialize();
    });

    it('should detect encrypted data', () => {
      const plaintext = 'test data';
      const encrypted = service.encrypt(plaintext);

      expect(service.isEncrypted(encrypted)).toBe(true);
      expect(service.isEncrypted(plaintext)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isEncrypted('')).toBe(false);
    });
  });

  describe('Key Management', () => {
    beforeEach(async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      await service.initialize();
    });

    it('should rotate encryption key', async () => {
      const oldKey = await service.rotateKey();

      expect(oldKey).toBe(mockKey);
      expect(SecureStore.setItemAsync).toHaveBeenCalled();
    });

    it('should throw error if rotating without existing key', async () => {
      const uninitializedService = new EncryptionService();

      await expect(uninitializedService.rotateKey()).rejects.toThrow('No existing key to rotate');
    });

    it('should delete encryption key', async () => {
      (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);

      await service.deleteKey();

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('pensine_encryption_master_key');
    });
  });

  describe('Capture Record Helpers', () => {
    beforeEach(async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);
    });

    it('should encrypt capture record with metadata flag', async () => {
      const record = {
        id: 'capture-123',
        raw_content: '/path/to/audio.m4a',
        normalized_text: 'This is the transcription',
      };

      const encrypted = await encryptCaptureRecord(record);

      expect(encrypted.id).toBe(record.id); // ID not encrypted
      expect(encrypted.raw_content).not.toBe(record.raw_content); // Content encrypted
      expect(encrypted.normalized_text).not.toBe(record.normalized_text); // Text encrypted
      expect(encrypted.encrypted).toBe(true); // Metadata flag added
      expect(encrypted.raw_content).toMatch(/^U2FsdGVkX1/); // AES signature
    });

    it('should decrypt capture record', async () => {
      const original = {
        id: 'capture-456',
        raw_content: 'original content',
        normalized_text: 'original transcription',
      };

      const encrypted = await encryptCaptureRecord(original);
      const decrypted = await decryptCaptureRecord(encrypted);

      expect(decrypted.raw_content).toBe(original.raw_content);
      expect(decrypted.normalized_text).toBe(original.normalized_text);
      expect(decrypted.encrypted).toBe(true); // Flag preserved
    });

    it('should handle unencrypted records gracefully', async () => {
      const unencrypted = {
        id: 'capture-789',
        raw_content: 'plain content',
        normalized_text: 'plain transcription',
        encrypted: false,
      };

      const result = await decryptCaptureRecord(unencrypted);

      expect(result).toEqual(unencrypted); // Returned as-is
    });

    it('should handle null/undefined fields', async () => {
      const record = {
        id: 'capture-null',
        raw_content: null,
        normalized_text: undefined,
      };

      const encrypted = await encryptCaptureRecord(record);

      expect(encrypted.raw_content).toBe(null);
      expect(encrypted.normalized_text).toBe(undefined);
      expect(encrypted.encrypted).toBe(true);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(mockKey);
      await service.initialize();
    });

    it('should encrypt 100 records in under 1 second', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: `capture-${i}`,
        raw_content: `content ${i}`,
        normalized_text: `transcription ${i}`,
      }));

      const start = Date.now();
      const encrypted = await Promise.all(records.map(encryptCaptureRecord));
      const duration = Date.now() - start;

      expect(encrypted.length).toBe(100);
      expect(duration).toBeLessThan(1000); // < 1 second
    });
  });
});
