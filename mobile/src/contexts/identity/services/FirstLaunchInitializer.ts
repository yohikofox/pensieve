/**
 * FirstLaunchInitializer
 *
 * Story 24.4: First Launch Initializer — Défauts Automatiques sur Pixel 9+
 *
 * Détecte l'appareil au premier lancement et configure automatiquement
 * les paramètres optimaux pour Pixel 9+ (native recognition + Gemma 3 1B MediaPipe).
 *
 * Exception ADR-021: Singleton justifiée — évite les re-détections inutiles
 * et garantit un seul appel `run()` actif à la fois.
 *
 * ASYNC_STORAGE_OK: Clé de marquage premier lancement uniquement — non-critique (ADR-022)
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
// ASYNC_STORAGE_OK: First launch flag only — UI preference, not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NPUDetectionService } from '../../Normalization/services/NPUDetectionService';
import type { NPUInfo } from '../../Normalization/services/NPUDetectionService';
import { TranscriptionEngineService } from '../../Normalization/services/TranscriptionEngineService';
import type { ILLMModelService, DownloadProgress } from '../../Normalization/domain/ILLMModelService';
import type { LLMModelId } from '../../Normalization/services/llmModelsConfig';
import { useSettingsStore } from '../../../stores/settingsStore';
import { TOKENS } from '../../../infrastructure/di/tokens';

export const FIRST_LAUNCH_KEY = '@pensieve/first_launch_completed';

const GEMMA_MEDIAPIPE_MODEL_ID: LLMModelId = 'gemma3-1b-mediapipe';

/**
 * Models corresponding to Pixel 9+ (Tensor G4).
 * Pixel 9a is included in this list and also covered by the generation fallback (Tensor G4).
 */
const PIXEL_9_PLUS_MODELS: readonly string[] = [
  'Pixel 9',
  'Pixel 9 Pro',
  'Pixel 9 Pro XL',
  'Pixel 9 Pro Fold',
  'Pixel 9a',
];

@injectable()
export class FirstLaunchInitializer {
  constructor(
    @inject(NPUDetectionService) private readonly npuService: NPUDetectionService,
    @inject(TranscriptionEngineService) private readonly engineService: TranscriptionEngineService,
    @inject(TOKENS.ILLMModelService) private readonly llmService: ILLMModelService,
  ) {}

  /**
   * Run first-launch initialization.
   * No-op if already completed.
   *
   * @param onProgress - Callback called with download progress (0-1).
   *   Called with 0 when download is about to start (allows UI to appear early).
   */
  async run(onProgress?: (progress: number) => void): Promise<void> {
    const alreadyDone = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (alreadyDone === 'true') return;

    try {
      const npuInfo = await this.npuService.detectNPU();
      if (this.isPixel9Plus(npuInfo)) {
        // Pixel 9+ : native + auto-transcription + Gemma 3 1B (comportement story 24.4 inchangé)
        await this.engineService.setSelectedEngineType('native');
        useSettingsStore.getState().setAutoTranscription(true);
        await this.downloadGemmaWithFallback(onProgress);
      } else {
        // Tous les autres appareils : native par défaut (story 8.4)
        await this.engineService.setSelectedEngineType('native');
      }
    } catch (error) {
      // Log silencieux — jamais de crash utilisateur sur l'initialisation
      console.warn('[FirstLaunchInitializer] Error during initialization:', error);
    } finally {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    }
  }

  /**
   * Detect if device is Pixel 9+ (Tensor G4 or higher).
   * Checks exact model list first, then falls back to generation string parsing.
   */
  isPixel9Plus(npu: NPUInfo): boolean {
    if (npu.manufacturer !== 'google') return false;

    // Exact model match (covers Pixel 9, 9 Pro, 9 Pro XL, 9 Pro Fold, 9a)
    const matchesModel = PIXEL_9_PLUS_MODELS.some(m => npu.deviceModel.startsWith(m));
    if (matchesModel) return true;

    // Fallback: generation string parsing for future models (Tensor G5, G6...)
    const genMatch = npu.generation.match(/Tensor G(\d+)/i);
    if (genMatch) {
      const genNumber = parseInt(genMatch[1], 10);
      return genNumber >= 4;
    }

    return false;
  }

  /**
   * Download Gemma 3 1B MediaPipe with silent error handling.
   * Skips download if model already present; always configures task assignments.
   * Skips entirely (no UI, no error) if HuggingFace auth is required but not configured.
   */
  private async downloadGemmaWithFallback(onProgress?: (n: number) => void): Promise<void> {
    try {
      // Guard: skip if model requires HuggingFace auth and user is not logged in.
      // Avoids silent throw from downloadModel + prevents progress overlay from flashing at 0%.
      if (!this.llmService.canDownloadModel(GEMMA_MEDIAPIPE_MODEL_ID)) {
        console.warn(
          '[FirstLaunchInitializer] Gemma requires HuggingFace auth — skipping first-launch download.',
        );
        return;
      }

      const alreadyDownloaded = await this.llmService.isModelDownloaded(GEMMA_MEDIAPIPE_MODEL_ID);

      if (!alreadyDownloaded) {
        // Signal download start with progress 0 (allows UI to appear before first event)
        onProgress?.(0);
        await this.llmService.downloadModel(
          GEMMA_MEDIAPIPE_MODEL_ID,
          onProgress
            ? (p: DownloadProgress) => onProgress(p.progress)
            : undefined,
        );
      }

      await this.llmService.setModelForTask('postProcessing', GEMMA_MEDIAPIPE_MODEL_ID);
      await this.llmService.setModelForTask('analysis', GEMMA_MEDIAPIPE_MODEL_ID);
    } catch (error) {
      console.warn('[FirstLaunchInitializer] Gemma download failed (non-blocking):', error);
    }
  }
}
