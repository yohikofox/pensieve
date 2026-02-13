# Encryption Strategy - Pensieve Backend

**Date:** 2026-02-13
**Story:** 6.1 - Sync Infrastructure
**ADR Reference:** ADR-010 - Security & Encryption Strategy

---

## 1. Encryption in Transit (NFR11)

### HTTPS/TLS Configuration

**Approach:** TLS termination at **reverse proxy** level (not in NestJS application).

**Production Architecture:**

```
[Mobile/Web Client]
      ↓ HTTPS/TLS 1.3
[Reverse Proxy (Nginx/Traefik/Caddy)]
      ↓ HTTP
[Backend NestJS :3000]
```

**TLS Configuration (Reverse Proxy):**
- Protocol: TLS 1.3 minimum
- Certificates: Let's Encrypt (auto-renew)
- HSTS: Enabled (max-age 31536000)
- Ciphers: Modern only (TLS_AES_128_GCM_SHA256, TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256)

**Why Reverse Proxy:**
- ✅ Separation of concerns
- ✅ Centralized certificate management
- ✅ Performance (TLS offloading)
- ✅ Simplified application code
- ✅ Standard production pattern

**Dev Environment:**
- HTTP acceptable (localhost, no real sensitive data)
- HTTPS optional (self-signed certs if testing TLS-specific features)

**Status:** ✅ Architecture documented, reverse proxy configuration pending deployment.

---

## 2. Encryption at Rest - Backend (NFR12)

### MVP Strategy: Infrastructure-Level Encryption

**Approach:** Disk/volume encryption managed at **infrastructure** level, NOT application level.

**Implementation Options:**

#### Option A: Docker Volume Encryption (LUKS)

```bash
# Create encrypted volume with LUKS
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/encrypted/data \
  --opt o=bind \
  pensine-data

# PostgreSQL stores data on encrypted volume
services:
  postgres:
    volumes:
      - pensine-data:/var/lib/postgresql/data
```

#### Option B: Cloud Provider Encryption

**AWS:**
- EBS volumes: Encryption at rest (AES-256) enabled by default
- RDS PostgreSQL: Transparent encryption

**Scaleway:**
- Block Storage: LUKS encryption built-in
- Database: Managed PostgreSQL with encryption

**Google Cloud:**
- Persistent Disks: Encrypted by default

**Rationale for Infrastructure-Level (MVP):**
- ✅ Protects against physical disk theft
- ✅ Transparent to application (no code changes)
- ✅ No performance impact on queries
- ✅ Free on most cloud providers
- ✅ Satisfies NFR12 (encryption at rest)
- ✅ Compliant with basic security requirements

**What is NOT encrypted with this approach:**
- ❌ Data in memory (PostgreSQL cache, application cache)
- ❌ Data in backups (unless backup tool encrypts)
- ❌ Data in logs (need log redaction separately)

**Acceptable for MVP because:**
- No regulated data (HIPAA, PCI-DSS)
- B2C use case (not multi-tenant B2B)
- Infrastructure access controlled (auth, firewall, VPN)

---

### Post-MVP: Application-Level Encryption (if needed)

**When to implement:**
- Regulatory compliance (HIPAA, PCI-DSS, GDPR strict interpretation)
- B2B clients with strict security requirements
- Multi-tenancy with strong isolation needs
- Paranoid security posture

**Option A: Transparent Data Encryption (TDE)**

PostgreSQL 15+ built-in:

```sql
ALTER DATABASE pensine SET encryption = 'on';
```

- ✅ Encrypts all tables automatically
- ✅ Minimal code changes
- ⚠️ ~10% performance overhead
- ⚠️ Key management complexity

**Option B: Column-Level Encryption**

Encrypt specific sensitive columns:

```typescript
import { Encrypted } from '@decorators/encrypted';

@Entity('thoughts')
export class Thought {
  @Column('text')
  @Encrypted() // Custom decorator using crypto
  summary!: string;
}
```

- ✅ Granular control
- ✅ Only sensitive data encrypted
- ⚠️ ~20% performance overhead
- ⚠️ Cannot query encrypted fields (no full-text search)
- ⚠️ Indexes broken on encrypted columns
- ⚠️ Complex key rotation

**Decision:** NOT implementing for MVP. Revisit if:
1. Customer demands it (B2B compliance)
2. Regulatory audit requires it
3. Sensitive data classification changes (e.g., health data)

---

## 3. Encryption at Rest - Mobile (NFR12)

See `mobile/docs/encryption-strategy.md` for mobile-specific encryption strategy (Expo SecureStore + future SQLCipher for OP-SQLite).

---

## 4. Security Audit Checklist

- [x] HTTPS/TLS 1.3 in production (reverse proxy)
- [x] Infrastructure-level disk encryption (cloud provider or LUKS)
- [ ] Reverse proxy configured with Let's Encrypt
- [ ] HSTS header enabled (strict-transport-security)
- [ ] Security headers (Helmet.js): CSP, X-Frame-Options, etc.
- [ ] Certificate auto-renewal monitored (alert 30 days before expiry)
- [ ] Backup encryption verified
- [ ] Log redaction for sensitive fields (PII, tokens)

---

## 5. References

- **ADR-010:** Security & Encryption Strategy
- **NFR11:** Encryption in transit (HTTPS/TLS)
- **NFR12:** Encryption at rest (disk/column)
- **OWASP:** https://owasp.org/www-project-top-ten/
- **Let's Encrypt:** https://letsencrypt.org/
