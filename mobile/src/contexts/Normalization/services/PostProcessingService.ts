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
import { injectable } from 'tsyringe';
import { type IPostProcessingBackend, type PostProcessingResult } from './postprocessing/IPostProcessingBackend';
import { LlamaRnBackend } from './postprocessing/LlamaRnBackend';
import { MediaPipeBackend } from './postprocessing/MediaPipeBackend';
import { LLMModelService, type LLMModelId, type LLMBackendType } from './LLMModelService';
import { NPUDetectionService, type NPUInfo } from './NPUDetectionService';

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
    private modelService: LLMModelService,
    private npuDetection: NPUDetectionService
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
   * Selects the appropriate backend based on device capabilities:
   * - Google Pixel with TPU: MediaPipeBackend (Gemma 3n)
   * - Apple/Samsung/Others: LlamaRnBackend (GGUF models with GPU acceleration)
   *
   * @returns true if ready to process
   */
  async initialize(): Promise<boolean> {
    if (this.isReady) {
      return true;
    }

    try {
      // Detect NPU capabilities
      const npuInfo = await this.npuDetection.detectNPU();
      const preferredBackend = await this.npuDetection.getPreferredBackend();

      console.log('[PostProcessingService] Initializing with backend:', preferredBackend, {
        manufacturer: npuInfo.manufacturer,
        type: npuInfo.type,
        generation: npuInfo.generation,
      });

      // Try to initialize preferred backend
      if (preferredBackend === 'mediapipe') {
        // MediaPipe is only for Google Tensor TPU
        const mediapipe = new MediaPipeBackend();
        if (await mediapipe.initialize()) {
          this.backend = mediapipe;
          console.log('[PostProcessingService] Using MediaPipe backend (Tensor TPU)');
        } else {
          // Fallback to llama.rn
          console.log('[PostProcessingService] MediaPipe not available, falling back to llama.rn');
          const llamarn = new LlamaRnBackend();
          if (await llamarn.initialize()) {
            this.backend = llamarn;
          }
        }
      } else {
        // For Apple (CoreML via llama.rn), Samsung, and others
        const llamarn = new LlamaRnBackend();
        if (await llamarn.initialize()) {
          this.backend = llamarn;
          const backendDesc = npuInfo.type === 'neural-engine'
            ? 'llama.rn (Apple Neural Engine)'
            : npuInfo.type === 'samsung-npu'
              ? 'llama.rn (Samsung NPU)'
              : 'llama.rn (GPU/CPU)';
          console.log(`[PostProcessingService] Using ${backendDesc}`);
        }
      }

      if (!this.backend) {
        console.error('[PostProcessingService] No backend available');
        return false;
      }

      // Load the model
      const modelId = await this.getBestModelForBackend();
      if (!modelId) {
        console.warn('[PostProcessingService] No model available');
        return false;
      }

      const modelConfig = this.modelService.getModelConfig(modelId);
      const modelPath = this.modelService.getModelPath(modelId);
      const loaded = await this.backend.loadModel(modelPath, modelConfig.promptTemplate);

      if (loaded) {
        this.currentModelId = modelId;
        this.isReady = true;
        console.log('[PostProcessingService] Ready with model:', modelId);
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

      console.log('[PostProcessingService] Processing completed:', {
        backend: result.backend,
        duration: result.processingDuration,
        inputLen: text.length,
        outputLen: result.text.length,
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
   */
  async reloadModel(): Promise<boolean> {
    if (!this.backend) {
      return false;
    }

    try {
      // Unload current model
      await this.backend.unloadModel();
      this.currentModelId = null;
      this.isReady = false;

      // Load new model
      const modelId = await this.getBestModelForBackend();
      if (!modelId) {
        return false;
      }

      const modelConfig = this.modelService.getModelConfig(modelId);
      const modelPath = this.modelService.getModelPath(modelId);
      const loaded = await this.backend.loadModel(modelPath, modelConfig.promptTemplate);

      if (loaded) {
        this.currentModelId = modelId;
        this.isReady = true;
        return true;
      }

      return false;
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
    if (this.backend) {
      await this.backend.dispose();
      this.backend = null;
    }
    this.currentModelId = null;
    this.isReady = false;
    console.log('[PostProcessingService] Disposed');
  }
}
