/**
 * Story 8.7 — Téléchargement de Modèles en Arrière-Plan avec Notifications
 *
 * BDD acceptance tests for ModelDownloadNotificationService.
 * Tests the notification logic (progress, success, error, permissions).
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { Platform } from 'react-native';

// Mock expo-notifications before any imports
const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('notification-id');
const mockDismissNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismissNotificationAsync(...args),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  AndroidImportance: { DEFAULT: 3 },
}));

// Helper following DeviceCapabilitiesService.test.ts pattern
function mockPlatformOS(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', {
    get: () => os,
    configurable: true,
  });
}

// Import after mocks are set
import { ModelDownloadNotificationService } from '../../src/contexts/Normalization/services/ModelDownloadNotificationService';
import 'reflect-metadata';

const feature = loadFeature(
  './tests/acceptance/features/story-8-7-model-download-notifications.feature'
);

defineFeature(feature, (test) => {
  let service: ModelDownloadNotificationService;

  beforeEach(() => {
    mockPlatformOS('android');
    jest.clearAllMocks();
    service = new ModelDownloadNotificationService();
  });

  // ============================================================================
  // AC1 & AC5: Progress notifications (Android only, 10 % debounce)
  // ============================================================================

  test('Envoyer une notification de progression tous les 10 % sur Android', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'application tourne sur Android", () => {
      mockPlatformOS('android');
    });

    and("un téléchargement de modèle est en cours", () => {
      // Service ready
    });

    when('la progression passe de 0 % à 10 %', async () => {
      await service.updateProgressNotification('whisper-tiny', 'Whisper Tiny', 0.1);
    });

    then('une notification de progression est envoyée avec "10%"', () => {
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.body).toContain('10%');
    });

    and('une progression de 15 % ne déclenche pas de nouvelle notification', async () => {
      mockScheduleNotificationAsync.mockClear();
      await service.updateProgressNotification('whisper-tiny', 'Whisper Tiny', 0.15);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    and('une progression de 20 % déclenche une nouvelle notification avec "20%"', async () => {
      mockScheduleNotificationAsync.mockClear();
      await service.updateProgressNotification('whisper-tiny', 'Whisper Tiny', 0.2);
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.body).toContain('20%');
    });
  });

  test('Ne pas envoyer de notification de progression sur iOS', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'application tourne sur iOS", () => {
      mockPlatformOS('ios');
    });

    and("un téléchargement de modèle est en cours", () => {
      // Ready
    });

    when('la progression est mise à jour à 50 %', async () => {
      await service.updateProgressNotification('whisper-tiny', 'Whisper Tiny', 0.5);
    });

    then("aucune notification de progression n'est envoyée", () => {
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // AC2: Permission requests
  // ============================================================================

  test("Demander la permission avant les notifications si non accordée", ({
    given,
    when,
    then,
  }) => {
    given("la permission de notification n'a pas encore été accordée", () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
      mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    });

    when('le service de notification est initialisé', async () => {
      await service.requestPermissions();
    });

    then("la permission de notification est demandée à l'utilisateur", () => {
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });
  });

  test("Ne pas redemander la permission si déjà accordée", ({ given, when, then, and }) => {
    let requestResult: boolean;

    given("la permission de notification est déjà accordée", () => {
      mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    });

    when('le service de notification est initialisé', async () => {
      requestResult = await service.requestPermissions();
    });

    then("la permission de notification n'est pas demandée à nouveau", () => {
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    });

    and('la méthode retourne true', () => {
      expect(requestResult).toBe(true);
    });
  });

  // ============================================================================
  // AC3: Success notifications
  // ============================================================================

  test("Notifier l'utilisateur quand un modèle LLM est téléchargé", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un modèle LLM est en cours de téléchargement", () => {
      // Setup state
    });

    when('le téléchargement se termine avec succès', async () => {
      await service.notifyDownloadSuccess('qwen-1.5b', 'Qwen 1.5B GGUF', 'llm');
    });

    then('une notification "Modèle téléchargé" est envoyée', () => {
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toBe('Modèle téléchargé');
    });

    and('la notification contient le nom du modèle', () => {
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.body).toContain('Qwen 1.5B GGUF');
    });

    and("la notification permet de naviguer vers l'écran LLM", () => {
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.data.screen).toBe('llm');
      expect(call.content.data.type).toBe('model_download_success');
    });
  });

  test("Notifier l'utilisateur quand un modèle Whisper est téléchargé", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un modèle Whisper est en cours de téléchargement", () => {
      // Setup state
    });

    when('le téléchargement se termine avec succès', async () => {
      await service.notifyDownloadSuccess('tiny', 'Whisper Tiny (75 Mo)', 'whisper');
    });

    then('une notification "Modèle téléchargé" est envoyée', () => {
      expect(mockScheduleNotificationAsync).toHaveBeenCalled();
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toBe('Modèle téléchargé');
    });

    and("la notification permet de naviguer vers l'écran Whisper", () => {
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.data.screen).toBe('whisper');
    });
  });

  // ============================================================================
  // AC4: Error notifications
  // ============================================================================

  test("Notifier l'utilisateur en cas d'échec de téléchargement", ({
    given,
    when,
    then,
    and,
  }) => {
    given("un modèle est en cours de téléchargement", () => {
      // Setup state
    });

    when('le téléchargement échoue avec une erreur réseau', async () => {
      await service.notifyDownloadError('qwen-1.5b', 'Qwen 1.5B GGUF', 'llm');
    });

    then('une notification "Échec du téléchargement" est envoyée', () => {
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toBe('Échec du téléchargement');
    });

    and("la notification invite à réessayer", () => {
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.body).toContain('réessayer');
    });
  });

  // ============================================================================
  // AC6: Dismiss progress on completion
  // ============================================================================

  test('Supprimer la notification de progression après le succès', ({
    given,
    when,
    then,
    and,
  }) => {
    given("une notification de progression est affichée", async () => {
      await service.updateProgressNotification('whisper-tiny', 'Whisper Tiny', 0.5);
      mockScheduleNotificationAsync.mockClear();
    });

    when('le téléchargement se termine', async () => {
      await service.dismissProgressNotification('whisper-tiny');
      await service.notifyDownloadSuccess('whisper-tiny', 'Whisper Tiny (75 Mo)', 'whisper');
    });

    then('la notification de progression est supprimée', () => {
      expect(mockDismissNotificationAsync).toHaveBeenCalledWith(
        'model-download-progress-whisper-tiny'
      );
    });

    and("la notification de succès s'affiche à la place", () => {
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mockScheduleNotificationAsync.mock.calls[0][0];
      expect(call.content.title).toBe('Modèle téléchargé');
    });
  });
});
