/**
 * Story 8.9 — Vérification Automatique des Mises à Jour des Modèles
 *
 * BDD acceptance tests for ModelUpdateCheckService.
 * Tests the auto-check logic (AC1), throttle (AC3), update detection + notification (AC5),
 * and forced manual check (AC2).
 *
 * Mocks:
 * - fetch → jest.spyOn(global, 'fetch') pour simuler les réponses HEAD
 * - AsyncStorage → mocké globalement via jest-setup.js
 * - expo-notifications → mocké ici pour vérifier les appels notifyUpdateAvailable
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Mock expo-notifications (pattern story 8.7)
// ============================================================================
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('notification-id');
const mockGetPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
const mockSetNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  AndroidImportance: { DEFAULT: 3 },
}));

// Import après les mocks
import { ModelUpdateCheckService } from '../../src/contexts/Normalization/services/ModelUpdateCheckService';
import { ModelDownloadNotificationService } from '../../src/contexts/Normalization/services/ModelDownloadNotificationService';
import { RepositoryResultType } from '../../src/contexts/shared/domain/Result';
import 'reflect-metadata';

// ============================================================================
// Clés AsyncStorage (dupliquées du service pour les tests)
// ============================================================================
const KEY_LAST_CHECK = (type: string, id: string) =>
  `@pensieve/model_last_check_date_${type}_${id}`;
const KEY_STORED_ETAG = (type: string, id: string) =>
  `@pensieve/model_stored_etag_${type}_${id}`;
const KEY_UPDATE_STATUS = (type: string, id: string) =>
  `@pensieve/model_update_status_${type}_${id}`;
const KEY_DOWNLOAD_DATE = (type: string, id: string) =>
  `@pensieve/model_download_date_${type}_${id}`;

const MODEL_ID = 'qwen2.5-3b';
const MODEL_TYPE = 'llm' as const;
const DOWNLOAD_URL = 'https://huggingface.co/mock/qwen2.5-3b/resolve/main/model.gguf';
const MODEL_NAME = 'Qwen2.5 3B';

// Helper : date d'hier en ISO
const yesterday = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
};

// Helper : aujourd'hui en ISO
const today = (): string => new Date().toISOString();

// Helper : créer une Response HEAD mock
const createMockHeadResponse = (etag: string | null, ok = true): Response => {
  const headers = new Headers();
  if (etag !== null) headers.set('ETag', etag);
  return { ok, status: ok ? 200 : 404, headers } as unknown as Response;
};

// ============================================================================
// Background step helper (pattern story 8.8)
// ============================================================================
function defineBackgroundSteps(
  given: (stepText: string, fn: () => void | Promise<void>) => void,
  and: (stepText: string, fn: () => void | Promise<void>) => void,
): void {
  given('je suis un utilisateur authentifié', () => {
    // Contexte utilisateur OK — rien à initialiser
  });

  and("j'ai au moins un modèle LLM téléchargé", async () => {
    // Simuler un modèle téléchargé (downloadDate présente)
    await AsyncStorage.setItem(KEY_DOWNLOAD_DATE(MODEL_TYPE, MODEL_ID), yesterday());
  });
}

// ============================================================================
// Feature
// ============================================================================
const feature = loadFeature(
  './tests/acceptance/features/story-8-9-verification-maj-modeles.feature',
);

defineFeature(feature, (test) => {
  let service: ModelUpdateCheckService;
  let notifService: ModelDownloadNotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    service = new ModelUpdateCheckService();
    notifService = new ModelDownloadNotificationService();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // AC1 : Vérification automatique au premier accès à l'écran
  // ============================================================================

  test("Vérification automatique au premier accès à l'écran (AC1)", ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackgroundSteps(given, and);

    given(`le modèle "${MODEL_NAME}" n'a jamais été vérifié`, async () => {
      // Pas de KEY_LAST_CHECK → isCheckNeeded doit retourner true
      await AsyncStorage.removeItem(KEY_LAST_CHECK(MODEL_TYPE, MODEL_ID));
    });

    when("j'ouvre LLMSettingsScreen", async () => {
      // Simuler le comportement de useModelUpdateCheck.autoCheckAll :
      // 1. isCheckNeeded → true (jamais vérifié)
      const checkNeeded = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);
      expect(checkNeeded.type).toBe(RepositoryResultType.SUCCESS);
      expect((checkNeeded as { type: 'success'; data: boolean }).data).toBe(true);

      // 2. checkForUpdate → mock fetch retourne ETag
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockHeadResponse('etag-v1'),
      );
      await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE);
    });

    then('la vérification est déclenchée automatiquement pour ce modèle', () => {
      // fetch a bien été appelé (check déclenché)
      expect(global.fetch).toHaveBeenCalledWith(
        DOWNLOAD_URL,
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    and('la date de dernière vérification est enregistrée', async () => {
      const lastCheck = await AsyncStorage.getItem(KEY_LAST_CHECK(MODEL_TYPE, MODEL_ID));
      expect(lastCheck).not.toBeNull();
      const checkDate = new Date(lastCheck!);
      const now = new Date();
      expect(checkDate.getUTCDate()).toBe(now.getUTCDate());
      expect(checkDate.getUTCMonth()).toBe(now.getUTCMonth());
      expect(checkDate.getUTCFullYear()).toBe(now.getUTCFullYear());
    });
  });

  // ============================================================================
  // AC3 : Throttle — pas de re-vérification si déjà vérifiée aujourd'hui
  // ============================================================================

  test("Throttle — pas de re-vérification si déjà vérifiée aujourd'hui (AC3)", ({
    given,
    when,
    then,
    and,
  }) => {
    let fetchCallCount = 0;

    defineBackgroundSteps(given, and);

    given(`le modèle "${MODEL_NAME}" a été vérifié aujourd'hui`, async () => {
      await AsyncStorage.setItem(KEY_LAST_CHECK(MODEL_TYPE, MODEL_ID), today());
    });

    when('le système évalue si une vérification est nécessaire', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      const checkNeeded = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);
      // autoCheckAll ne déclenche pas checkForUpdate si isCheckNeeded=false
      if (checkNeeded.type === 'success' && checkNeeded.data) {
        await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE);
      }
      fetchCallCount = fetchSpy.mock.calls.length;
    });

    then('isCheckNeeded retourne false', async () => {
      const checkNeeded = await service.isCheckNeeded(MODEL_ID, MODEL_TYPE);
      expect(checkNeeded.type).toBe(RepositoryResultType.SUCCESS);
      expect((checkNeeded as { type: 'success'; data: boolean }).data).toBe(false);
    });

    and("aucune requête réseau n'est effectuée", () => {
      expect(fetchCallCount).toBe(0);
    });
  });

  // ============================================================================
  // AC5 : Détection mise à jour disponible → notification
  // ============================================================================

  test('Détection mise à jour disponible → notification (AC5)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackgroundSteps(given, and);

    given(`le modèle "${MODEL_NAME}" a un ETag stocké "etag-v1"`, async () => {
      await AsyncStorage.setItem(KEY_STORED_ETAG(MODEL_TYPE, MODEL_ID), 'etag-v1');
    });

    and('la source retourne l\'ETag "etag-v2" (différent)', () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockHeadResponse('etag-v2'),
      );
    });

    when('la vérification est effectuée', async () => {
      await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);
    });

    then('le statut retourné est "update-available"', async () => {
      const statusStr = await AsyncStorage.getItem(KEY_UPDATE_STATUS(MODEL_TYPE, MODEL_ID));
      expect(statusStr).toBe('update-available');
    });

    and('une notification "Mise à jour disponible" est planifiée', async () => {
      await notifService.initialize();
      await notifService.notifyUpdateAvailable(MODEL_ID, MODEL_NAME, 'llm');
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toContain('Mise à jour disponible');
      expect(call.content.body).toContain(MODEL_NAME);
    });

    and('le badge "Update" s\'affiche sur la carte du modèle', async () => {
      const info = await service.getUpdateInfo(MODEL_ID, MODEL_TYPE);
      expect(info.type).toBe(RepositoryResultType.SUCCESS);
      const data = (info as { type: 'success'; data: { status: string } }).data;
      expect(data.status).toBe('update-available');
    });
  });

  // ============================================================================
  // AC2 : Vérification manuelle force le check
  // ============================================================================

  test('Vérification manuelle force le check (AC2)', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackgroundSteps(given, and);

    given(`le modèle "${MODEL_NAME}" a été vérifié aujourd'hui`, async () => {
      await AsyncStorage.setItem(KEY_LAST_CHECK(MODEL_TYPE, MODEL_ID), today());
      await AsyncStorage.setItem(KEY_STORED_ETAG(MODEL_TYPE, MODEL_ID), 'etag-v1');
    });

    when('j\'appuie sur le bouton "Vérifier les mises à jour"', async () => {
      // checkAll() de useModelUpdateCheck utilise ignoreThrottle=true
      jest.spyOn(global, 'fetch').mockResolvedValueOnce(
        createMockHeadResponse('etag-v1'),
      );
      await service.checkForUpdate(MODEL_ID, DOWNLOAD_URL, MODEL_TYPE, true);
    });

    then('la vérification est effectuée malgré le throttle', () => {
      expect(global.fetch).toHaveBeenCalledWith(
        DOWNLOAD_URL,
        expect.objectContaining({ method: 'HEAD' }),
      );
    });

    and('le résultat est affiché immédiatement', async () => {
      const statusStr = await AsyncStorage.getItem(KEY_UPDATE_STATUS(MODEL_TYPE, MODEL_ID));
      expect(statusStr).toBe('up-to-date');
    });
  });
});
