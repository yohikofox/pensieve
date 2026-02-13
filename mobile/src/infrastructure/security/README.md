# Security Module - Encryption at Rest

Story 6.1 - Task 5: Encryption & Security

## Required Dependencies

Add these dependencies to `package.json`:

```bash
npm install expo-secure-store crypto-js
npm install --save-dev @types/crypto-js
```

## Usage

### Initialize Encryption Service

```typescript
import { getEncryptionService } from '@/infrastructure/security/EncryptionService';

// Initialize on app startup (after DI bootstrap)
const encryption = await getEncryptionService();
```

### Encrypt/Decrypt Data

```typescript
// Manual encryption
const encrypted = encryption.encrypt('sensitive data');
const decrypted = encryption.decrypt(encrypted);

// Helper for Capture records
import { encryptCaptureRecord, decryptCaptureRecord } from '@/infrastructure/security/EncryptionService';

const record = { raw_content: 'audio content', normalized_text: 'transcription' };
const encrypted = await encryptCaptureRecord(record);
// → { raw_content: 'U2FsdGVkX1...', normalized_text: 'U2FsdGVkX1...', encrypted: true }

const decrypted = await decryptCaptureRecord(encrypted);
// → { raw_content: 'audio content', normalized_text: 'transcription', encrypted: true }
```

## Security Features

### 1. Master Key Storage

- **Storage:** Expo SecureStore (hardware-backed on iOS, Keychain/Keystore)
- **Algorithm:** AES-256 encryption
- **Key Length:** 256 bits (32 bytes)
- **Key Generation:** Crypto-secure random

### 2. Encrypted Columns

**Capture Entity:**
- `raw_content` - Audio file paths or text content
- `normalized_text` - Transcription text

**Metadata:**
- `encrypted: boolean` - Flag indicating encryption status

### 3. Key Management

```typescript
// Rotate key (for security policies)
const oldKey = await encryption.rotateKey();
// Re-encrypt all records with new key

// Delete key (logout/account deletion)
await encryption.deleteKey();
// WARNING: Data will be unrecoverable
```

## NFR Compliance

- ✅ **NFR12:** Encryption at-rest for sensitive data
- ✅ **NFR11:** HTTPS/TLS for data in transit (backend config)
- ✅ **NFR13:** User isolation (sync service enforces)

## Backend Encryption

Backend should also encrypt sensitive columns at-rest in PostgreSQL:

```sql
-- Option 1: PostgreSQL TDE (Transparent Data Encryption)
-- Encrypts entire database

-- Option 2: Column-level encryption (pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt on insert
INSERT INTO captures (raw_content) VALUES (
  pgp_sym_encrypt('sensitive data', 'encryption_key')
);

-- Decrypt on select
SELECT pgp_sym_decrypt(raw_content::bytea, 'encryption_key') FROM captures;
```

## Performance Considerations

- Encryption adds ~10-20ms overhead per operation
- Batch encryption recommended for large datasets
- Consider caching decrypted data in memory (with caution)

## Testing

```typescript
// Test encryption/decryption
const service = await getEncryptionService();
const original = 'test data';
const encrypted = service.encrypt(original);
const decrypted = service.decrypt(encrypted);

expect(decrypted).toBe(original);
expect(service.isEncrypted(encrypted)).toBe(true);
expect(service.isEncrypted(original)).toBe(false);
```

## Troubleshooting

**Issue:** "Encryption service not initialized"
- **Solution:** Call `await getEncryptionService()` before using

**Issue:** "Failed to decrypt"
- **Solution:** Data may be corrupted or encrypted with different key

**Issue:** SecureStore not available
- **Solution:** Expo SecureStore requires native modules, ensure `expo prebuild` ran
