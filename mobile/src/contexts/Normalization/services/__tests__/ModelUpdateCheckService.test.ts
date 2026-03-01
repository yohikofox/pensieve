/**
 * ModelUpdateCheckService Unit Tests
 *
 * 14 cas de test couvrant :
 * - checkForUpdate() : comparaison ETag, throttle, réponse HTTP (Cas 1–7)
 * - isCheckNeeded()  : logique calendaire UTC — jamais vérifié, aujourd'hui, hier (Cas 8–10)
 * - recordDownload() : persistance dates + ETag initial best-effort (Cas 11–13)
 * - clearModelTracking() : suppression de toutes les clés AsyncStorage (Cas 14)
 *
 * @see ModelUpdateCheckService.ts
 * @see Story 8.9 - Vérification Automatique des Mises à Jour des Modèles
 * @see AC1, AC3, AC4, AC5, AC7
 */

import 'reflect-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ModelUpdateCheckService } from '../ModelUpdateCheckService';
import { RepositoryResultType } from '../../../shared/domain/Result';

// ──────────────────────────────────────────────────────────────────────────────
// Constantes de test
// ──────────────────────────────────────────────────────────────────────────────

/** Date fixe de référence : dimanche 15 mars 2026, 10h UTC */
const FIXED_NOW = new Date('2026-03-15T10:00:00.000Z').getTime();
const MODEL_ID = 'qwen2.5-3b';
const MODEL_TYPE = 'llm' as const;
const DOWNLOAD_URL = 'https://example.com/qwen2.5-3b.gguf';

// Clés AsyncStorage (miroir des constantes internes du service — pattern @pensieve/model_{action}_{type}_{id})
const KEY_LAST_CHECK    = `@pensieve/model_last_check_date_${MODEL_TYPE}_${MODEL_ID}`;
const KEY_STORED_ETAG   = `@pensieve/model_stored_etag_${MODEL_TYPE}_${MODEL_ID}`;
const KEY_UPDATE_STATUS = `@pensieve/model_update_status_${MODEL_TYPE}_${MODEL_ID}`;
const KEY_DOWNLOAD_DATE = `@pensieve/model_download_date_${MODEL_TYPE}_${MODEL_ID}`;
const KEY_UPDATE_DATE   = `@pensieve/model_update_date_${MODEL_TYPE}_${MODEL_ID}`;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Crée un mock de réponse HEAD minimal compatible avec le service.
 * Retourne uniquement ETag et etag ; les autres headers sont null.
 */
function mockFetchHead(options: { ok?: boolean; etag?: string | null } = {}): jest.SpyInstance {
  const { ok = true, etag = null } = options;
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok,
    headers: {
      get: (name: string) => {
        if (name === 'ETag' || name === 'etag') return etag;
        return null;
      },
    },
  } as unknown as Response);
}

// ──────────────────────────────────────────────────────────────────────────────
// Suite de tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ModelUpdateCheckService', () => {
  let service: ModelUpdateCheckService;

  beforeEach(async () => {
    // Nettoyer AsyncStorage AVANT de fixer le temps (pas de dépendance d'ordre)
    await AsyncStorage.clear();
    // Fixer Date.now() ET new Date() pour des tests déterministes (jest 27+)
    jest.useFakeTimers({ now: FIXED_NOW });
    service = new ModelUpdateCheckService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 1 — checkForUpdate : ETag identique → 'up-to-date'
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 1 — checkForUpdate : ETag identique → retourne 'up-to-date'", async () => {
    await AsyncStorage.setItem(KEY_STORED_ETAG, '"etag-v1"');
    mockFetchHead({ ok: true, etag: '"etag-v1"' });

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('up-to-date');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 2 — checkForUpdate : ETag différent → 'update-available'
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 2 — checkForUpdate : ETag différent → retourne 'update-available'", async () => {
    await AsyncStorage.setItem(KEY_STORED_ETAG, '"etag-v1"');
    mockFetchHead({ ok: true, etag: '"etag-v2"' });

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('update-available');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 3 — checkForUpdate : réseau KO (fetch throw) → 'check-failed'
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 3 — checkForUpdate : réseau KO (fetch throw) → retourne 'check-failed'", async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('check-failed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 4 — checkForUpdate : pas d'ETag stocké → baseline établie → 'up-to-date'
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 4 — checkForUpdate : pas d'ETag stocké → stocker ETag distant → retourne 'up-to-date'", async () => {
    // Aucun KEY_STORED_ETAG en AsyncStorage (modèle téléchargé avant story 8.9)
    mockFetchHead({ ok: true, etag: '"etag-initial"' });

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('up-to-date');

    // L'ETag initial doit avoir été stocké pour les prochaines comparaisons
    const storedEtag = await AsyncStorage.getItem(KEY_STORED_ETAG);
    expect(storedEtag).toBe('"etag-initial"');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 5 — checkForUpdate : réponse HTTP 404 → 'check-failed'
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 5 — checkForUpdate : réponse HTTP 404 → retourne 'check-failed'", async () => {
    mockFetchHead({ ok: false });

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('check-failed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 6 — checkForUpdate : ignoreThrottle=false + vérifié aujourd'hui → statut stocké, pas de fetch
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 6 — checkForUpdate : vérifié aujourd'hui + ignoreThrottle=false → retourne statut stocké sans fetch", async () => {
    // Date de dernier check = même jour que FIXED_NOW (2026-03-15T06h UTC)
    await AsyncStorage.setItem(KEY_LAST_CHECK, new Date('2026-03-15T06:00:00.000Z').toISOString());
    await AsyncStorage.setItem(KEY_UPDATE_STATUS, 'up-to-date');

    // Si fetch est appelé malgré le throttle, le test doit échouer clairement
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(
      new Error('fetch ne doit PAS être appelé quand le throttle est actif'),
    );

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, false);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('up-to-date');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 7 — checkForUpdate : ignoreThrottle=true + vérifié aujourd'hui → fetch effectué quand même
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 7 — checkForUpdate : vérifié aujourd'hui + ignoreThrottle=true → fetch effectué, résultat frais", async () => {
    await AsyncStorage.setItem(KEY_LAST_CHECK, new Date('2026-03-15T06:00:00.000Z').toISOString());
    await AsyncStorage.setItem(KEY_STORED_ETAG, '"etag-v1"');
    // La source retourne un ETag différent (mise à jour disponible)
    mockFetchHead({ ok: true, etag: '"etag-v2"' });

    const result = await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe('update-available');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 8 — isCheckNeeded : clé absente (jamais vérifié) → true
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 8 — isCheckNeeded : clé absente (jamais vérifié) → retourne true', async () => {
    // Pas de KEY_LAST_CHECK en AsyncStorage

    const result = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 9 — isCheckNeeded : dernier check = aujourd'hui → false
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 9 — isCheckNeeded : dernier check = aujourd'hui (même jour UTC) → retourne false", async () => {
    // FIXED_NOW = 2026-03-15T10:00:00Z → stocker une vérification à 06h le même jour UTC
    await AsyncStorage.setItem(KEY_LAST_CHECK, new Date('2026-03-15T06:00:00.000Z').toISOString());

    const result = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 10 — isCheckNeeded : dernier check = hier → true
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 10 — isCheckNeeded : dernier check = hier (UTC-14) → retourne true', async () => {
    // FIXED_NOW = 2026-03-15T10:00:00Z → hier = 2026-03-14
    await AsyncStorage.setItem(KEY_LAST_CHECK, new Date('2026-03-14T18:00:00.000Z').toISOString());

    const result = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 11 — recordDownload : stocke download_date + update_date au timestamp actuel
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 11 — recordDownload : stocke download_date + update_date identiques au timestamp FIXED_NOW', async () => {
    // Simuler un HEAD qui ne retourne pas d'ETag (ne teste pas l'ETag ici)
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    } as unknown as Response);

    const result = await service.recordDownload(MODEL_ID, MODEL_TYPE, DOWNLOAD_URL);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);

    const downloadDateStr = await AsyncStorage.getItem(KEY_DOWNLOAD_DATE);
    const updateDateStr   = await AsyncStorage.getItem(KEY_UPDATE_DATE);

    expect(downloadDateStr).not.toBeNull();
    expect(updateDateStr).not.toBeNull();

    // Les deux dates doivent être identiques (pas encore de mise à jour)
    expect(downloadDateStr).toBe(updateDateStr);

    // La date stockée doit correspondre à FIXED_NOW (déterministe grâce aux fake timers)
    expect(new Date(downloadDateStr!).getTime()).toBe(FIXED_NOW);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 12 — recordDownload : fetch ETag OK → stocke stored_etag
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 12 — recordDownload : fetch ETag OK → stocke stored_etag', async () => {
    mockFetchHead({ ok: true, etag: '"etag-initial"' });

    await service.recordDownload(MODEL_ID, MODEL_TYPE, DOWNLOAD_URL);

    const storedEtag = await AsyncStorage.getItem(KEY_STORED_ETAG);
    expect(storedEtag).toBe('"etag-initial"');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 13 — recordDownload : fetch ETag KO → pas d'erreur propagée, download_date quand même stockée
  // ──────────────────────────────────────────────────────────────────────────

  it("Cas 13 — recordDownload : fetch ETag KO → pas d'erreur propagée, dates stockées, ETag absent", async () => {
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await service.recordDownload(MODEL_ID, MODEL_TYPE, DOWNLOAD_URL);

    // Doit retourner SUCCESS même si le fetch de l'ETag échoue (best-effort)
    expect(result.type).toBe(RepositoryResultType.SUCCESS);

    // Les dates de téléchargement doivent quand même être stockées
    const downloadDateStr = await AsyncStorage.getItem(KEY_DOWNLOAD_DATE);
    expect(downloadDateStr).not.toBeNull();

    // Pas d'ETag stocké (attendu — fetch a échoué)
    const storedEtag = await AsyncStorage.getItem(KEY_STORED_ETAG);
    expect(storedEtag).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 14 — clearModelTracking : supprime toutes les clés du modèle
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 14 — clearModelTracking : supprime les 5 clés AsyncStorage du modèle', async () => {
    const iso = new Date(FIXED_NOW).toISOString();
    await AsyncStorage.setItem(KEY_DOWNLOAD_DATE, iso);
    await AsyncStorage.setItem(KEY_UPDATE_DATE, iso);
    await AsyncStorage.setItem(KEY_LAST_CHECK, iso);
    await AsyncStorage.setItem(KEY_STORED_ETAG, '"etag-v1"');
    await AsyncStorage.setItem(KEY_UPDATE_STATUS, 'up-to-date');

    const result = await service.clearModelTracking(MODEL_ID, MODEL_TYPE);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);

    expect(await AsyncStorage.getItem(KEY_DOWNLOAD_DATE)).toBeNull();
    expect(await AsyncStorage.getItem(KEY_UPDATE_DATE)).toBeNull();
    expect(await AsyncStorage.getItem(KEY_LAST_CHECK)).toBeNull();
    expect(await AsyncStorage.getItem(KEY_STORED_ETAG)).toBeNull();
    expect(await AsyncStorage.getItem(KEY_UPDATE_STATUS)).toBeNull();
  });
});
