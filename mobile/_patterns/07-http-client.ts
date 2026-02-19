/**
 * Pattern 07 — HTTP Client (ADR-025)
 *
 * ADR-025 : HTTP Client Strategy — fetch natif + wrapper custom
 *
 * RÈGLE : Utiliser fetchWithRetry pour TOUS les appels HTTP sortants.
 *   ✅ fetchWithRetry (src/infrastructure/http/fetchWithRetry.ts)
 *   ❌ axios (bannis, +13 KB bundle)
 *   ❌ fetch() nu (pas de retry, pas de timeout)
 *
 * Avantages :
 * - Retry automatique sur 5xx, 408, 429 et erreurs réseau
 * - Fibonacci backoff (1s, 1s, 2s, 3s, 5s, 8s)
 * - Timeout configurable via AbortController
 * - Zéro dépendance externe
 *
 * ─────────────────────────────────────────────────────────────────
 * IMPORT PATTERN (toujours depuis ce chemin)
 * ─────────────────────────────────────────────────────────────────
 */

import { fetchWithRetry, type FetchOptions } from '@/infrastructure/http/fetchWithRetry';

// ─────────────────────────────────────────────────────────────────
// OPTIONS PAR DÉFAUT (pour référence — defaults intégrés dans fetchWithRetry)
// ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000; // 30 secondes
const DEFAULT_RETRIES = 3;

// ─────────────────────────────────────────────────────────────────
// EXEMPLE 1 — GET simple avec gestion de réponse
// ─────────────────────────────────────────────────────────────────

async function getExample(apiUrl: string, token: string): Promise<string[]> {
  const response = await fetchWithRetry(`${apiUrl}/items`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
  });

  if (!response.ok) {
    // throw autorisé uniquement à la frontière HTTP (pour propager vers le service)
    throw new Error(`GET /items failed: HTTP ${response.status}`);
  }

  return response.json() as Promise<string[]>;
}

// ─────────────────────────────────────────────────────────────────
// EXEMPLE 2 — POST avec corps JSON et observabilité (onRetry)
// ─────────────────────────────────────────────────────────────────

interface UploadPayload {
  captureId: string;
  audioUrl: string;
}

async function postExample(
  apiUrl: string,
  token: string,
  payload: UploadPayload,
): Promise<void> {
  const options: FetchOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    timeout: 60_000, // timeout plus long pour upload
    retries: 2,
    onRetry: (attempt, error) => {
      // Idéalement : logger structuré (ADR-025)
      console.warn(`[HTTP] Retry ${attempt} — ${error.message}`);
    },
  };

  const response = await fetchWithRetry(`${apiUrl}/uploads`, options);

  if (!response.ok) {
    throw new Error(`POST /uploads failed: HTTP ${response.status} ${response.statusText}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// EXEMPLE 3 — Intégration dans un Repository (pattern correct)
//
// Le repository appelle fetchWithRetry, catch les erreurs réseau,
// et retourne RepositoryResult (ADR-023) — jamais throw.
// ─────────────────────────────────────────────────────────────────

import { injectable, inject } from 'tsyringe';
import { TOKENS } from '@/infrastructure/di/tokens';
import {
  type RepositoryResult,
  repositorySuccess,
  repositoryError,
} from '@/contexts/shared/domain/Result';

interface ISyncRepository {
  pushCapture(captureId: string): Promise<RepositoryResult<void>>;
}

@injectable()
class SyncRepository implements ISyncRepository {
  constructor(
    @inject(TOKENS.ApiBaseUrl) private readonly apiUrl: string,
    @inject(TOKENS.AuthTokenProvider) private readonly getToken: () => Promise<string>,
  ) {}

  async pushCapture(captureId: string): Promise<RepositoryResult<void>> {
    try {
      const token = await this.getToken();
      const response = await fetchWithRetry(`${this.apiUrl}/sync/captures`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captureId }),
        timeout: 30_000,
        retries: 3,
        onRetry: (attempt, error) => {
          console.warn(`[SyncRepository] pushCapture retry ${attempt}: ${error.message}`);
        },
      });

      if (!response.ok) {
        return repositoryError(`HTTP ${response.status}: ${response.statusText}`);
      }

      return repositorySuccess(undefined);
    } catch (error) {
      // Erreurs réseau après tous les retries épuisés
      const message = error instanceof Error ? error.message : 'network error';
      return repositoryError(`pushCapture failed: ${message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// ANTI-PATTERNS À ÉVITER
// ─────────────────────────────────────────────────────────────────

/*
// ❌ JAMAIS — fetch nu sans retry ni timeout
const r1 = await fetch('/api/data');

// ❌ JAMAIS — axios
import axios from 'axios';
const r2 = await axios.get('/api/data');

// ❌ JAMAIS — lancer le fetch au niveau module (avant bootstrap DI)
const globalResponse = fetchWithRetry('/api/init');

// ✅ TOUJOURS — fetchWithRetry dans une méthode de classe, résultant en Result<T>
*/

export { getExample, postExample, SyncRepository };
