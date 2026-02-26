/**
 * FirstLaunchInitializer Unit Tests
 * Story 24.4: First Launch Initializer — Défauts Automatiques sur Pixel 9+
 *
 * Cas couverts (≥ 6) :
 * 1. Premier lancement → run exécute les étapes (AC1-AC7)
 * 2. first_launch_completed = 'true' → run ne fait rien (AC1)
 * 3. Pixel 9 détecté → AC3 + AC4 + AC5 appelés
 * 4. Non-Pixel (Samsung) → aucun setting modifié, marqué completed (AC8)
 * 5. Échec download → settings quand même persistés + marqué completed (AC9)
 * 6. Modèle déjà téléchargé → download skippé, assignation faite (AC5)
 * 7. HF auth requise et absente → download skippé proprement, pas de flash UI
 */

import 'reflect-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirstLaunchInitializer, FIRST_LAUNCH_KEY } from '../FirstLaunchInitializer';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { NPUInfo } from '../../../Normalization/services/NPUDetectionService';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePixel9NPU(): NPUInfo {
  return {
    hasNPU: true,
    type: 'tensor-tpu',
    generation: 'Tensor G4',
    deviceModel: 'Pixel 9',
    manufacturer: 'google',
    isRecommendedForLLM: true,
  };
}

function makeSamsungNPU(): NPUInfo {
  return {
    hasNPU: true,
    type: 'samsung-npu',
    generation: 'Exynos 2400',
    deviceModel: 'Samsung Galaxy S24',
    manufacturer: 'samsung',
    isRecommendedForLLM: true,
  };
}

function makeNPUServiceMock(npuInfo: NPUInfo) {
  return { detectNPU: jest.fn().mockResolvedValue(npuInfo) };
}

function makeEngineServiceMock() {
  return { setSelectedEngineType: jest.fn().mockResolvedValue(undefined) };
}

function makeLLMServiceMock(isDownloaded = false, canDownload = true) {
  return {
    canDownloadModel: jest.fn().mockReturnValue(canDownload),
    isModelDownloaded: jest.fn().mockResolvedValue(isDownloaded),
    downloadModel: jest.fn().mockResolvedValue('/path/to/gemma'),
    setModelForTask: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('FirstLaunchInitializer', () => {
  beforeEach(async () => {
    // Reset AsyncStorage entre chaque test
    await AsyncStorage.clear();
    // Reset settingsStore state directement (pattern story-24-3)
    useSettingsStore.setState({ autoTranscriptionEnabled: false });
  });

  // ── Cas 1 : Premier lancement → toutes les étapes s'exécutent ────────────

  it('premier lancement sur Pixel 9 → native recognition + auto-transcription + Gemma configurés', async () => {
    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false);

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    // Passer un onProgress pour que downloadModel reçoive un callback (pas undefined)
    await initializer.run(jest.fn());

    // AC3 : moteur de transcription natif
    expect(engineMock.setSelectedEngineType).toHaveBeenCalledWith('native');
    // AC4 : auto-transcription activée (vérifier l'état Zustand directement)
    expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(true);
    // AC5 : téléchargement Gemma déclenché (avec callback)
    expect(llmMock.downloadModel).toHaveBeenCalledWith('gemma3-1b-mediapipe', expect.any(Function));
    // AC5 : assignation des tâches
    expect(llmMock.setModelForTask).toHaveBeenCalledWith('postProcessing', 'gemma3-1b-mediapipe');
    expect(llmMock.setModelForTask).toHaveBeenCalledWith('analysis', 'gemma3-1b-mediapipe');
    // AC7 : marquage completed
    await expect(AsyncStorage.getItem(FIRST_LAUNCH_KEY)).resolves.toBe('true');
  });

  // ── Cas 2 : Second lancement → no-op garanti ─────────────────────────────

  it('second lancement (flag déjà true) → run ne fait absolument rien', async () => {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');

    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false);

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    await initializer.run();

    expect(npuMock.detectNPU).not.toHaveBeenCalled();
    expect(engineMock.setSelectedEngineType).not.toHaveBeenCalled();
    // AC1 : auto-transcription ne doit PAS être modifiée
    expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(false);
    expect(llmMock.downloadModel).not.toHaveBeenCalled();
  });

  // ── Cas 3 : Non-Pixel → aucun setting modifié, marqué completed ──────────

  it('premier lancement Samsung → aucun setting modifié, toujours marqué completed (AC8)', async () => {
    const npuMock = makeNPUServiceMock(makeSamsungNPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false);

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    await initializer.run();

    expect(engineMock.setSelectedEngineType).not.toHaveBeenCalled();
    // AC8 : auto-transcription ne doit PAS être modifiée pour non-Pixel
    expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(false);
    expect(llmMock.downloadModel).not.toHaveBeenCalled();
    // AC8 : marqué completed même pour non-Pixel
    await expect(AsyncStorage.getItem(FIRST_LAUNCH_KEY)).resolves.toBe('true');
  });

  // ── Cas 4 : Échec download → settings persistés + marqué completed ────────

  it('échec download Gemma → settings transcription persistés + marqué completed (AC9)', async () => {
    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false);
    llmMock.downloadModel.mockRejectedValue(new Error('Network error'));

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    // Ne doit pas throw
    await expect(initializer.run()).resolves.toBeUndefined();

    // AC9 : settings transcription quand même persistés
    expect(engineMock.setSelectedEngineType).toHaveBeenCalledWith('native');
    expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(true);
    // AC9 : marqué completed (pas de boucle infinie)
    await expect(AsyncStorage.getItem(FIRST_LAUNCH_KEY)).resolves.toBe('true');
  });

  // ── Cas 5 : Modèle déjà téléchargé → download skippé, assignation faite ─

  it('modèle déjà téléchargé → download skippé, setModelForTask appelé quand même (AC5)', async () => {
    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(true); // alreadyDownloaded = true

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    await initializer.run();

    // Download skippé
    expect(llmMock.downloadModel).not.toHaveBeenCalled();
    // Assignation faite quand même
    expect(llmMock.setModelForTask).toHaveBeenCalledWith('postProcessing', 'gemma3-1b-mediapipe');
    expect(llmMock.setModelForTask).toHaveBeenCalledWith('analysis', 'gemma3-1b-mediapipe');
    await expect(AsyncStorage.getItem(FIRST_LAUNCH_KEY)).resolves.toBe('true');
  });

  // ── Cas 6 : onProgress callback appelé pendant le download ───────────────

  it('onProgress reçoit les événements de téléchargement + 0 au démarrage', async () => {
    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false);
    // Simulate progress events
    llmMock.downloadModel.mockImplementation((_id: string, onProgress: ((p: { progress: number; totalBytesWritten: number; totalBytesExpectedToWrite: number; }) => void) | undefined) => {
      if (onProgress) {
        onProgress({ progress: 0.5, totalBytesWritten: 277 * 1024 * 1024, totalBytesExpectedToWrite: 555 * 1024 * 1024 });
        onProgress({ progress: 1.0, totalBytesWritten: 555 * 1024 * 1024, totalBytesExpectedToWrite: 555 * 1024 * 1024 });
      }
      return Promise.resolve('/path/to/gemma');
    });

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    const progressValues: number[] = [];
    await initializer.run((p) => progressValues.push(p));

    // 0 au démarrage + 0.5 + 1.0
    expect(progressValues).toEqual([0, 0.5, 1.0]);
  });

  // ── Cas 7 : HF auth requise mais absente → download skippé proprement ─────

  it('HF auth absente → download + setModelForTask skippés, settings transcription quand même appliqués (C1)', async () => {
    const npuMock = makeNPUServiceMock(makePixel9NPU());
    const engineMock = makeEngineServiceMock();
    const llmMock = makeLLMServiceMock(false, false); // canDownload = false

    const initializer = new FirstLaunchInitializer(
      npuMock as never,
      engineMock as never,
      llmMock as never,
    );

    const onProgress = jest.fn();
    await expect(initializer.run(onProgress)).resolves.toBeUndefined();

    // AC3 + AC4 : settings transcription toujours appliqués sur Pixel 9+
    expect(engineMock.setSelectedEngineType).toHaveBeenCalledWith('native');
    expect(useSettingsStore.getState().autoTranscriptionEnabled).toBe(true);
    // Download et assignation skippés proprement (pas de flash UI à 0%)
    expect(onProgress).not.toHaveBeenCalled();
    expect(llmMock.downloadModel).not.toHaveBeenCalled();
    expect(llmMock.setModelForTask).not.toHaveBeenCalled();
    // AC7 : marqué completed malgré le skip
    await expect(AsyncStorage.getItem(FIRST_LAUNCH_KEY)).resolves.toBe('true');
  });

  // ── isPixel9Plus : vérification directe des cas limites ──────────────────

  describe('isPixel9Plus()', () => {
    let initializer: FirstLaunchInitializer;

    beforeEach(() => {
      initializer = new FirstLaunchInitializer(
        makeNPUServiceMock(makePixel9NPU()) as never,
        makeEngineServiceMock() as never,
        makeLLMServiceMock() as never,
      );
    });

    it('Pixel 9 → true', () => {
      expect(initializer.isPixel9Plus({ ...makePixel9NPU(), deviceModel: 'Pixel 9' })).toBe(true);
    });

    it('Pixel 9 Pro → true', () => {
      expect(initializer.isPixel9Plus({ ...makePixel9NPU(), deviceModel: 'Pixel 9 Pro' })).toBe(true);
    });

    it('Pixel 9 Pro XL → true', () => {
      expect(initializer.isPixel9Plus({ ...makePixel9NPU(), deviceModel: 'Pixel 9 Pro XL' })).toBe(true);
    });

    it('Pixel 9a → true (dans liste explicite et génération Tensor G4)', () => {
      expect(initializer.isPixel9Plus({
        ...makePixel9NPU(),
        deviceModel: 'Pixel 9a',
        generation: 'Tensor G4',
      })).toBe(true);
    });

    it('Pixel 10 avec Tensor G5 → true (futur modèle)', () => {
      expect(initializer.isPixel9Plus({
        ...makePixel9NPU(),
        deviceModel: 'Pixel 10',
        generation: 'Tensor G5',
      })).toBe(true);
    });

    it('Pixel 8 (Tensor G3) → false', () => {
      expect(initializer.isPixel9Plus({
        hasNPU: true,
        type: 'tensor-tpu',
        generation: 'Tensor G3',
        deviceModel: 'Pixel 8',
        manufacturer: 'google',
        isRecommendedForLLM: true,
      })).toBe(false);
    });

    it('Samsung avec manufacturer google → false (manufacturer Samsung)', () => {
      expect(initializer.isPixel9Plus(makeSamsungNPU())).toBe(false);
    });

    it('iPhone → false (manufacturer apple)', () => {
      expect(initializer.isPixel9Plus({
        hasNPU: true,
        type: 'neural-engine',
        generation: 'A18',
        deviceModel: 'iPhone 16',
        manufacturer: 'apple',
        isRecommendedForLLM: true,
      })).toBe(false);
    });
  });
});
