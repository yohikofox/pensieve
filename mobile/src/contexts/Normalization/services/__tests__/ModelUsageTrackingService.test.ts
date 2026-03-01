/**
 * ModelUsageTrackingService Unit Tests
 *
 * 13 test cases covering:
 * - trackModelUsed() : persistance timestamp ISO
 * - getLastUsedDate() : lecture et parsing de clé AsyncStorage
 * - getUnusedModels() : seuil 15 jours + comportement prudent sans clé
 * - getUnusedModels() : fallback FileSystem.getInfoAsync (AC3)
 * - dismissSuggestion() : création de la clé de dismissal
 * - hasDismissedSuggestion() : logique temporelle dismiss vs reuse
 * - clearModelTracking() : suppression des deux clés
 *
 * @see ModelUsageTrackingService.ts
 * @see Story 8.8 - Suggestion de Suppression des Modèles Inutilisés
 * @see AC1, AC2, AC3, AC7
 */

import 'reflect-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { ModelUsageTrackingService } from '../ModelUsageTrackingService';
import { RepositoryResultType } from '../../../shared/domain/Result';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** Retourne une date ISO n jours avant la date fixe de référence */
function daysAgo(days: number, referenceMs: number): string {
  return new Date(referenceMs - days * DAY_MS).toISOString();
}

// Date fixe de référence pour tous les tests
const FIXED_NOW = new Date('2026-03-15T10:00:00.000Z').getTime();

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('ModelUsageTrackingService', () => {
  let service: ModelUsageTrackingService;

  beforeEach(async () => {
    // Clear AsyncStorage entre chaque test
    await AsyncStorage.clear();
    // Fixer Date.now() pour des tests déterministes
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    service = new ModelUsageTrackingService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 1 — trackModelUsed → AsyncStorage.setItem appelé avec timestamp ISO valide
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 1 — trackModelUsed : AsyncStorage.setItem appelé avec timestamp ISO valide', async () => {
    await service.trackModelUsed('qwen2.5-0.5b', 'llm');

    const stored = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-0.5b');
    expect(stored).not.toBeNull();
    // Doit être une date ISO valide
    expect(() => new Date(stored!)).not.toThrow();
    expect(new Date(stored!).getTime()).toBe(FIXED_NOW);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 2 — trackModelUsed → retourne Result SUCCESS
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 2 — trackModelUsed : retourne Result SUCCESS', async () => {
    const result = await service.trackModelUsed('tiny', 'whisper');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 3 — getLastUsedDate → retourne la date parsée si clé présente
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 3 — getLastUsedDate : retourne la date parsée si clé présente', async () => {
    const isoDate = daysAgo(5, FIXED_NOW);
    await AsyncStorage.setItem('@pensieve/model_last_used_llm_smollm-135m', isoDate);

    const result = await service.getLastUsedDate('smollm-135m', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBeInstanceOf(Date);
    expect(result.data!.toISOString()).toBe(isoDate);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 4 — getLastUsedDate → retourne null si clé absente
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 4 — getLastUsedDate : retourne null si clé absente', async () => {
    const result = await service.getLastUsedDate('qwen2.5-3b', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 5 — getUnusedModels : modèle utilisé il y a 14 jours → PAS dans la liste
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 5 — getUnusedModels : modèle utilisé il y a 14 jours → PAS dans la liste', async () => {
    await AsyncStorage.setItem(
      '@pensieve/model_last_used_llm_smollm-135m',
      daysAgo(14, FIXED_NOW),
    );

    const result = await service.getUnusedModels(['smollm-135m'], [], 15);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 6 — getUnusedModels : modèle utilisé il y a 16 jours → DANS la liste
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 6 — getUnusedModels : modèle utilisé il y a 16 jours → DANS la liste', async () => {
    await AsyncStorage.setItem(
      '@pensieve/model_last_used_llm_qwen2.5-3b',
      daysAgo(16, FIXED_NOW),
    );

    const result = await service.getUnusedModels(['qwen2.5-3b'], [], 15);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].modelId).toBe('qwen2.5-3b');
    expect(result.data![0].modelType).toBe('llm');
    expect(result.data![0].daysSinceLastUse).toBe(16);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 7 — getUnusedModels : modèle sans lastUsed et sans stat → PAS dans la liste (prudence)
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 7 — getUnusedModels : modèle sans lastUsed → PAS dans la liste (prudence)', async () => {
    // Aucune clé lastUsed pour ce modèle

    const result = await service.getUnusedModels(['qwen2.5-3b'], [], 15);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 8 — dismissSuggestion → KEY_DISMISSED créée avec timestamp
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 8 — dismissSuggestion : KEY_DISMISSED créée avec timestamp', async () => {
    const result = await service.dismissSuggestion('qwen2.5-3b', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);

    const stored = await AsyncStorage.getItem(
      '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
    );
    expect(stored).not.toBeNull();
    expect(new Date(stored!).getTime()).toBe(FIXED_NOW);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 9 — hasDismissedSuggestion → true si dismissed et pas réutilisé depuis
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 9 — hasDismissedSuggestion : true si dismissed et modèle non réutilisé depuis', async () => {
    // lastUsed il y a 20 jours, dismissed il y a 2 jours
    await AsyncStorage.setItem(
      '@pensieve/model_last_used_llm_qwen2.5-3b',
      daysAgo(20, FIXED_NOW),
    );
    await AsyncStorage.setItem(
      '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      daysAgo(2, FIXED_NOW),
    );

    const result = await service.hasDismissedSuggestion('qwen2.5-3b', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 10 — hasDismissedSuggestion → false si dismissed mais modèle réutilisé après dismiss
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 10 — hasDismissedSuggestion : false si modèle réutilisé après le dismiss', async () => {
    // dismissed il y a 5 jours, mais lastUsed il y a 1 jour (réutilisé après le dismiss)
    await AsyncStorage.setItem(
      '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      daysAgo(5, FIXED_NOW),
    );
    await AsyncStorage.setItem(
      '@pensieve/model_last_used_llm_qwen2.5-3b',
      daysAgo(1, FIXED_NOW),
    );

    const result = await service.hasDismissedSuggestion('qwen2.5-3b', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 11 — clearModelTracking → supprime KEY_LAST_USED et KEY_DISMISSED
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 11 — clearModelTracking : supprime les deux clés AsyncStorage', async () => {
    // Pré-remplir les deux clés
    await AsyncStorage.setItem(
      '@pensieve/model_last_used_llm_qwen2.5-3b',
      daysAgo(20, FIXED_NOW),
    );
    await AsyncStorage.setItem(
      '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      daysAgo(3, FIXED_NOW),
    );

    const result = await service.clearModelTracking('qwen2.5-3b', 'llm');

    expect(result.type).toBe(RepositoryResultType.SUCCESS);

    const lastUsed = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-3b');
    const dismissed = await AsyncStorage.getItem(
      '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
    );
    expect(lastUsed).toBeNull();
    expect(dismissed).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 12 — getUnusedModels : fallback File.info() — stat J-20 → DANS la liste
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 12 — getUnusedModels : fallback File.info() (modificationTime J-20, sans lastUsed) → DANS la liste', async () => {
    // Pas de clé lastUsed en AsyncStorage
    // Simuler un fichier avec modificationTime il y a 20 jours
    const modificationTimeMs = FIXED_NOW - 20 * DAY_MS;
    jest.spyOn(File.prototype, 'info').mockReturnValue({
      exists: true,
      size: 2_000_000_000,
      modificationTime: modificationTimeMs,
    });
    jest.spyOn(File.prototype, 'exists', 'get').mockReturnValue(true);

    const paths = new Map([['qwen2.5-3b', '/mock/path/qwen2.5-3b.gguf']]);
    const result = await service.getUnusedModels(['qwen2.5-3b'], [], 15, paths);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].modelId).toBe('qwen2.5-3b');
    expect(result.data![0].daysSinceLastUse).toBe(20);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cas 13 — getUnusedModels : fallback File.info() — fichier absent → PAS dans la liste
  // ──────────────────────────────────────────────────────────────────────────

  it('Cas 13 — getUnusedModels : fallback File.info() (fichier absent) → PAS dans la liste', async () => {
    // Pas de clé lastUsed, fichier absent sur le disque
    jest.spyOn(File.prototype, 'exists', 'get').mockReturnValue(false);

    const paths = new Map([['qwen2.5-3b', '/mock/path/qwen2.5-3b.gguf']]);
    const result = await service.getUnusedModels(['qwen2.5-3b'], [], 15, paths);

    expect(result.type).toBe(RepositoryResultType.SUCCESS);
    // Comportement prudent : fichier absent → modèle NON inclus
    expect(result.data).toHaveLength(0);
  });
});
