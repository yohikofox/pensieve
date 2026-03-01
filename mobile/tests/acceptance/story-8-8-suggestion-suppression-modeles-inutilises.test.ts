/**
 * Story 8.8 — Suggestion de Suppression des Modèles Inutilisés
 *
 * BDD acceptance tests for ModelUsageTrackingService.
 * Tests: tracking lastUsed (AC1/AC2), inactive detection (AC3),
 * deletion cleanup (AC6), dismissal persistence (AC7).
 *
 * AsyncStorage is globally mocked via jest-setup.js
 * (@react-native-async-storage/async-storage/jest/async-storage-mock).
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'reflect-metadata';
import {
  ModelUsageTrackingService,
  MODEL_INACTIVITY_THRESHOLD_DAYS,
} from '../../src/contexts/Normalization/services/ModelUsageTrackingService';
import { RepositoryResultType } from '../../src/contexts/shared/domain/Result';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fixed reference date to make date-based assertions deterministic */
const FIXED_NOW = new Date('2026-03-15T10:00:00.000Z');

// ──────────────────────────────────────────────────────────────────────────────
// Feature loading
// ──────────────────────────────────────────────────────────────────────────────

const feature = loadFeature(
  './tests/acceptance/features/story-8-8-suggestion-suppression-modeles-inutilises.feature',
);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Returns an ISO string for a date N days before FIXED_NOW */
function daysAgo(n: number): string {
  return new Date(FIXED_NOW.getTime() - n * DAY_MS).toISOString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  let service: ModelUsageTrackingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW.getTime());
    service = new ModelUsageTrackingService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Shared Background step handlers
  // ──────────────────────────────────────────────────────────────────────────

  function defineBackgroundSteps(
    given: (stepText: string, fn: () => void | Promise<void>) => void,
    and: (stepText: string, fn: () => void | Promise<void>) => void,
  ): void {
    given('je suis un utilisateur authentifié', () => {
      // User context is implicit — service receives no user-specific state
    });

    and('le service ModelUsageTrackingService est initialisé', () => {
      // Service is freshly instantiated in beforeEach
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AC1 — Tracking de la date de dernière utilisation : téléchargement LLM
  // ──────────────────────────────────────────────────────────────────────────

  test('Date de dernière utilisation initialisée au téléchargement LLM', ({
    given,
    and,
    when,
    then,
  }) => {
    defineBackgroundSteps(given, and);

    given("le modèle LLM \"qwen2.5-0.5b\" n'est pas téléchargé", async () => {
      const value = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-0.5b');
      expect(value).toBeNull();
    });

    when('le téléchargement du modèle se termine avec succès', async () => {
      const result = await service.trackModelUsed('qwen2.5-0.5b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    then('la date de dernière utilisation est enregistrée avec la date actuelle', async () => {
      const result = await service.getLastUsedDate('qwen2.5-0.5b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      const date = result.data as Date;
      expect(date.toISOString()).toBe(FIXED_NOW.toISOString());
    });

    and(
      'la clé "@pensieve/model_last_used_llm_qwen2.5-0.5b" existe en AsyncStorage',
      async () => {
        const value = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-0.5b');
        expect(value).not.toBeNull();
        expect(value).toBe(FIXED_NOW.toISOString());
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC1 — Tracking de la date de dernière utilisation : sélection du modèle
  // ──────────────────────────────────────────────────────────────────────────

  test('Date de dernière utilisation mise à jour à la sélection', ({
    given,
    and,
    when,
    then,
  }) => {
    defineBackgroundSteps(given, and);

    given('le modèle LLM "qwen2.5-0.5b" a une lastUsed date de il y a 10 jours', async () => {
      await AsyncStorage.setItem('@pensieve/model_last_used_llm_qwen2.5-0.5b', daysAgo(10));
    });

    when('l\'utilisateur sélectionne le modèle "qwen2.5-0.5b" pour une tâche', async () => {
      const result = await service.trackModelUsed('qwen2.5-0.5b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    then('la date de dernière utilisation est mise à jour à la date actuelle', async () => {
      const result = await service.getLastUsedDate('qwen2.5-0.5b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      const date = result.data as Date;
      // After trackModelUsed, lastUsed should be FIXED_NOW (not 10 days ago)
      expect(date.toISOString()).toBe(FIXED_NOW.toISOString());
    });

    and("le modèle n'apparaît plus dans la liste des modèles inutilisés", async () => {
      // 10 days < 15-day threshold → not unused even before update
      // After update, it's definitely not unused (0 days since use)
      const result = await service.getUnusedModels(['qwen2.5-0.5b'], []);
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      expect(result.data).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC3 — Détection des modèles inactifs : modèle utilisé il y a 16 jours
  // ──────────────────────────────────────────────────────────────────────────

  test('Modèle LLM identifié comme inutilisé après 15 jours', ({
    given,
    and,
    when,
    then,
  }) => {
    defineBackgroundSteps(given, and);

    given('le modèle LLM "qwen2.5-3b" est téléchargé sur le disque', () => {
      // downloadedLLMIds = ['qwen2.5-3b'] will be passed to getUnusedModels
    });

    and('sa date de dernière utilisation est il y a 16 jours', async () => {
      await AsyncStorage.setItem('@pensieve/model_last_used_llm_qwen2.5-3b', daysAgo(16));
    });

    and("l'alerte n'a pas été ignorée", async () => {
      const value = await AsyncStorage.getItem(
        '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      );
      expect(value).toBeNull();
    });

    when('le système vérifie les modèles inutilisés', () => {
      // getUnusedModels is called in then/and assertions below
    });

    then(
      'le modèle "qwen2.5-3b" est retourné dans la liste des modèles inactifs',
      async () => {
        const result = await service.getUnusedModels(['qwen2.5-3b'], []);
        expect(result.type).toBe(RepositoryResultType.SUCCESS);
        const found = (result.data ?? []).find((m) => m.modelId === 'qwen2.5-3b');
        expect(found).toBeDefined();
        expect(found?.modelType).toBe('llm');
      },
    );

    and('le nombre de jours est "16"', async () => {
      const result = await service.getUnusedModels(['qwen2.5-3b'], []);
      const found = (result.data ?? []).find((m) => m.modelId === 'qwen2.5-3b');
      expect(found?.daysSinceLastUse).toBe(16);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC3 — Détection des modèles inactifs : modèle utilisé il y a 14 jours
  // ──────────────────────────────────────────────────────────────────────────

  test('Modèle LLM non identifié si utilisé il y a 14 jours', ({
    given,
    and,
    when,
    then,
  }) => {
    defineBackgroundSteps(given, and);

    given('le modèle LLM "smollm-135m" est téléchargé sur le disque', () => {
      // downloadedLLMIds = ['smollm-135m']
    });

    and('sa date de dernière utilisation est il y a 14 jours', async () => {
      await AsyncStorage.setItem('@pensieve/model_last_used_llm_smollm-135m', daysAgo(14));
    });

    when('le système vérifie les modèles inutilisés', () => {
      // getUnusedModels called in then assertion
    });

    then(
      "le modèle \"smollm-135m\" n'est pas dans la liste des modèles inactifs",
      async () => {
        const result = await service.getUnusedModels(['smollm-135m'], []);
        expect(result.type).toBe(RepositoryResultType.SUCCESS);
        const found = (result.data ?? []).find((m) => m.modelId === 'smollm-135m');
        expect(found).toBeUndefined();
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC3 — Comportement prudent : pas de lastUsed → modèle non inclus
  // ──────────────────────────────────────────────────────────────────────────

  test('Modèle sans lastUsed — comportement prudent', ({ given, and, when, then }) => {
    defineBackgroundSteps(given, and);

    given('le modèle LLM "qwen2.5-3b" est téléchargé sur le disque', () => {
      // downloadedLLMIds = ['qwen2.5-3b']
    });

    and('aucune clé "lastUsed" n\'existe pour ce modèle', async () => {
      const value = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-3b');
      expect(value).toBeNull();
    });

    and("le stat du fichier n'est pas disponible", () => {
      // FileSystem.getInfoAsync fallback is not applicable at service level;
      // the service only checks AsyncStorage for lastUsed — no stat = no tracking
    });

    when('le système vérifie les modèles inutilisés', () => {
      // getUnusedModels called in then assertion
    });

    then(
      'le modèle "qwen2.5-3b" n\'est PAS dans la liste des modèles inactifs',
      async () => {
        const result = await service.getUnusedModels(['qwen2.5-3b'], []);
        expect(result.type).toBe(RepositoryResultType.SUCCESS);
        const found = (result.data ?? []).find((m) => m.modelId === 'qwen2.5-3b');
        // Prudent behavior: no lastUsed → not considered unused (no false positives)
        expect(found).toBeUndefined();
      },
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC6 — Suppression d'un modèle depuis l'alerte
  // ──────────────────────────────────────────────────────────────────────────

  test("Suppression d'un modèle depuis l'alerte", ({ given, and, when, then }) => {
    defineBackgroundSteps(given, and);

    given("le modèle \"qwen2.5-3b\" affiche une alerte d'inactivité", async () => {
      // Pre-condition: model is inactive (16 days, not dismissed)
      await AsyncStorage.setItem('@pensieve/model_last_used_llm_qwen2.5-3b', daysAgo(16));
      // Verify the alert would actually be shown
      const result = await service.getUnusedModels(['qwen2.5-3b'], []);
      expect(result.data?.length).toBeGreaterThan(0);
    });

    when("l'utilisateur confirme la suppression", async () => {
      // LLMModelService.deleteModel() calls clearModelTracking() after file deletion
      // We test clearModelTracking() directly (file deletion is LLMModelService's responsibility)
      const result = await service.clearModelTracking('qwen2.5-3b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    then('le fichier du modèle est supprimé du disque', () => {
      // Physical file deletion is handled by LLMModelService.deleteModel()
      // Tested at the LLMModelService unit test level — out of scope here
    });

    and('les clés AsyncStorage du modèle sont supprimées', async () => {
      const lastUsed = await AsyncStorage.getItem('@pensieve/model_last_used_llm_qwen2.5-3b');
      const dismissed = await AsyncStorage.getItem(
        '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      );
      expect(lastUsed).toBeNull();
      expect(dismissed).toBeNull();
    });

    and('la carte du modèle passe en état "Non téléchargé"', async () => {
      // After clearModelTracking, model has no lastUsed key
      // → prudent behavior → not included in unused list
      const result = await service.getUnusedModels(['qwen2.5-3b'], []);
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
      const found = (result.data ?? []).find((m) => m.modelId === 'qwen2.5-3b');
      expect(found).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // AC7 — Ignorer une alerte : ne réapparaît pas
  // ──────────────────────────────────────────────────────────────────────────

  test("Ignorer une alerte — ne réapparaît pas", ({ given, and, when, then }) => {
    defineBackgroundSteps(given, and);

    given("le modèle \"qwen2.5-3b\" affiche une alerte d'inactivité", async () => {
      // Pre-condition: model is inactive (16 days, not dismissed)
      await AsyncStorage.setItem('@pensieve/model_last_used_llm_qwen2.5-3b', daysAgo(16));
      const result = await service.getUnusedModels(['qwen2.5-3b'], []);
      expect(result.data?.length).toBeGreaterThan(0);
    });

    when('l\'utilisateur appuie sur "Ignorer"', async () => {
      const result = await service.dismissSuggestion('qwen2.5-3b', 'llm');
      expect(result.type).toBe(RepositoryResultType.SUCCESS);
    });

    then('la clé de dismissal est créée en AsyncStorage', async () => {
      const dismissed = await AsyncStorage.getItem(
        '@pensieve/model_suggestion_dismissed_llm_qwen2.5-3b',
      );
      expect(dismissed).not.toBeNull();
      // Timestamp stored is FIXED_NOW (Date.now() is mocked)
      expect(new Date(dismissed!).toISOString()).toBe(FIXED_NOW.toISOString());
    });

    and(
      'le modèle ne réapparaît pas dans la liste des modèles inactifs lors des visites suivantes',
      async () => {
        // Even though lastUsed is still 16 days ago, dismissedAt > lastUsedAt
        // → hasDismissedSuggestion returns true → model excluded from unused list
        const result = await service.getUnusedModels(['qwen2.5-3b'], []);
        expect(result.type).toBe(RepositoryResultType.SUCCESS);
        const found = (result.data ?? []).find((m) => m.modelId === 'qwen2.5-3b');
        expect(found).toBeUndefined();
      },
    );
  });
});
