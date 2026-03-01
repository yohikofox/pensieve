import 'reflect-metadata';
import { injectable, inject, container } from 'tsyringe';
import { File, Paths } from 'expo-file-system';
// ASYNC_STORAGE_OK: UI preferences only (Whisper model selection, custom vocabulary, download resume) — not critical data (ADR-022)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fileHash } from '@preeternal/react-native-file-hash';
import {
  createDownloadTask,
  getExistingDownloadTasks,
  type DownloadTask,
} from '@kesha-antonov/react-native-background-downloader';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import type { IModelDownloadNotificationService } from '../domain/IModelDownloadNotificationService';
import type { IModelUsageTrackingService } from '../domain/IModelUsageTrackingService';
import { CAPTURE_TYPES, CAPTURE_STATES } from '../../capture/domain/Capture.model';

export type WhisperModelSize = 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';

const SELECTED_MODEL_KEY = '@pensieve/selected_whisper_model';
const CUSTOM_VOCABULARY_KEY = '@pensieve/custom_vocabulary';

/** Display names for Whisper models */
const WHISPER_MODEL_NAMES: Record<WhisperModelSize, string> = {
  tiny: 'Whisper Tiny (75 Mo)',
  base: 'Whisper Base (142 Mo)',
  small: 'Whisper Small (466 Mo)',
  medium: 'Whisper Medium (1,5 Go)',
  'large-v3': 'Whisper Large v3 (3,1 Go)',
};

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-1
}

/**
 * Service to manage transcription model download and storage
 *
 * Currently supports Whisper models (tiny, base, small, medium, large-v3).
 * Service name is generic to allow future support for other STT models.
 *
 * Uses Expo SDK 54 modern APIs:
 * - expo/fetch with ReadableStream for progress tracking
 * - expo-file-system File/Directory classes for storage
 *
 * Responsibilities:
 * - Download transcription models from remote URL
 * - Store models in secure app directory
 * - Track download progress
 * - Validate model existence
 * - Handle download failures
 * - Manage custom vocabulary for improved transcription
 */
@injectable()
export class TranscriptionModelService {
  private readonly MODEL_BASE_URL =
    'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

  private readonly MODEL_CONFIGS = {
    tiny: {
      filename: 'ggml-tiny.bin',
      expectedSize: 75 * 1024 * 1024, // ~75MB
      sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
    },
    base: {
      filename: 'ggml-base.bin',
      expectedSize: 142 * 1024 * 1024, // ~142MB
      sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
    },
    small: {
      filename: 'ggml-small.bin',
      expectedSize: 466 * 1024 * 1024, // ~466MB
      sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
    },
    medium: {
      filename: 'ggml-medium.bin',
      expectedSize: 1500 * 1024 * 1024, // ~1.5GB
      sha256: null as string | null, // To be added if needed
    },
    'large-v3': {
      filename: 'ggml-large-v3.bin',
      expectedSize: 3100 * 1024 * 1024, // ~3.1GB
      sha256: null as string | null, // To be added if needed
    },
  };

  /** Map of active Whisper downloads for pause/resume support */
  private activeWhisperDownloads: Map<string, DownloadTask> = new Map();

  constructor(
    @inject(TOKENS.IModelUsageTrackingService) private usageTrackingService: IModelUsageTrackingService
  ) {}

  /**
   * Download Whisper model to device storage with progress tracking
   *
   * Uses react-native-background-downloader for background-compatible downloads:
   * - Continues downloading when app is backgrounded
   * - Pause/Resume support with range requests
   * - Automatic recovery after crash via recoverInterruptedWhisperDownloads()
   *
   * @param modelSize - Model size to download
   * @param onProgress - Callback for download progress updates
   * @returns Path to downloaded model file
   */
  async downloadModel(
    modelSize: WhisperModelSize,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const config = this.MODEL_CONFIGS[modelSize];
    const modelUrl = `${this.MODEL_BASE_URL}/${config.filename}`;
    const modelFile = this.getModelFile(modelSize);
    const modelName = WHISPER_MODEL_NAMES[modelSize];

    console.log('[TranscriptionModelService] 📥 Starting background download:', {
      modelUrl,
      modelPath: modelFile.uri,
    });

    // Lazy resolution dans le callback Promise — IModelDownloadNotificationService n'est pas
    // injecté en constructeur car il n'est utilisé que dans un callback asynchrone (ADR-017)
    const notificationService = container.resolve<IModelDownloadNotificationService>(
      TOKENS.IModelDownloadNotificationService
    );

    return new Promise<string>((resolve, reject) => {
      const task = createDownloadTask({
        id: `whisper-${modelSize}`,
        url: modelUrl,
        destination: modelFile.uri,
        headers: { 'User-Agent': 'Pensieve-App/1.0' },
      });

      this.activeWhisperDownloads.set(modelSize, task);

      task
        .begin((expectedBytes) => {
          console.log('[TranscriptionModelService] 📊 Expected bytes:', expectedBytes);
        })
        .progress(({ bytesDownloaded, bytesTotal }) => {
          const progress = bytesTotal > 0 ? bytesDownloaded / bytesTotal : 0;
          onProgress?.({
            totalBytesWritten: bytesDownloaded,
            totalBytesExpectedToWrite: bytesTotal,
            progress: Math.min(progress, 1),
          });
          notificationService
            .updateProgressNotification(modelSize, modelName, progress)
            .catch(() => {});
        })
        .done(async ({ location }) => {
          this.activeWhisperDownloads.delete(modelSize);
          console.log('[TranscriptionModelService] ✅ Download completed:', location);

          try {
            // Verify checksum
            const isValid = await this.verifyChecksum(modelSize);
            if (!isValid) {
              await this.deleteModel(modelSize);
              await notificationService
                .notifyDownloadError(modelSize, modelName, 'whisper')
                .catch(() => {});
              reject(
                new Error(`Checksum verification failed for ${modelSize} model. File deleted.`)
              );
              return;
            }

            await notificationService.dismissProgressNotification(modelSize).catch(() => {});
            await notificationService
              .notifyDownloadSuccess(modelSize, modelName, 'whisper')
              .catch(() => {});

            // Initialise lastUsed au téléchargement (AC2 — Story 8.8)
            await this.usageTrackingService.trackModelUsed(modelSize, 'whisper').catch(() => {});

            // AC6: Auto-resume pending captures now that model is available (Story 2.7)
            await this.autoResumePendingCaptures();

            resolve(modelFile.uri);
          } catch (error) {
            await notificationService
              .notifyDownloadError(modelSize, modelName, 'whisper')
              .catch(() => {});
            reject(
              new Error(
                `Failed to process ${modelSize} model: ${error instanceof Error ? error.message : 'Unknown error'}`
              )
            );
          }
        })
        .error(async ({ error }) => {
          this.activeWhisperDownloads.delete(modelSize);
          console.error('[TranscriptionModelService] ❌ Download failed:', error);

          await notificationService.dismissProgressNotification(modelSize).catch(() => {});
          await notificationService
            .notifyDownloadError(modelSize, modelName, 'whisper')
            .catch(() => {});

          reject(new Error(`Failed to download ${modelSize} model: ${error}`));
        });

      task.start();
    });
  }

  /**
   * Check if a model is already downloaded
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns true if model exists
   */
  async isModelDownloaded(modelSize: WhisperModelSize): Promise<boolean> {
    const modelFile = this.getModelFile(modelSize);
    const info = modelFile.info();
    return info.exists;
  }

  /**
   * Get the File instance for a model
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns File instance for the model
   */
  private getModelFile(modelSize: WhisperModelSize): File {
    const filename = `whisper-${modelSize}.bin`;
    return new File(Paths.document, filename);
  }

  /**
   * Get the local file path for a model
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Absolute path to model file in document directory
   */
  getModelPath(modelSize: WhisperModelSize): string {
    return this.getModelFile(modelSize).uri;
  }

  /**
   * Delete a downloaded model
   *
   * @param modelSize - 'tiny' or 'base'
   * @throws Error if deletion fails
   */
  async deleteModel(modelSize: WhisperModelSize): Promise<void> {
    const modelFile = this.getModelFile(modelSize);
    try {
      if (modelFile.exists) {
        await modelFile.delete();
      }
      // Nettoie les clés AsyncStorage de tracking après suppression (AC6 — Story 8.8)
      await this.usageTrackingService.clearModelTracking(modelSize, 'whisper').catch(() => {});
    } catch (error) {
      throw new Error(
        `Failed to delete ${modelSize} model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verify SHA256 checksum of a downloaded model
   *
   * @param modelSize - Model size to verify
   * @returns true if checksum matches or no checksum defined, false otherwise
   */
  async verifyChecksum(modelSize: WhisperModelSize): Promise<boolean> {
    const config = this.MODEL_CONFIGS[modelSize];
    if (!config.sha256) {
      console.warn(`[TranscriptionModelService] No checksum for ${modelSize}, skipping verification`);
      return true;
    }

    const filePath = this.getModelPath(modelSize);
    // Remove file:// prefix if present
    const cleanPath = filePath.startsWith('file://') ? filePath.slice(7) : filePath;

    console.log(`[TranscriptionModelService] Verifying checksum for ${modelSize}...`);
    const hash = await fileHash(cleanPath, 'SHA-256');

    if (hash.toLowerCase() !== config.sha256.toLowerCase()) {
      console.error(`[TranscriptionModelService] ❌ Checksum mismatch for ${modelSize}`);
      console.error(`  Expected: ${config.sha256}`);
      console.error(`  Got:      ${hash}`);
      return false;
    }

    console.log(`[TranscriptionModelService] ✅ Checksum verified for ${modelSize}`);
    return true;
  }

  /**
   * Get download URL for a model (for debugging/logging)
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Full URL to download the model
   */
  getModelUrl(modelSize: WhisperModelSize): string {
    const config = this.MODEL_CONFIGS[modelSize];
    return `${this.MODEL_BASE_URL}/${config.filename}`;
  }

  /**
   * Get expected model size in bytes
   *
   * @param modelSize - 'tiny' or 'base'
   * @returns Expected file size in bytes
   */
  getExpectedSize(modelSize: WhisperModelSize): number {
    return this.MODEL_CONFIGS[modelSize].expectedSize;
  }

  /**
   * Download model with automatic retry and exponential backoff
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: After 5 seconds
   * - Attempt 3: After 30 seconds
   * - Attempt 4: After 5 minutes
   * - Total: 3 retries, then fail
   *
   * @param modelSize - 'tiny' or 'base'
   * @param onProgress - Optional progress callback
   * @returns Path to downloaded model
   * @throws Error after 3 failed retry attempts
   */
  async downloadModelWithRetry(
    modelSize: WhisperModelSize,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const retryDelays = [5000, 30000, 5 * 60 * 1000]; // 5s, 30s, 5min
    let lastError: Error | null = null;

    // Initial attempt
    try {
      return await this.downloadModel(modelSize, onProgress);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }

    // Retry attempts with exponential backoff
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      const delay = retryDelays[attempt];

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        return await this.downloadModel(modelSize, onProgress);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    // All retries failed
    throw lastError!;
  }

  /**
   * Get the currently selected model for transcription
   *
   * @returns The selected model size, or null if none selected
   */
  async getSelectedModel(): Promise<WhisperModelSize | null> {
    try {
      const selected = await AsyncStorage.getItem(SELECTED_MODEL_KEY);
      if (selected === 'tiny' || selected === 'base' || selected === 'small' || selected === 'medium' || selected === 'large-v3') {
        return selected;
      }
      return null;
    } catch (error) {
      console.error('[TranscriptionModelService] Failed to get selected model:', error);
      return null;
    }
  }

  /**
   * Set the selected model for transcription
   *
   * @param modelSize - The model to use for transcription
   */
  async setSelectedModel(modelSize: WhisperModelSize): Promise<void> {
    try {
      await AsyncStorage.setItem(SELECTED_MODEL_KEY, modelSize);
      console.log('[TranscriptionModelService] ✅ Selected model set to:', modelSize);
      // Met à jour lastUsed à la sélection (AC2 — Story 8.8)
      await this.usageTrackingService.trackModelUsed(modelSize, 'whisper').catch(() => {});
    } catch (error) {
      console.error('[TranscriptionModelService] Failed to set selected model:', error);
      throw error;
    }
  }

  /**
   * Get the best available model for transcription
   *
   * Priority:
   * 1. User-selected model (if downloaded)
   * 2. Best quality downloaded model (medium > small > base > tiny)
   * 3. null (no model available)
   *
   * @returns The best available model, or null if none downloaded
   */
  async getBestAvailableModel(): Promise<WhisperModelSize | null> {
    // First check user preference
    const selected = await this.getSelectedModel();
    if (selected && await this.isModelDownloaded(selected)) {
      return selected;
    }

    // Fallback to best available (quality order)
    const priorityOrder: WhisperModelSize[] = ['large-v3', 'medium', 'small', 'base', 'tiny'];
    for (const model of priorityOrder) {
      if (await this.isModelDownloaded(model)) {
        return model;
      }
    }

    return null;
  }

  /**
   * Get the custom vocabulary words for Whisper transcription
   *
   * @returns Array of custom vocabulary words
   */
  async getCustomVocabulary(): Promise<string[]> {
    try {
      const stored = await AsyncStorage.getItem(CUSTOM_VOCABULARY_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        return data.words || [];
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Set the custom vocabulary words for Whisper transcription
   *
   * @param words - Array of custom vocabulary words
   */
  async setCustomVocabulary(words: string[]): Promise<void> {
    await AsyncStorage.setItem(
      CUSTOM_VOCABULARY_KEY,
      JSON.stringify({ words })
    );
    console.log('[TranscriptionModelService] ✅ Custom vocabulary saved:', words.length, 'words');
  }

  /**
   * Get the vocabulary as a prompt string for Whisper
   *
   * @returns Comma-separated vocabulary string, or empty string if no vocabulary
   */
  async getPromptString(): Promise<string> {
    const words = await this.getCustomVocabulary();
    return words.length > 0 ? words.join(', ') : '';
  }

  /**
   * Pause an active Whisper download
   */
  pauseWhisperDownload(modelSize: WhisperModelSize): void {
    const task = this.activeWhisperDownloads.get(modelSize);
    if (!task) {
      console.warn(`[TranscriptionModelService] No active download to pause: ${modelSize}`);
      return;
    }
    task.pause();
    console.log('[TranscriptionModelService] ⏸ Download paused:', modelSize);
  }

  /**
   * Resume a paused Whisper download
   */
  resumeWhisperDownload(modelSize: WhisperModelSize): void {
    const task = this.activeWhisperDownloads.get(modelSize);
    if (!task) {
      console.warn(`[TranscriptionModelService] No paused download to resume: ${modelSize}`);
      return;
    }
    task.resume();
    console.log('[TranscriptionModelService] ▶ Download resumed:', modelSize);
  }

  /**
   * Cancel an active Whisper download and remove partial file
   */
  async cancelWhisperDownload(modelSize: WhisperModelSize): Promise<void> {
    const task = this.activeWhisperDownloads.get(modelSize);
    if (!task) {
      console.warn(`[TranscriptionModelService] No active download to cancel: ${modelSize}`);
      return;
    }

    try {
      task.stop();
      this.activeWhisperDownloads.delete(modelSize);

      // Delete partial file
      const modelFile = this.getModelFile(modelSize);
      if (modelFile.exists) {
        await modelFile.delete();
      }

      console.log('[TranscriptionModelService] ❌ Download cancelled:', modelSize);
    } catch (error) {
      console.error('[TranscriptionModelService] Failed to cancel download:', error);
      throw error;
    }
  }

  /**
   * Recover interrupted Whisper downloads after crash/app restart
   * Uses getExistingDownloadTasks() from react-native-background-downloader
   * Call this at app startup (e.g. from WhisperSettingsScreen's AppState listener)
   */
  async recoverInterruptedWhisperDownloads(): Promise<WhisperModelSize[]> {
    const recoveredModels: WhisperModelSize[] = [];

    try {
      const tasks = await getExistingDownloadTasks();

      for (const task of tasks) {
        if (!task.id.startsWith('whisper-')) {
          continue;
        }

        const modelSize = task.id.replace('whisper-', '') as WhisperModelSize;
        if (!this.MODEL_CONFIGS[modelSize]) {
          console.warn(`[TranscriptionModelService] Unknown model from recovery: ${task.id}`);
          continue;
        }

        // Reattach minimal callbacks for recovery
        task
          .progress(({ bytesDownloaded, bytesTotal }) => {
            const percent =
              bytesTotal > 0 ? Math.round((bytesDownloaded / bytesTotal) * 100) : 0;
            console.log(
              `[TranscriptionModelService] Recovery progress ${modelSize}: ${percent}%`
            );
          })
          .done(() => {
            console.log(`[TranscriptionModelService] Recovery completed: ${modelSize}`);
            this.activeWhisperDownloads.delete(modelSize);
          })
          .error(({ error }) => {
            console.error(`[TranscriptionModelService] Recovery failed: ${modelSize}`, error);
            this.activeWhisperDownloads.delete(modelSize);
          });

        this.activeWhisperDownloads.set(modelSize, task);
        recoveredModels.push(modelSize);
      }

      if (recoveredModels.length > 0) {
        console.log(
          `[TranscriptionModelService] Recovered ${recoveredModels.length} download(s):`,
          recoveredModels
        );
      }

      return recoveredModels;
    } catch (error) {
      console.error('[TranscriptionModelService] Recovery failed:', error);
      return [];
    }
  }

  /**
   * Get sizes of all downloaded Whisper models (files present on disk)
   * Used by getUnusedModels() in settings screens (Subtask 3.5 — Story 8.8)
   */
  async getDownloadedModelSizes(): Promise<string[]> {
    const allSizes = Object.keys(this.MODEL_CONFIGS) as WhisperModelSize[];
    const results: string[] = [];
    for (const size of allSizes) {
      if (await this.isModelDownloaded(size)) {
        results.push(size);
      }
    }
    return results;
  }

  /**
   * AC6: Auto-resume transcription for pending captures when model becomes available (Story 2.7)
   *
   * Finds all audio captures with state='captured' and no transcription,
   * then adds them to the transcription queue.
   *
   * @returns Number of captures queued for transcription
   */
  private async autoResumePendingCaptures(): Promise<number> {
    try {
      console.log('[TranscriptionModelService] Checking for pending captures to auto-resume...');

      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const allCaptures = await repository.findAll();

      // Filter: audio captures that are captured but not yet transcribed
      const pendingCaptures = allCaptures.filter(
        (capture) =>
          capture.type === CAPTURE_TYPES.AUDIO &&
          capture.state === CAPTURE_STATES.CAPTURED &&
          !capture.normalizedText
      );

      if (pendingCaptures.length === 0) {
        console.log('[TranscriptionModelService] No pending captures found');
        return 0;
      }

      console.log(
        `[TranscriptionModelService] Found ${pendingCaptures.length} pending capture(s), adding to queue...`
      );

      // Dynamically import to avoid circular dependency
      const { TranscriptionQueueService } = await import('./TranscriptionQueueService');
      const queueService = container.resolve(TranscriptionQueueService);

      let queuedCount = 0;
      for (const capture of pendingCaptures) {
        try {
          await queueService.enqueue({
            captureId: capture.id,
            audioPath: capture.rawContent || '',
            audioDuration: capture.duration,
          });
          queuedCount++;
        } catch (error) {
          console.error(
            `[TranscriptionModelService] Failed to enqueue capture ${capture.id}:`,
            error
          );
        }
      }

      console.log(
        `[TranscriptionModelService] ✅ Auto-resumed ${queuedCount}/${pendingCaptures.length} capture(s)`
      );
      return queuedCount;
    } catch (error) {
      console.error('[TranscriptionModelService] Auto-resume failed:', error);
      return 0;
    }
  }
}
