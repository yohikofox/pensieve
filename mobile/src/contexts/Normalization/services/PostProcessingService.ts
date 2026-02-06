/**
 * PostProcessingService - Orchestrator for LLM text post-processing
 *
 * Architecture:
 * - Selects appropriate backend (MediaPipe for TPU, llama.rn for GPU/CPU)
 * - Manages model loading and unloading
 * - Provides unified interface for TranscriptionWorker
 *
 * Flow:
 * 1. Check if post-processing is enabled
 * 2. Detect device capabilities (TPU vs GPU/CPU)
 * 3. Select and initialize appropriate backend
 * 4. Load the configured model
 * 5. Process text and return improved version
 */

import 'reflect-metadata';
import { inject, injectable } from 'tsyringe';
import { type IPostProcessingBackend, type PostProcessingResult } from './postprocessing/IPostProcessingBackend';
import { LlamaRnBackend } from './postprocessing/LlamaRnBackend';
import { MediaPipeBackend } from './postprocessing/MediaPipeBackend';
import type { ILLMModelService, LLMModelId, LLMBackendType } from '../domain/ILLMModelService';
import { NPUDetectionService, type NPUInfo } from './NPUDetectionService';
import { TOKENS } from '../../../infrastructure/di/tokens';

export interface PostProcessingConfig {
  /** Whether post-processing is enabled */
  enabled: boolean;
  /** Selected model ID */
  modelId: LLMModelId | null;
  /** Detected backend type */
  backendType: LLMBackendType;
  /** NPU information */
  npuInfo: NPUInfo;
}

@injectable()
export class PostProcessingService {
  private backend: IPostProcessingBackend | null = null;
  private currentModelId: LLMModelId | null = null;
  private isReady: boolean = false;

  constructor(
    @inject(TOKENS.ILLMModelService) private modelService: ILLMModelService,
    @inject(NPUDetectionService) private npuDetection: NPUDetectionService
  ) {}

  /**
   * Check if post-processing is enabled and configured
   */
  async isEnabled(): Promise<boolean> {
    const enabled = await this.modelService.isPostProcessingEnabled();
    if (!enabled) {
      return false;
    }

    // Check if a model is available
    const model = await this.modelService.getBestAvailableModel();
    return model !== null;
  }

  /**
   * Check if automatic post-processing after transcription is enabled
   * When disabled, transcripts are saved as-is without LLM processing
   */
  async isAutoPostProcessEnabled(): Promise<boolean> {
    return this.modelService.isAutoPostProcessEnabled();
  }

  /**
   * Get current configuration status
   */
  async getConfig(): Promise<PostProcessingConfig> {
    const enabled = await this.modelService.isPostProcessingEnabled();
    const modelId = await this.modelService.getSelectedModel();
    const npuInfo = await this.npuDetection.detectNPU();
    const preferredBackend = await this.npuDetection.getPreferredBackend();

    return {
      enabled,
      modelId,
      backendType: preferredBackend === 'mediapipe' ? 'mediapipe' : 'llamarn',
      npuInfo,
    };
  }

  /**
   * Initialize the service and prepare for processing
   *
   * Priority:
   * 1. Use the user's selected model (if available)
   * 2. Fall back to device-preferred backend if no selection
   *
   * @returns true if ready to process
   */
  async initialize(): Promise<boolean> {
    // Check if the model has changed
    const modelChanged = await this.hasModelChanged();

    if (this.isReady && !modelChanged) {
      console.log('[PostProcessingService] ✓ Already ready, no model change');
      return true; // OK - same model
    }

    if (modelChanged && this.isReady) {
      console.log('[PostProcessingService] 🔄 Model changed, reloading...');
      await this.dispose(); // CRITICAL: Cleanup old backend
      this.isReady = false;
      this.backend = null;
      this.currentModelId = null;
    }

    try {
      // Detect NPU capabilities
      const npuInfo = await this.npuDetection.detectNPU();

      // Check user's selected model first
      const selectedModelId = await this.modelService.getSelectedModel();
      let targetBackend: LLMBackendType | null = null;
      let targetModelId: LLMModelId | null = null;

      if (selectedModelId && await this.modelService.isModelDownloaded(selectedModelId)) {
        // Use the user's selected model
        const selectedConfig = this.modelService.getModelConfig(selectedModelId);
        targetBackend = selectedConfig.backend;
        targetModelId = selectedModelId;
        console.log('[PostProcessingService] Using user-selected model:', selectedModelId, 'backend:', targetBackend);
      } else {
        // Fall back to best available model
        targetModelId = await this.modelService.getBestAvailableModel();
        if (targetModelId) {
          targetBackend = this.modelService.getModelConfig(targetModelId).backend;
          console.log('[PostProcessingService] Using best available model:', targetModelId, 'backend:', targetBackend);
        }
      }

      if (!targetModelId || !targetBackend) {
        console.warn('[PostProcessingService] No model available');
        return false;
      }

      let modelConfig = this.modelService.getModelConfig(targetModelId);
      console.log('[PostProcessingService] 🚀 Initializing:', {
        modelId: targetModelId,
        modelName: modelConfig.name,
        backend: targetBackend,
        npuType: npuInfo.type,
        manufacturer: npuInfo.manufacturer,
        generation: npuInfo.generation,
        timestamp: new Date().toISOString(),
      });

      // Initialize the appropriate backend for the selected model
      if (targetBackend === 'mediapipe') {
        const mediapipe = new MediaPipeBackend();
        if (await mediapipe.initialize()) {
          this.backend = mediapipe;
          console.log('[PostProcessingService] Using MediaPipe backend (Tensor TPU)');
        } else {
          // MediaPipe failed - fall back to llama.rn with a GGUF model
          console.warn('[PostProcessingService] MediaPipe unavailable, falling back to llama.rn');
          targetBackend = 'llamarn';
          targetModelId = await this.modelService.getBestAvailableModel('llamarn');
          if (!targetModelId) {
            console.error('[PostProcessingService] No llama.rn model available for fallback');
            return false;
          }
          console.log('[PostProcessingService] Fallback to llama.rn model:', targetModelId);
          // Update modelConfig for the new fallback model
          modelConfig = this.modelService.getModelConfig(targetModelId);
        }
      }

      // If backend not yet set (llamarn selected or mediapipe fallback)
      if (!this.backend) {
        // For llamarn backend
        const llamarn = new LlamaRnBackend();
        if (await llamarn.initialize()) {
          this.backend = llamarn;
          const backendDesc = npuInfo.type === 'neural-engine'
            ? 'llama.rn (Apple Neural Engine)'
            : npuInfo.type === 'tensor-tpu'
              ? 'llama.rn (Tensor GPU)'
              : npuInfo.type === 'samsung-npu'
                ? 'llama.rn (Samsung NPU)'
                : 'llama.rn (GPU/CPU)';
          console.log(`[PostProcessingService] Using ${backendDesc}`);
        } else {
          console.error('[PostProcessingService] LlamaRn initialization failed');
          return false;
        }
      }

      // Load the model
      const modelPath = this.modelService.getModelPath(targetModelId);
      const loaded = await this.backend.loadModel(modelPath, modelConfig.promptTemplate);

      if (loaded) {
        this.currentModelId = targetModelId;
        this.isReady = true;
        console.log('[PostProcessingService] Ready with model:', targetModelId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[PostProcessingService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Get the best model for the current backend
   */
  private async getBestModelForBackend(): Promise<LLMModelId | null> {
    if (!this.backend) {
      return null;
    }

    const backendType = this.backend.name;
    return this.modelService.getBestAvailableModel(backendType);
  }

  /**
   * Get the human-readable name of the current model
   */
  private getModelName(): string {
    if (!this.currentModelId) {
      return 'unknown';
    }
    const config = this.modelService.getModelConfig(this.currentModelId);
    return config?.name || this.currentModelId;
  }

  /**
   * Check if the selected model has changed
   */
  private async hasModelChanged(): Promise<boolean> {
    const selectedModel = await this.modelService.getSelectedModel();
    return selectedModel !== this.currentModelId;
  }

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text from Whisper
   * @returns Improved text, or original if processing fails
   */
  async process(text: string): Promise<string> {
    // Skip empty or very short text
    if (!text || text.trim().length < 5) {
      return text;
    }

    // Initialize if needed
    if (!this.isReady) {
      const initialized = await this.initialize();
      if (!initialized) {
        console.warn('[PostProcessingService] Cannot process - not initialized');
        return text; // Return original text as fallback
      }
    }

    try {
      const result = await this.backend!.process(text);

      console.log('[PostProcessingService] ✨ Processing:', {
        modelId: this.currentModelId,
        modelName: this.getModelName(),
        backend: result.backend,
        duration: result.processingDuration,
        inputLen: text.length,
        outputLen: result.text.length,
        timestamp: new Date().toISOString(),
      });

      return result.text;
    } catch (error) {
      console.error('[PostProcessingService] Processing failed:', error);
      // Return original text on error (graceful degradation)
      return text;
    }
  }

  /**
   * Process text with full result details
   *
   * @param text - Raw transcription text
   * @returns Full processing result
   */
  async processWithDetails(text: string): Promise<PostProcessingResult | null> {
    if (!text || text.trim().length < 5) {
      return null;
    }

    if (!this.isReady) {
      const initialized = await this.initialize();
      if (!initialized) {
        return null;
      }
    }

    try {
      return await this.backend!.process(text);
    } catch (error) {
      console.error('[PostProcessingService] Processing failed:', error);
      return null;
    }
  }

  /**
   * Reload the model (useful when user changes model selection)
   * Does a complete cleanup and reinitialization
   */
  async reloadModel(): Promise<boolean> {
    console.log('[PostProcessingService] 🔄 Reloading model...');

    try {
      // Complete cleanup
      await this.dispose();
      this.isReady = false;
      this.backend = null;
      this.currentModelId = null;

      // Complete reinitialization
      return await this.initialize();
    } catch (error) {
      console.error('[PostProcessingService] Model reload failed:', error);
      return false;
    }
  }

  /**
   * Get current backend name
   */
  getBackendName(): 'mediapipe' | 'llamarn' | null {
    return this.backend?.name || null;
  }

  /**
   * Get current model ID
   */
  getCurrentModelId(): LLMModelId | null {
    return this.currentModelId;
  }

  /**
   * Check if service is ready
   */
  getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    console.log('[PostProcessingService] 🧹 Disposing resources...');

    if (this.backend) {
      try {
        await this.backend.dispose(); // Release native resources
        console.log('[PostProcessingService] ✓ Backend disposed');
      } catch (error) {
        console.error('[PostProcessingService] Error disposing backend:', error);
      }
      this.backend = null;
    }

    this.currentModelId = null;
    this.isReady = false;

    console.log('[PostProcessingService] ✓ Disposed successfully');
  }
}
