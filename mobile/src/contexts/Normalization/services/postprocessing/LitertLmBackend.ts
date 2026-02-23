/**
 * LitertLmBackend - LLM inference using Google LiteRT-LM runtime
 *
 * Uses the native LiteRT-LM engine for optimized inference on Android.
 * This backend is for .litertlm models (Gemma 3n format) on Pixel 6+ devices.
 *
 * Requirements:
 * - expo-litert-lm native module (Android only, registered via expo-module.config.json)
 * - Google Pixel 6 or newer with Tensor chip
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { Platform } from 'react-native';
import {
  type IPostProcessingBackend,
  type PostProcessingResult,
  debugPromptManager,
} from './IPostProcessingBackend';

import { requireNativeModule } from 'expo-modules-core';

// LiteRT-LM native module interface (expo-litert-lm)
interface ExpoLitertLmNative {
  loadModel(modelPath: string): Promise<void>;
  generate(prompt: string): Promise<string>;
  generateStream(requestId: string, prompt: string): Promise<void>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
}

// Cache the module reference
let cachedModule: ExpoLitertLmNative | null = null;
let moduleCheckFailed = false;

function getExpoLitertLmModule(): ExpoLitertLmNative | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  if (moduleCheckFailed) return null;
  if (cachedModule) return cachedModule;
  try {
    cachedModule = requireNativeModule<ExpoLitertLmNative>('ExpoLitertLmModule');
    console.log('[LitertLmBackend] ExpoLitertLmModule loaded successfully');
    return cachedModule;
  } catch (error) {
    console.warn('[LitertLmBackend] ExpoLitertLmModule not available:', error);
    moduleCheckFailed = true;
    return null;
  }
}

@injectable()
export class LitertLmBackend implements IPostProcessingBackend {
  readonly name = 'litert-lm' as const;

  private modelPath: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the backend
   * Only available on Android with the native module present
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (Platform.OS !== 'android') {
      console.log('[LitertLmBackend] LiteRT-LM is Android-only');
      return false;
    }

    const module = getExpoLitertLmModule();
    if (!module) {
      console.log('[LitertLmBackend] Native module not available');
      return false;
    }

    this.isInitialized = true;
    console.log('[LitertLmBackend] Initialized (expo-litert-lm)');
    return true;
  }

  /**
   * Check if backend is available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    return getExpoLitertLmModule() !== null;
  }

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(): boolean {
    const module = getExpoLitertLmModule();
    if (!module) return false;
    return module.isModelLoaded();
  }

  /**
   * Load a LiteRT-LM model
   *
   * @param modelPath - Path to the .litertlm model file
   * @param _promptTemplate - Ignored (Gemma format is always used)
   */
  async loadModel(modelPath: string, _promptTemplate?: string): Promise<boolean> {
    try {
      const module = getExpoLitertLmModule();
      if (!module) {
        throw new Error('LiteRT-LM native module not available');
      }

      // Unload previous model if any
      if (module.isModelLoaded()) {
        await this.unloadModel();
      }

      // Remove file:// prefix if present
      const cleanPath = modelPath.startsWith('file://')
        ? modelPath.substring(7)
        : modelPath;

      console.log('[LitertLmBackend] Loading model:', cleanPath);
      await module.loadModel(cleanPath);

      this.modelPath = modelPath;
      console.log('[LitertLmBackend] Model loaded successfully');
      return true;
    } catch (error) {
      console.error('[LitertLmBackend] Failed to load model:', error);
      this.modelPath = null;
      return false;
    }
  }

  /**
   * Unload the current model from memory
   */
  async unloadModel(): Promise<void> {
    try {
      const module = getExpoLitertLmModule();
      if (module) {
        await module.unloadModel();
      }
      console.log('[LitertLmBackend] Model unloaded');
    } catch (error) {
      console.error('[LitertLmBackend] Error unloading model:', error);
    }
    this.modelPath = null;
  }

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text from Whisper
   */
  async process(text: string): Promise<PostProcessingResult> {
    const module = getExpoLitertLmModule();
    if (!module || !module.isModelLoaded()) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const startTime = Date.now();
    const prompt = this.buildPrompt(text);

    console.log('[LitertLmBackend] Processing text:', {
      modelPath: this.modelPath,
      textPreview: text.substring(0, 50) + '...',
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await module.generate(prompt);
      const processingDuration = Date.now() - startTime;

      let processedText = result?.trim() || '';
      if (processedText.startsWith('"') && processedText.endsWith('"')) {
        processedText = processedText.slice(1, -1);
      }
      processedText = processedText
        .replace(/<end_of_turn>/g, '')
        .replace(/<start_of_turn>/g, '')
        .trim();

      console.log('[LitertLmBackend] Processing completed:', {
        duration: processingDuration,
        inputLength: text.length,
        outputLength: processedText.length,
      });

      return {
        text: processedText,
        processingDuration,
        backend: 'litert-lm',
        model: this.modelPath || 'unknown',
      };
    } catch (error) {
      console.error('[LitertLmBackend] Processing failed:', error);
      throw new Error(
        `LiteRT-LM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Process text with a custom system prompt (for analysis tasks)
   */
  async processWithCustomPrompt(systemPrompt: string, userText: string): Promise<PostProcessingResult> {
    const module = getExpoLitertLmModule();
    if (!module || !module.isModelLoaded()) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    // Gemma turn format
    const prompt = `<start_of_turn>user\n${systemPrompt}\n\n${userText}<end_of_turn>\n<start_of_turn>model\n`;

    try {
      const result = await module.generate(prompt);
      const processingDuration = Date.now() - startTime;

      let processedText = result?.trim() || '';
      if (processedText.startsWith('"') && processedText.endsWith('"')) {
        processedText = processedText.slice(1, -1);
      }
      processedText = processedText
        .replace(/<end_of_turn>/g, '')
        .replace(/<start_of_turn>/g, '')
        .trim();

      return {
        text: processedText,
        processingDuration,
        backend: 'litert-lm',
        model: this.modelPath || 'unknown',
      };
    } catch (error) {
      throw new Error(
        `LiteRT-LM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build the prompt for Gemma models using the conversation turn format
   */
  private buildPrompt(text: string): string {
    const enrichedPrompt = debugPromptManager.getEnrichedPrompt(text);
    return `<start_of_turn>user\n${enrichedPrompt}<end_of_turn>\n<start_of_turn>model\n`;
  }

  /**
   * Get the system prompt
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
    console.log('[LitertLmBackend] Disposed');
  }
}
