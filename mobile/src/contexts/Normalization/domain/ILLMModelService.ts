/**
 * LLM Model Service Interface
 *
 * Manages LLM model download, storage, and selection.
 * Supports multiple backends (llama.rn, MediaPipe) and device compatibility.
 *
 * Story: 3.1 - Post-Processing with LLM
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

import type { HuggingFaceAuthService } from '../services/HuggingFaceAuthService';
import type {
  LLMModelId,
  LLMModelConfig,
  PromptTemplate,
  DeviceCompatibility,
  LLMBackendType,
  LLMModelCategory,
} from '../services/llmModelsConfig';

/** LLM task types for task-specific model selection */
export type LLMTask = 'postProcessing' | 'analysis';

/** Download progress information */
export interface DownloadProgress {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
  progress: number; // 0-1
}

// Re-export types for external use
export type {
  LLMModelId,
  LLMModelConfig,
  PromptTemplate,
  DeviceCompatibility,
  LLMBackendType,
  LLMModelCategory,
};

/**
 * LLM Model Service
 *
 * Manages lifecycle of LLM models for post-processing and analysis tasks.
 *
 * Features:
 * - Multi-backend support (llama.rn GGUF, MediaPipe Gemma)
 * - Device-aware model recommendations (Apple NPU, Google Tensor)
 * - Resumable downloads with pause/cancel
 * - HuggingFace OAuth for gated models
 * - Task-specific model selection
 * - Crash recovery for interrupted downloads
 */
export interface ILLMModelService {
  /**
   * Initialize the service (auth and downloader config)
   */
  initialize(): Promise<void>;

  /**
   * Get the auth service instance
   * Used by UI components for login/logout flows
   */
  getAuthService(): HuggingFaceAuthService;

  /**
   * Check if a model requires authentication
   */
  modelRequiresAuth(modelId: LLMModelId): boolean;

  /**
   * Check if user can download a model (auth if needed)
   * @returns true if model is downloadable (no auth required or user is authenticated)
   */
  canDownloadModel(modelId: LLMModelId): boolean;

  // ========================================
  // Model Catalog
  // ========================================

  /**
   * Get all available model configurations
   */
  getAllModels(): LLMModelConfig[];

  /**
   * Detect current device type for model recommendations
   * Uses NPU detection for accurate compatibility
   * @returns 'apple' | 'google' | 'all'
   */
  getDeviceType(): Promise<DeviceCompatibility>;

  /**
   * Get models compatible with the current device
   * Returns models that match device type or are universal ('all')
   */
  getModelsForCurrentDevice(): Promise<LLMModelConfig[]>;

  /**
   * Get recommended models for current device
   * Prioritizes device-specific models, then recommended, then by size
   */
  getRecommendedModelsForDevice(): Promise<LLMModelConfig[]>;

  /**
   * Get models for a specific backend
   * @param backend - 'llama.rn' | 'mediapipe'
   */
  getModelsForBackend(backend: LLMBackendType): LLMModelConfig[];

  /**
   * Get models for a specific backend, filtered for current device
   * Models are enriched with download status
   */
  getModelsForBackendAndDevice(backend: LLMBackendType): Promise<LLMModelConfig[]>;

  /**
   * Get model configuration by ID
   * @throws Error if model ID is unknown
   */
  getModelConfig(modelId: LLMModelId): LLMModelConfig;

  // ========================================
  // Download Management
  // ========================================

  /**
   * Download LLM model with progress tracking
   *
   * Uses react-native-background-downloader for:
   * - Pause/Resume support with range requests
   * - Background download (continues when app is closed)
   * - Automatic recovery after interruption
   *
   * @param modelId - Model to download
   * @param onProgress - Callback for download progress updates
   * @returns Path to downloaded model file
   * @throws Error if model requires auth and user is not authenticated
   */
  downloadModel(
    modelId: LLMModelId,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string>;

  /**
   * Download model with automatic retry and exponential backoff
   *
   * Retry strategy:
   * - Attempt 1: Immediate
   * - Attempt 2: After 5 seconds
   * - Attempt 3: After 30 seconds
   * - Attempt 4: After 5 minutes
   *
   * @throws Error after all retries exhausted
   */
  downloadModelWithRetry(
    modelId: LLMModelId,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string>;

  /**
   * Pause an active download
   * @throws Error if no active download for model
   */
  pauseDownload(modelId: LLMModelId): Promise<void>;

  /**
   * Resume a paused download
   * @throws Error if no paused download for model
   */
  resumeDownload(modelId: LLMModelId): Promise<string>;

  /**
   * Cancel an active download and remove partial file
   */
  cancelDownload(modelId: LLMModelId): Promise<void>;

  /**
   * Get download status
   * @returns 'downloading' | 'paused' | null
   */
  getDownloadStatus(modelId: LLMModelId): 'downloading' | 'paused' | null;

  /**
   * Recover interrupted downloads after crash/app restart
   * Call this at app startup
   * @returns Array of recovered model IDs
   */
  recoverInterruptedDownloads(): Promise<LLMModelId[]>;

  // ========================================
  // Model Storage
  // ========================================

  /**
   * Check if a model is already downloaded
   */
  isModelDownloaded(modelId: LLMModelId): Promise<boolean>;

  /**
   * Get the local file path for a model
   */
  getModelPath(modelId: LLMModelId): string;

  /**
   * Delete a downloaded model
   * @throws Error if deletion fails
   */
  deleteModel(modelId: LLMModelId): Promise<void>;

  /**
   * Get expected model size in bytes
   */
  getExpectedSize(modelId: LLMModelId): number;

  /**
   * Get all downloaded models
   */
  getDownloadedModels(): Promise<LLMModelConfig[]>;

  // ========================================
  // Model Selection (Task-specific)
  // ========================================

  /**
   * Get the selected model for a specific task
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @returns The selected model ID, or null if none selected
   */
  getModelForTask(task: LLMTask): Promise<LLMModelId | null>;

  /**
   * Set the selected model for a specific task
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @param modelId - The model ID to select, or null to clear selection
   */
  setModelForTask(task: LLMTask, modelId: LLMModelId | null): Promise<void>;

  /**
   * Get all task-specific model selections
   * @returns Map of task to selected model ID (or null)
   */
  getAllTaskModelSelections(): Promise<Record<LLMTask, LLMModelId | null>>;

  /**
   * Get the best available model for a specific task
   *
   * Priority:
   * 1. User-selected model for this task (if downloaded and compatible)
   * 2. Best downloaded model for current device and backend
   * 3. null (no model available)
   *
   * @param task - The task type ('postProcessing' or 'analysis')
   * @param preferredBackend - Preferred backend (for NPU detection)
   */
  getBestAvailableModelForTask(
    task: LLMTask,
    preferredBackend?: LLMBackendType
  ): Promise<LLMModelId | null>;

  // ========================================
  // Legacy Methods (Deprecated)
  // ========================================

  /**
   * Get the currently selected model for post-processing
   * @deprecated Use getModelForTask('postProcessing') instead
   */
  getSelectedModel(): Promise<LLMModelId | null>;

  /**
   * Set the selected model for post-processing
   * @deprecated Use setModelForTask('postProcessing', modelId) instead
   */
  setSelectedModel(modelId: LLMModelId): Promise<void>;

  /**
   * Get the best available model for post-processing
   * @deprecated Use getBestAvailableModelForTask('postProcessing', preferredBackend) instead
   */
  getBestAvailableModel(preferredBackend?: LLMBackendType): Promise<LLMModelId | null>;

  // ========================================
  // Settings
  // ========================================

  /**
   * Check if post-processing is enabled
   */
  isPostProcessingEnabled(): Promise<boolean>;

  /**
   * Enable or disable post-processing
   */
  setPostProcessingEnabled(enabled: boolean): Promise<void>;

  /**
   * Check if automatic post-processing after transcription is enabled
   * When disabled, transcripts are saved as-is (raw_transcript = normalizedText)
   */
  isAutoPostProcessEnabled(): Promise<boolean>;

  /**
   * Enable or disable automatic post-processing after transcription
   */
  setAutoPostProcessEnabled(enabled: boolean): Promise<void>;
}
