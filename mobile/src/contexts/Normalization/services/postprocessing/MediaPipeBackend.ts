/**
 * MediaPipeBackend - LLM inference using MediaPipe LLM Inference API
 *
 * Uses Google's MediaPipe for optimized inference with GPU acceleration.
 * This backend is preferred when a compatible TPU/GPU is detected (Pixel 6+).
 *
 * Supported models:
 * - Gemma 3 1B (.task format) - GPU accelerated
 *
 * Requirements:
 * - expo-llm-mediapipe package (SDK 0.10.22)
 * - Google Pixel 6 or newer with Tensor chip
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import {
  type IPostProcessingBackend,
  type PostProcessingResult,
  debugPromptManager,
} from './IPostProcessingBackend';
import { NPUDetectionService } from '../NPUDetectionService';

import { requireNativeModule } from 'expo-modules-core';

// MediaPipe LLM Inference native module interface (expo-llm-mediapipe)
interface ExpoLlmMediapipeModule {
  createModel: (
    modelPath: string,
    maxTokens: number,
    topK: number,
    temperature: number,
    randomSeed: number
  ) => Promise<number>;
  createModelFromDownloaded: (
    modelName: string,
    maxTokens: number,
    topK: number,
    temperature: number,
    randomSeed: number
  ) => Promise<number>;
  generateResponse: (
    handle: number,
    requestId: number,
    prompt: string
  ) => Promise<string>;
  releaseModel: (handle: number) => Promise<void>;
}

// Cache the module reference
let cachedModule: ExpoLlmMediapipeModule | null = null;
let moduleCheckFailed = false;

function getExpoLlmMediapipeModule(): ExpoLlmMediapipeModule | null {
  if (moduleCheckFailed) {
    return null;
  }
  if (cachedModule) {
    return cachedModule;
  }
  try {
    cachedModule = requireNativeModule<ExpoLlmMediapipeModule>('ExpoLlmMediapipe');
    console.log('[MediaPipeBackend] ExpoLlmMediapipe module loaded successfully');
    return cachedModule;
  } catch (error) {
    console.warn('[MediaPipeBackend] ExpoLlmMediapipe module not available:', error);
    moduleCheckFailed = true;
    return null;
  }
}

@injectable()
export class MediaPipeBackend implements IPostProcessingBackend {
  readonly name = 'mediapipe' as const;

  private modelHandle: number | null = null;
  private modelPath: string | null = null;
  private isInitialized: boolean = false;
  private npuDetection: NPUDetectionService;
  private nextRequestId: number = 0;

  constructor() {
    this.npuDetection = new NPUDetectionService();
  }

  /**
   * Initialize the backend
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Check if NPU/TPU is available (specifically Google Tensor TPU)
      const npuInfo = await this.npuDetection.detectNPU();
      if (npuInfo.type !== 'tensor-tpu') {
        console.log('[MediaPipeBackend] No Tensor TPU detected, backend not available');
        return false;
      }

      // Verify native module is available
      const module = getExpoLlmMediapipeModule();
      if (!module) {
        console.log('[MediaPipeBackend] Native module not available');
        return false;
      }

      this.isInitialized = true;
      console.log('[MediaPipeBackend] Initialized with expo-llm-mediapipe (SDK 0.10.22)');
      return true;
    } catch (error) {
      console.error('[MediaPipeBackend] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if backend is available
   * Only available on Pixel devices with Tensor TPU
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check for Tensor TPU specifically
      const npuInfo = await this.npuDetection.detectNPU();
      if (npuInfo.type !== 'tensor-tpu') {
        return false;
      }

      // Check if native module is available
      return getExpoLlmMediapipeModule() !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(): boolean {
    return this.modelHandle !== null;
  }

  /**
   * Load a MediaPipe LLM model
   *
   * @param modelPath - Path to the .task model file
   * @param _promptTemplate - Ignored for MediaPipe (uses Gemma format internally)
   */
  async loadModel(modelPath: string, _promptTemplate?: string): Promise<boolean> {
    try {
      // Unload previous model if any
      if (this.modelHandle !== null) {
        await this.unloadModel();
      }

      const module = getExpoLlmMediapipeModule();
      if (!module) {
        throw new Error('MediaPipe native module not available');
      }

      console.log('[MediaPipeBackend] Loading model:', modelPath);

      // Remove file:// prefix if present (native module expects raw path)
      const cleanPath = modelPath.startsWith('file://')
        ? modelPath.substring(7)
        : modelPath;

      this.modelHandle = await module.createModel(
        cleanPath,
        2048,   // maxTokens (increased for longer transcripts)
        64,     // topK (Gemma 3 recommended: 64)
        1.0,    // temperature (Gemma 3 recommended: 1.0)
        42      // randomSeed
      );

      this.modelPath = modelPath;

      console.log('[MediaPipeBackend] Model loaded successfully, handle:', this.modelHandle);
      return true;
    } catch (error) {
      console.error('[MediaPipeBackend] Failed to load model:', error);
      this.modelHandle = null;
      this.modelPath = null;
      return false;
    }
  }

  /**
   * Unload the current model from memory
   */
  async unloadModel(): Promise<void> {
    if (this.modelHandle !== null) {
      try {
        const module = getExpoLlmMediapipeModule();
        if (module) {
          await module.releaseModel(this.modelHandle);
        }
        console.log('[MediaPipeBackend] Model unloaded');
      } catch (error) {
        console.error('[MediaPipeBackend] Error unloading model:', error);
      }
      this.modelHandle = null;
      this.modelPath = null;
    }
  }

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text
   */
  async process(text: string): Promise<PostProcessingResult> {
    if (this.modelHandle === null) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const module = getExpoLlmMediapipeModule();
    if (!module) {
      throw new Error('MediaPipe native module not available');
    }

    const startTime = Date.now();

    // Build the prompt
    const prompt = this.buildPrompt(text);

    console.log('[MediaPipeBackend] Processing text:', text.substring(0, 50) + '...');
    console.log('[MediaPipeBackend] Full prompt:', prompt);

    try {
      const requestId = this.nextRequestId++;
      const result = await module.generateResponse(this.modelHandle, requestId, prompt);
      const processingDuration = Date.now() - startTime;

      console.log('[MediaPipeBackend] Raw result:', JSON.stringify(result));
      console.log('[MediaPipeBackend] Result type:', typeof result, 'length:', result?.length);

      // Clean up the result
      let processedText = result?.trim() || '';

      // Remove any leading/trailing quotes
      if (processedText.startsWith('"') && processedText.endsWith('"')) {
        processedText = processedText.slice(1, -1);
      }

      // Remove any model-specific tokens that might leak through
      processedText = processedText
        .replace(/<end_of_turn>/g, '')
        .replace(/<start_of_turn>/g, '')
        .trim();

      console.log('[MediaPipeBackend] Processing completed:', {
        duration: processingDuration,
        inputLength: text.length,
        outputLength: processedText.length,
      });

      return {
        text: processedText,
        processingDuration,
        backend: 'mediapipe',
        model: this.modelPath || 'unknown',
      };
    } catch (error) {
      console.error('[MediaPipeBackend] Processing failed:', error);
      throw new Error(
        `MediaPipe processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build the prompt for Gemma 3 models
   * Uses Gemma's conversation format with proper turn markers
   */
  private buildPrompt(text: string): string {
    const systemPrompt = this.getSystemPrompt();
    // Gemma 3 format: user turn with instruction, then model turn for response
    return `<start_of_turn>user
${systemPrompt}

Input: ${text}<end_of_turn>
<start_of_turn>model
`;
  }

  /**
   * Get the system prompt
   * Uses custom prompt if set in debug mode, otherwise default
   */
  getSystemPrompt(): string {
    return debugPromptManager.getPrompt();
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    await this.unloadModel();
    this.isInitialized = false;
    console.log('[MediaPipeBackend] Disposed');
  }

  /**
   * Get TPU information (for UI display)
   */
  async getTPUInfo(): Promise<string> {
    return this.npuDetection.getNPUDescription();
  }
}
