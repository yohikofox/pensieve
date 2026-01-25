/**
 * MediaPipeBackend - LLM inference using MediaPipe LLM Inference API
 *
 * Uses Google's MediaPipe for optimized inference on Tensor TPU (Pixel 6+).
 * This backend is preferred when a compatible TPU is detected.
 *
 * Supported models:
 * - Gemma 3n 2B (~1.5GB) - Optimized for Tensor TPU
 *
 * Requirements:
 * - react-native-llm-mediapipe package
 * - Google Pixel 6 or newer with Tensor chip
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import {
  type IPostProcessingBackend,
  type PostProcessingResult,
  debugPromptManager,
} from './IPostProcessingBackend';
import { TPUDetectionService } from '../TPUDetectionService';

// MediaPipe types (will be available after npm install)
interface LlmInference {
  generateResponse: (prompt: string) => Promise<string>;
  generateResponseAsync: (
    prompt: string,
    onPartialResponse: (partial: string) => void
  ) => Promise<string>;
  close: () => Promise<void>;
}

interface MediaPipeModule {
  createLlmInference: (options: {
    modelPath: string;
    maxTokens?: number;
    topK?: number;
    temperature?: number;
    randomSeed?: number;
  }) => Promise<LlmInference>;
}

// Dynamic import to handle cases where the package isn't installed yet
let mediapipeModule: MediaPipeModule | null = null;

async function getMediaPipeModule(): Promise<MediaPipeModule> {
  if (mediapipeModule) {
    return mediapipeModule;
  }

  try {
    // @ts-ignore - Dynamic import
    mediapipeModule = await import('react-native-llm-mediapipe');
    return mediapipeModule;
  } catch (error) {
    console.error('[MediaPipeBackend] Failed to import mediapipe:', error);
    throw new Error(
      'react-native-llm-mediapipe is not installed. Run: npm install react-native-llm-mediapipe'
    );
  }
}

@injectable()
export class MediaPipeBackend implements IPostProcessingBackend {
  readonly name = 'mediapipe' as const;

  private inference: LlmInference | null = null;
  private modelPath: string | null = null;
  private isInitialized: boolean = false;
  private tpuDetection: TPUDetectionService;

  constructor() {
    this.tpuDetection = new TPUDetectionService();
  }

  /**
   * Initialize the backend
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Check if TPU is available
      const hasTpu = await this.tpuDetection.hasTpu();
      if (!hasTpu) {
        console.log('[MediaPipeBackend] No TPU detected, backend not available');
        return false;
      }

      // Verify module is available
      await getMediaPipeModule();
      this.isInitialized = true;
      console.log('[MediaPipeBackend] Initialized');
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
      // Check TPU first
      const hasTpu = await this.tpuDetection.hasTpu();
      if (!hasTpu) {
        return false;
      }

      // Then check if module is available
      await getMediaPipeModule();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(): boolean {
    return this.inference !== null;
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
      if (this.inference) {
        await this.unloadModel();
      }

      const mediapipe = await getMediaPipeModule();

      console.log('[MediaPipeBackend] Loading model:', modelPath);

      this.inference = await mediapipe.createLlmInference({
        modelPath,
        maxTokens: 512,
        topK: 40,
        temperature: 0.1, // Low temperature for deterministic output
        randomSeed: 42,
      });

      this.modelPath = modelPath;

      console.log('[MediaPipeBackend] Model loaded successfully');
      return true;
    } catch (error) {
      console.error('[MediaPipeBackend] Failed to load model:', error);
      this.inference = null;
      this.modelPath = null;
      return false;
    }
  }

  /**
   * Unload the current model from memory
   */
  async unloadModel(): Promise<void> {
    if (this.inference) {
      try {
        await this.inference.close();
        console.log('[MediaPipeBackend] Model unloaded');
      } catch (error) {
        console.error('[MediaPipeBackend] Error unloading model:', error);
      }
      this.inference = null;
      this.modelPath = null;
    }
  }

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text
   */
  async process(text: string): Promise<PostProcessingResult> {
    if (!this.inference) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    // Build the prompt
    const prompt = this.buildPrompt(text);

    console.log('[MediaPipeBackend] Processing text:', text.substring(0, 50) + '...');

    try {
      const result = await this.inference.generateResponse(prompt);
      const processingDuration = Date.now() - startTime;

      // Clean up the result
      let processedText = result.trim();

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
   * Build the prompt for Gemma models
   * Uses Gemma's conversation format
   */
  private buildPrompt(text: string): string {
    return `<start_of_turn>user
${this.getSystemPrompt()}

${text}<end_of_turn>
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
    return this.tpuDetection.getTPUDescription();
  }
}
