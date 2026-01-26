/**
 * LLMModelService - Manage LLM model download and storage
 *
 * Pattern: Follows WhisperModelService architecture
 *
 * Uses Expo SDK 54 modern APIs:
 * - expo/fetch with ReadableStream for progress tracking
 * - expo-file-system File/Directory classes for storage
 *
 * Responsibilities:
 * - Download LLM models (Qwen, Gemma, Phi) from remote URL
 * - Store models in secure app directory
 * - Track download progress
 * - Validate model existence
 * - Handle download failures with retry
 * - Manage model selection for post-processing
 *
 * Supported models:
 * - llama.rn backends: GGUF format models
 * - MediaPipe backends: Gemma 3n optimized models
 */

import "reflect-metadata";
import { container, inject, injectable } from "tsyringe";
import { fetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NPUDetectionService } from "./NPUDetectionService";
import { HuggingFaceAuthService } from "./HuggingFaceAuthService";

export type LLMModelId =
  | "qwen2.5-0.5b"
  | "qwen2.5-1.5b"
  | "gemma3-1b"
  | "gemma3-1b-q4"
  | "gemma3-1b-q3"
  | "gemma3-1b-q2"
  | "llama3.2-1b"
  | "llama3.2-3b"
  | "phi3-mini"
  | "gemma3-1b-mediapipe"
  | "gemma3n-2b";

/** LLM task types for task-specific model selection */
export type LLMTask = "postProcessing" | "analysis";

export type LLMBackendType = "llamarn" | "mediapipe";

const SELECTED_MODEL_KEY = "@pensieve/selected_llm_model"; // Legacy, kept for migration
const POSTPROCESSING_ENABLED_KEY = "@pensieve/postprocessing_enabled";
const AUTO_POSTPROCESS_KEY = "@pensieve/auto_postprocess_transcription";

/** Storage keys for task-specific model selection */
const TASK_MODEL_KEYS: Record<LLMTask, string> = {
  postProcessing: "@pensieve/llm_model_postprocessing",
  analysis: "@pensieve/llm_model_analysis",
};

export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-1
}

export type PromptTemplate = "chatml" | "gemma" | "phi" | "llama";

/** Device compatibility for model recommendations */
export type DeviceCompatibility = "all" | "google" | "apple";

export interface LLMModelConfig {
  id: LLMModelId;
  name: string;
  filename: string;
  downloadUrl: string;
  expectedSize: number; // bytes
  backend: LLMBackendType;
  description: string;
  recommended?: boolean;
  /** Chat template format for the model */
  promptTemplate: PromptTemplate;
  /** Device compatibility - which devices this model is optimized for */
  deviceCompatibility: DeviceCompatibility;
  /** Whether this model requires HuggingFace authentication (gated model) */
  requiresAuth?: boolean;
}

/**
 * Model configurations
 *
 * Note: All URLs point to publicly accessible models (no authentication required)
 * Using community quantizations from bartowski and official public releases
 *
 * MediaPipe models use expo-llm-mediapipe (SDK 0.10.22) with GPU acceleration.
 */
const MODEL_CONFIGS: Record<LLMModelId, LLMModelConfig> = {
  // === MODÈLES GÉNÉRAUX (tous appareils) ===
  "qwen2.5-0.5b": {
    id: "qwen2.5-0.5b",
    name: "Qwen 2.5 0.5B",
    filename: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    expectedSize: 400 * 1024 * 1024, // ~400MB
    backend: "llamarn",
    description: "Modèle léger et rapide, idéal pour les corrections basiques",
    recommended: true,
    promptTemplate: "chatml",
    deviceCompatibility: "all",
  },
  "qwen2.5-1.5b": {
    id: "qwen2.5-1.5b",
    name: "Qwen 2.5 1.5B",
    filename: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    // Official Qwen GGUF - public, no auth required
    downloadUrl:
      "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    expectedSize: 1100 * 1024 * 1024, // ~1.1GB
    backend: "llamarn",
    description: "Meilleure qualité pour l'analyse et les résumés",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
  },
  "gemma3-1b": {
    id: "gemma3-1b",
    name: "SmolLM2 1.7B",
    filename: "smollm2-1.7b-instruct-q4_k_m.gguf",
    // SmolLM2 from HuggingFace - public, good quality, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
    expectedSize: 1000 * 1024 * 1024, // ~1GB
    backend: "llamarn",
    description: "Bon équilibre qualité/performance (HuggingFace)",
    promptTemplate: "chatml",
    deviceCompatibility: "all",
  },
  "phi3-mini": {
    id: "phi3-mini",
    name: "Phi-3.5 Mini",
    filename: "phi-3.5-mini-instruct-q4_k_m.gguf",
    // Phi-3.5 from bartowski - public, no auth required
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
    expectedSize: 2300 * 1024 * 1024, // ~2.3GB
    backend: "llamarn",
    description: "Meilleure qualité (Microsoft), nécessite plus d'espace",
    promptTemplate: "phi",
    deviceCompatibility: "all",
  },

  // === MODÈLES OPTIMISÉS GOOGLE PIXEL (Gemma) ===
  "gemma3-1b-q4": {
    id: "gemma3-1b-q4",
    name: "Gemma 3 1B (Q4)",
    filename: "gemma-3-1b-it-Q4_K_M.gguf",
    // Gemma 3 1B Q4 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf",
    expectedSize: 766 * 1024 * 1024, // ~766MB
    backend: "llamarn",
    description: "Gemma 3 1B - Optimisé Google Pixel",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    recommended: true,
  },
  "gemma3-1b-q3": {
    id: "gemma3-1b-q3",
    name: "Gemma 3 1B (Q3)",
    filename: "gemma-3-1b-it-Q3_K_M.gguf",
    // Gemma 3 1B Q3 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q3_K_M.gguf",
    expectedSize: 600 * 1024 * 1024, // ~600MB
    backend: "llamarn",
    description: "Gemma 3 1B léger - Optimisé Google Pixel",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
  },
  "gemma3-1b-q2": {
    id: "gemma3-1b-q2",
    name: "Gemma 3 1B (Q2)",
    filename: "gemma-3-1b-it-Q2_K.gguf",
    // Gemma 3 1B Q2 from unsloth - public, no auth required
    downloadUrl:
      "https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q2_K.gguf",
    expectedSize: 450 * 1024 * 1024, // ~450MB
    backend: "llamarn",
    description: "Gemma 3 1B ultra-léger - Optimisé Google Pixel",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
  },
  // === MODÈLES MEDIAPIPE (nécessitent authentification HuggingFace) ===
  "gemma3-1b-mediapipe": {
    id: "gemma3-1b-mediapipe",
    name: "Gemma 3 1B (MediaPipe)",
    filename: "gemma3-1b-mediapipe.task",
    // LiteRT Community - requires HuggingFace auth (gated)
    downloadUrl:
      "https://huggingface.co/litert-community/Gemma3-1B-IT/resolve/main/Gemma3-1B-IT_multi-prefill-seq_q4_ekv2048.task",
    expectedSize: 555 * 1024 * 1024, // ~555MB
    backend: "mediapipe",
    description: "Gemma 3 1B MediaPipe - Optimisé TPU Tensor",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    requiresAuth: true,
  },
  "gemma3n-2b": {
    id: "gemma3n-2b",
    name: "Gemma 3n 2B (TPU)",
    filename: "gemma3n-2b-tpu.litertlm",
    // Google official - requires HuggingFace auth (gated)
    downloadUrl:
      "https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4.litertlm",
    expectedSize: 3660 * 1024 * 1024, // ~3.66GB
    backend: "mediapipe",
    description: "Gemma 3n 2B - Optimisé TPU Tensor (Pixel 6+)",
    promptTemplate: "gemma",
    deviceCompatibility: "google",
    requiresAuth: true,
    recommended: true,
  },

  // === MODÈLES OPTIMISÉS APPLE (Llama) ===
  "llama3.2-1b": {
    id: "llama3.2-1b",
    name: "Llama 3.2 1B",
    filename: "llama-3.2-1b-instruct-q4_k_m.gguf",
    // Llama 3.2 1B from hugging-quants - public
    downloadUrl:
      "https://huggingface.co/hugging-quants/Llama-3.2-1B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-1b-instruct-q4_k_m.gguf",
    expectedSize: 750 * 1024 * 1024, // ~750MB
    backend: "llamarn",
    description: "Llama 3.2 1B - Optimisé Apple",
    promptTemplate: "llama",
    deviceCompatibility: "apple",
    recommended: true,
  },
  "llama3.2-3b": {
    id: "llama3.2-3b",
    name: "Llama 3.2 3B",
    filename: "llama-3.2-3b-instruct-q4_k_m.gguf",
    // Llama 3.2 3B from hugging-quants - public
    downloadUrl:
      "https://huggingface.co/hugging-quants/Llama-3.2-3B-Instruct-Q4_K_M-GGUF/resolve/main/llama-3.2-3b-instruct-q4_k_m.gguf",
    expectedSize: 2000 * 1024 * 1024, // ~2GB
    backend: "llamarn",
    description: "Llama 3.2 3B - Meilleure qualité Apple",
    promptTemplate: "llama",
    deviceCompatibility: "apple",
  },
};

@injectable()
export class LLMModelService {
  private cachedDeviceType: DeviceCompatibility | null = null;
  private authService: HuggingFaceAuthService;

  constructor(
    @inject(NPUDetectionService) private npuDetectionService: NPUDetectionService,
  ) {
    // Resolve HuggingFaceAuthService from container to ensure singleton is used
    this.authService = container.resolve(HuggingFaceAuthService);
  }

  /**
   * Initialize the service (including auth)
   */
  async initialize(): Promise<void> {
    await this.authService.initialize();
  }

  /**
   * Get the auth service for UI components
   */
  getAuthService(): HuggingFaceAuthService {
    return this.authService;
  }

  /**
   * Check if a model requires authentication
   */
  modelRequiresAuth(modelId: LLMModelId): boolean {
    const config = this.getModelConfig(modelId);
    return config.requiresAuth === true;
  }

  /**
   * Check if user can download a model (auth if needed)
   */
  canDownloadModel(modelId: LLMModelId): boolean {
    const config = this.getModelConfig(modelId);
    if (!config.requiresAuth) {
      return true;
    }
    return this.authService.isAuthenticated();
  }

  /**
   * Get all available model configurations
   */
  getAllModels(): LLMModelConfig[] {
    return Object.values(MODEL_CONFIGS);
  }

  /**
   * Detect current device type for model recommendations
   * Uses NPUDetectionService for accurate device detection
   */
  async getDeviceType(): Promise<DeviceCompatibility> {
    if (this.cachedDeviceType) {
      return this.cachedDeviceType;
    }

    const npuInfo = await this.npuDetectionService.detectNPU();

    if (npuInfo.manufacturer === "apple") {
      this.cachedDeviceType = "apple";
    } else if (npuInfo.manufacturer === "google") {
      this.cachedDeviceType = "google";
    } else {
      this.cachedDeviceType = "all";
    }

    return this.cachedDeviceType;
  }

  /**
   * Get models compatible with the current device
   * Returns models that are either "all" or match the device type
   */
  async getModelsForCurrentDevice(): Promise<LLMModelConfig[]> {
    const deviceType = await this.getDeviceType();
    return this.getAllModels().filter(
      (m) => m.deviceCompatibility === "all" || m.deviceCompatibility === deviceType
    );
  }

  /**
   * Get recommended models for the current device
   * Prioritizes device-specific models over generic ones
   */
  async getRecommendedModelsForDevice(): Promise<LLMModelConfig[]> {
    const deviceType = await this.getDeviceType();
    const compatibleModels = await this.getModelsForCurrentDevice();

    // Sort: device-specific first, then by recommended flag, then by size
    return compatibleModels.sort((a, b) => {
      // Device-specific models first
      const aDeviceSpecific = a.deviceCompatibility === deviceType ? 1 : 0;
      const bDeviceSpecific = b.deviceCompatibility === deviceType ? 1 : 0;
      if (aDeviceSpecific !== bDeviceSpecific) {
        return bDeviceSpecific - aDeviceSpecific;
      }

      // Then recommended models
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;

      // Then by size (smaller first)
      return a.expectedSize - b.expectedSize;
    });
  }

  /**
   * Get models for a specific backend
   */
  getModelsForBackend(backend: LLMBackendType): LLMModelConfig[] {
    return this.getAllModels().filter((m) => m.backend === backend);
  }

  /**
   * Get models for a specific backend, filtered for current device
   */
  async getModelsForBackendAndDevice(backend: LLMBackendType): Promise<LLMModelConfig[]> {
    const deviceType = await this.getDeviceType();
    return this.getAllModels().filter(
      (m) =>
        m.backend === backend &&
        (m.deviceCompatibility === "all" || m.deviceCompatibility === deviceType)
    );
  }

  /**
   * Get model configuration by ID
   */
  getModelConfig(modelId: LLMModelId): LLMModelConfig {
    const config = MODEL_CONFIGS[modelId];
    if (!config) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    return config;
  }

  /**
   * Download LLM model to device storage with progress tracking
   *
   * @param modelId - Model to download
   * @param onProgress - Callback for download progress updates
   * @returns Path to downloaded model file
   */
  async downloadModel(
    modelId: LLMModelId,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<string> {
    const config = this.getModelConfig(modelId);
    const modelFile = this.getModelFile(modelId);

    // Check if authentication is required
    if (config.requiresAuth && !this.authService.isAuthenticated()) {
      throw new Error(
        `Model "${config.name}" requires HuggingFace authentication. Please log in first.`
      );
    }

    console.log("[LLMModelService] Starting download:", {
      model: modelId,
      url: config.downloadUrl,
      path: modelFile.uri,
      requiresAuth: config.requiresAuth,
    });

    try {
      // Build headers with auth if needed
      const headers: Record<string, string> = {
        "User-Agent": "Pensieve-App/1.0",
      };

      if (config.requiresAuth) {
        const authHeaders = this.authService.getAuthHeader();
        const token = this.authService.getAccessToken();
        console.log("[LLMModelService] Using authenticated download, token:", token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : '(none)');
        Object.assign(headers, authHeaders);
      }

      console.log("[LLMModelService] Fetching with headers:", Object.keys(headers));

      const response = await fetch(config.downloadUrl, {
        headers,
      });

      console.log("[LLMModelService] Response status:", response.status, response.statusText);

      if (!response.ok) {
        // Try to get error body
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.error("[LLMModelService] Error response body:", errorBody.substring(0, 500));
        } catch (e) {
          // ignore
        }
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`,
        );
      }

      const contentLength = response.headers.get("content-length");
      const totalBytes = contentLength
        ? parseInt(contentLength, 10)
        : config.expectedSize;

      console.log("[LLMModelService] Content-Length:", totalBytes);

      if (!response.body) {
        throw new Error("Response body is null");
      }

      // Read stream with progress tracking
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        chunks.push(value);
        receivedBytes += value.length;

        // Report progress
        if (onProgress) {
          const progress = receivedBytes / totalBytes;
          onProgress({
            totalBytesWritten: receivedBytes,
            totalBytesExpectedToWrite: totalBytes,
            progress: Math.min(progress, 1),
          });

          // Log progress every ~10%
          if (
            Math.floor(progress * 10) !==
            Math.floor(((receivedBytes - value.length) / totalBytes) * 10)
          ) {
            console.log("[LLMModelService] Progress:", {
              written: receivedBytes,
              total: totalBytes,
              percent: Math.round(progress * 100),
            });
          }
        }
      }

      // Combine chunks into single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const fileData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fileData.set(chunk, offset);
        offset += chunk.length;
      }

      // Write to file
      await modelFile.write(fileData);

      console.log("[LLMModelService] Download completed:", modelFile.uri);

      return modelFile.uri;
    } catch (error) {
      console.error("[LLMModelService] Download failed:", error);
      throw new Error(
        `Failed to download ${config.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Download model with automatic retry and exponential backoff
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: After 5 seconds
   * - Attempt 3: After 30 seconds
   * - Attempt 4: After 5 minutes
   */
  async downloadModelWithRetry(
    modelId: LLMModelId,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<string> {
    const retryDelays = [5000, 30000, 5 * 60 * 1000];
    let lastError: Error | null = null;

    // Initial attempt
    try {
      return await this.downloadModel(modelId, onProgress);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");
      console.error("[LLMModelService] Initial download failed:", lastError.message);
    }

    // Retry attempts
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      const delay = retryDelays[attempt];

      console.log(`[LLMModelService] Retry attempt ${attempt + 1}/${retryDelays.length} in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        return await this.downloadModel(modelId, onProgress);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        console.error(`[LLMModelService] Retry ${attempt + 1} failed:`, lastError.message);
      }
    }

    throw lastError!;
  }

  /**
   * Check if a model is already downloaded
   */
  async isModelDownloaded(modelId: LLMModelId): Promise<boolean> {
    const modelFile = this.getModelFile(modelId);
    return modelFile.exists;
  }

  /**
   * Get the File instance for a model
   */
  private getModelFile(modelId: LLMModelId): File {
    const config = this.getModelConfig(modelId);
    return new File(Paths.document, config.filename);
  }

  /**
   * Get the local file path for a model
   */
  getModelPath(modelId: LLMModelId): string {
    return this.getModelFile(modelId).uri;
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelId: LLMModelId): Promise<void> {
    const modelFile = this.getModelFile(modelId);
    try {
      if (modelFile.exists) {
        await modelFile.delete();
        console.log("[LLMModelService] Model deleted:", modelId);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete ${modelId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Get expected model size in bytes
   */
  getExpectedSize(modelId: LLMModelId): number {
    return this.getModelConfig(modelId).expectedSize;
  }

  /**
   * Get the currently selected model for post-processing
   * @deprecated Use getModelForTask('postProcessing') instead
   */
  async getSelectedModel(): Promise<LLMModelId | null> {
    return this.getModelForTask('postProcessing');
  }

  /**
   * Set the selected model for post-processing
   * @deprecated Use setModelForTask('postProcessing', modelId) instead
   */
  async setSelectedModel(modelId: LLMModelId): Promise<void> {
    await this.setModelForTask('postProcessing', modelId);
  }

  /**
   * Get the selected model for a specific task
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @returns The selected model ID, or null if none selected
   */
  async getModelForTask(task: LLMTask): Promise<LLMModelId | null> {
    try {
      const storageKey = TASK_MODEL_KEYS[task];
      const selected = await AsyncStorage.getItem(storageKey);

      if (selected && MODEL_CONFIGS[selected as LLMModelId]) {
        return selected as LLMModelId;
      }

      // Migration: if no task-specific model, check legacy key for postProcessing
      if (task === 'postProcessing') {
        const legacySelected = await AsyncStorage.getItem(SELECTED_MODEL_KEY);
        if (legacySelected && MODEL_CONFIGS[legacySelected as LLMModelId]) {
          // Migrate to new key
          await AsyncStorage.setItem(storageKey, legacySelected);
          console.log(`[LLMModelService] Migrated legacy selection to ${task}:`, legacySelected);
          return legacySelected as LLMModelId;
        }
      }

      return null;
    } catch (error) {
      console.error(`[LLMModelService] Failed to get model for ${task}:`, error);
      return null;
    }
  }

  /**
   * Set the selected model for a specific task
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @param modelId - The model ID to select
   */
  async setModelForTask(task: LLMTask, modelId: LLMModelId): Promise<void> {
    try {
      const storageKey = TASK_MODEL_KEYS[task];
      await AsyncStorage.setItem(storageKey, modelId);
      console.log(`[LLMModelService] Model for ${task} set to:`, modelId);
    } catch (error) {
      console.error(`[LLMModelService] Failed to set model for ${task}:`, error);
      throw error;
    }
  }

  /**
   * Get all task-specific model selections
   *
   * @returns Map of task to selected model ID (or null)
   */
  async getAllTaskModelSelections(): Promise<Record<LLMTask, LLMModelId | null>> {
    const postProcessing = await this.getModelForTask('postProcessing');
    const analysis = await this.getModelForTask('analysis');
    return { postProcessing, analysis };
  }

  /**
   * Check if post-processing is enabled
   */
  async isPostProcessingEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(POSTPROCESSING_ENABLED_KEY);
      return enabled === "true";
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable post-processing
   */
  async setPostProcessingEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(POSTPROCESSING_ENABLED_KEY, String(enabled));
    console.log("[LLMModelService] Post-processing enabled:", enabled);
  }

  /**
   * Check if automatic post-processing after transcription is enabled
   * When disabled, transcripts are saved as-is (raw_transcript = normalizedText)
   * This allows LLM models to be unloaded after transcription queue is done
   */
  async isAutoPostProcessEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(AUTO_POSTPROCESS_KEY);
      // Default to false (no automatic post-processing)
      return enabled === "true";
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable automatic post-processing after transcription
   */
  async setAutoPostProcessEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(AUTO_POSTPROCESS_KEY, String(enabled));
    console.log("[LLMModelService] Auto post-process transcription:", enabled);
  }

  /**
   * Get the best available model for post-processing
   *
   * Priority:
   * 1. User-selected model (if downloaded and compatible)
   * 2. Best downloaded model for current device and backend
   * 3. null (no model available)
   *
   * @param preferredBackend - Preferred backend (for TPU detection)
   * @deprecated Use getBestAvailableModelForTask('postProcessing', preferredBackend) instead
   */
  async getBestAvailableModel(
    preferredBackend?: LLMBackendType,
  ): Promise<LLMModelId | null> {
    return this.getBestAvailableModelForTask('postProcessing', preferredBackend);
  }

  /**
   * Get the best available model for a specific task
   *
   * Priority:
   * 1. User-selected model for this task (if downloaded and compatible)
   * 2. Best downloaded model for current device and backend
   * 3. null (no model available)
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @param preferredBackend - Preferred backend (for TPU detection)
   */
  async getBestAvailableModelForTask(
    task: LLMTask,
    preferredBackend?: LLMBackendType,
  ): Promise<LLMModelId | null> {
    const deviceType = await this.getDeviceType();

    // First check user preference for this task
    const selected = await this.getModelForTask(task);
    if (selected && (await this.isModelDownloaded(selected))) {
      const config = this.getModelConfig(selected);
      // Only return if backend matches preference (if specified)
      if (!preferredBackend || config.backend === preferredBackend) {
        return selected;
      }
    }

    // Get models for preferred backend, filtered by device compatibility
    const models = preferredBackend
      ? await this.getModelsForBackendAndDevice(preferredBackend)
      : await this.getModelsForCurrentDevice();

    // Sort: device-specific first, then recommended, then by size
    const sortedModels = [...models].sort((a, b) => {
      // Device-specific models first
      const aDeviceSpecific = a.deviceCompatibility === deviceType ? 1 : 0;
      const bDeviceSpecific = b.deviceCompatibility === deviceType ? 1 : 0;
      if (aDeviceSpecific !== bDeviceSpecific) {
        return bDeviceSpecific - aDeviceSpecific;
      }

      // Then recommended models
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;

      // Then by size (smaller first)
      return a.expectedSize - b.expectedSize;
    });

    for (const model of sortedModels) {
      if (await this.isModelDownloaded(model.id)) {
        return model.id;
      }
    }

    return null;
  }

  /**
   * Get all downloaded models
   */
  async getDownloadedModels(): Promise<LLMModelConfig[]> {
    const downloaded: LLMModelConfig[] = [];
    for (const model of this.getAllModels()) {
      if (await this.isModelDownloaded(model.id)) {
        downloaded.push(model);
      }
    }
    return downloaded;
  }
}
