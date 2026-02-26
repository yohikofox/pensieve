/**
 * BDD Acceptance Tests — Story 24.4: First Launch Initializer — Défauts Automatiques sur Pixel 9+
 *
 * Valide les comportements du FirstLaunchInitializer :
 * - AC1  : Vérification flag AsyncStorage → no-op si déjà complété
 * - AC2  : Détection Pixel 9+ (manufacturer google + model/generation)
 * - AC3  : setSelectedEngineType('native') appelé sur Pixel 9+
 * - AC4  : setAutoTranscription(true) appelé sur Pixel 9+
 * - AC5  : downloadModel + setModelForTask pour gemma3-1b-mediapipe
 * - AC7  : first_launch_completed marqué 'true' à la fin
 * - AC8  : Aucune modification sur appareils non-Pixel
 *
 * Run: npm run test:acceptance
 */

import 'reflect-metadata';
import { defineFeature, loadFeature } from 'jest-cucumber';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirstLaunchInitializer, FIRST_LAUNCH_KEY } from '../../src/contexts/identity/services/FirstLaunchInitializer';
import { useSettingsStore } from '../../src/stores/settingsStore';

// Copie locale du type NPUInfo pour éviter de dépendre de NPUDetectionService.ts (erreur TS pré-existante)
interface NPUInfo {
  hasNPU: boolean;
  type: 'neural-engine' | 'tensor-tpu' | 'samsung-npu' | 'snapdragon-npu' | 'none';
  generation: string;
  deviceModel: string;
  manufacturer: 'apple' | 'google' | 'samsung' | 'other';
  isRecommendedForLLM: boolean;
}

const feature = loadFeature(
  'tests/acceptance/features/story-24-4-first-launch.feature',
);

// ── Mock factories ───────────────────────────────────────────────────────────

function makeNPUServiceMock(npuInfo: NPUInfo) {
  return { detectNPU: jest.fn().mockResolvedValue(npuInfo) };
}

function makeEngineServiceMock() {
  return { setSelectedEngineType: jest.fn().mockResolvedValue(undefined) };
}

function makeLLMServiceMock() {
  return {
    canDownloadModel: jest.fn().mockReturnValue(true),
    isModelDownloaded: jest.fn().mockResolvedValue(false),
    downloadModel: jest.fn().mockResolvedValue('/path/to/gemma'),
    setModelForTask: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Feature definition ───────────────────────────────────────────────────────

defineFeature(feature, (test) => {
  let npuMock: ReturnType<typeof makeNPUServiceMock>;
  let engineMock: ReturnType<typeof makeEngineServiceMock>;
  let llmMock: ReturnType<typeof makeLLMServiceMock>;

  beforeEach(async () => {
    await AsyncStorage.clear();
    // Réinitialiser l'état Zustand entre chaque test (pattern story-24-3)
    useSettingsStore.setState({ autoTranscriptionEnabled: false });
    npuMock = makeNPUServiceMock({
      hasNPU: false,
      type: 'none',
      generation: 'none',
      deviceModel: '',
      manufacturer: 'other',
      isRecommendedForLLM: false,
    });
    engineMock = makeEngineServiceMock();
    llmMock = makeLLMServiceMock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Scénario 1: Premier lancement Pixel 9 ────────────────────────────────

  test('Premier lancement sur Pixel 9 — configuration optimale automatique', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'utilisateur se connecte pour la première fois", async () => {
      // AsyncStorage est vide — premier lancement
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      expect(flag).toBeNull();
    });

    and(
      /^l'appareil est un "(.*)" avec manufacturer "(.*)" et generation "(.*)"$/,
      (model: string, manufacturer: string, generation: string) => {
        const npuInfo: NPUInfo = {
          hasNPU: true,
          type: 'tensor-tpu',
          generation,
          deviceModel: model,
          manufacturer: manufacturer as NPUInfo['manufacturer'],
          isRecommendedForLLM: true,
        };
        npuMock = makeNPUServiceMock(npuInfo);
      },
    );

    when("FirstLaunchInitializer.run() est appelé", async () => {
      const initializer = new FirstLaunchInitializer(
        npuMock as never,
        engineMock as never,
        llmMock as never,
      );
      // Passer un callback pour que downloadModel reçoive une fonction (pas undefined)
      await initializer.run(jest.fn());
    });

    then('setSelectedEngineType est appelé avec "native"', () => {
      expect(engineMock.setSelectedEngineType).toHaveBeenCalledWith('native');
    });

    and('setAutoTranscription est appelé avec true', () => {
      // Vérifier l'état Zustand directement (plus fiable que le spy entre tests)
      expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(true);
    });

    and('downloadModel est appelé pour "gemma3-1b-mediapipe"', () => {
      expect(llmMock.downloadModel).toHaveBeenCalledWith(
        'gemma3-1b-mediapipe',
        expect.any(Function),
      );
    });

    and('setModelForTask est appelé pour "postProcessing" avec "gemma3-1b-mediapipe"', () => {
      expect(llmMock.setModelForTask).toHaveBeenCalledWith(
        'postProcessing',
        'gemma3-1b-mediapipe',
      );
    });

    and('setModelForTask est appelé pour "analysis" avec "gemma3-1b-mediapipe"', () => {
      expect(llmMock.setModelForTask).toHaveBeenCalledWith(
        'analysis',
        'gemma3-1b-mediapipe',
      );
    });

    and('first_launch_completed est marqué "true"', async () => {
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      expect(flag).toBe('true');
    });
  });

  // ── Scénario 2: Second lancement → no-op ─────────────────────────────────

  test('Second lancement — initializer est un no-op', ({ given, when, then, and }) => {
    given('first_launch_completed vaut déjà "true" dans AsyncStorage', async () => {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    });

    when("FirstLaunchInitializer.run() est appelé", async () => {
      const initializer = new FirstLaunchInitializer(
        npuMock as never,
        engineMock as never,
        llmMock as never,
      );
      await initializer.run();
    });

    then("aucun service n'est appelé", () => {
      expect(npuMock.detectNPU).not.toHaveBeenCalled();
      expect(engineMock.setSelectedEngineType).not.toHaveBeenCalled();
      // Vérifier l'état Zustand directement
      expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(false);
      expect(llmMock.downloadModel).not.toHaveBeenCalled();
    });

    and('first_launch_completed reste "true"', async () => {
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      expect(flag).toBe('true');
    });
  });

  // ── Scénario 3: Premier lancement Samsung → aucune configuration ─────────

  test('Premier lancement sur Samsung — aucune configuration automatique', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'utilisateur se connecte pour la première fois", async () => {
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      expect(flag).toBeNull();
    });

    and(
      /^l'appareil est un "(.*)" avec manufacturer "(.*)" et generation "(.*)"$/,
      (model: string, manufacturer: string, generation: string) => {
        const npuInfo: NPUInfo = {
          hasNPU: true,
          type: 'samsung-npu',
          generation,
          deviceModel: model,
          manufacturer: manufacturer as NPUInfo['manufacturer'],
          isRecommendedForLLM: true,
        };
        npuMock = makeNPUServiceMock(npuInfo);
      },
    );

    when("FirstLaunchInitializer.run() est appelé", async () => {
      const initializer = new FirstLaunchInitializer(
        npuMock as never,
        engineMock as never,
        llmMock as never,
      );
      await initializer.run();
    });

    then("setSelectedEngineType n'est pas appelé", () => {
      expect(engineMock.setSelectedEngineType).not.toHaveBeenCalled();
    });

    and("setAutoTranscription n'est pas appelé", () => {
      // Vérifier l'état Zustand directement (autoTranscription doit rester false)
      expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(false);
    });

    and("downloadModel n'est pas appelé", () => {
      expect(llmMock.downloadModel).not.toHaveBeenCalled();
    });

    and('first_launch_completed est marqué "true"', async () => {
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
      expect(flag).toBe('true');
    });
  });
});
