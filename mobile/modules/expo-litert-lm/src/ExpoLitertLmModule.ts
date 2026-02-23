import { requireNativeModule } from 'expo-modules-core';
import type {
  TokenEventPayload,
  GenerationCompletePayload,
  GenerationErrorPayload,
} from './ExpoLitertLm.types';

// Native module interface — the module also exposes event listener methods
interface ExpoLitertLmNative {
  loadModel(modelPath: string): Promise<void>;
  generate(prompt: string): Promise<string>;
  generateStream(requestId: string, prompt: string): Promise<void>;
  unloadModel(): Promise<void>;
  isModelLoaded(): boolean;
  addListener(eventName: string, listener: (...args: any[]) => void): { remove: () => void };
  removeAllListeners(eventName: string): void;
}

// Cache native module reference
let cachedModule: ExpoLitertLmNative | null = null;
let moduleLoadFailed = false;

function getNativeModule(): ExpoLitertLmNative | null {
  if (moduleLoadFailed) return null;
  if (cachedModule) return cachedModule;
  try {
    cachedModule = requireNativeModule<ExpoLitertLmNative>('ExpoLitertLmModule');
    return cachedModule;
  } catch (error) {
    console.warn('[ExpoLitertLmModule] Native module not available:', error);
    moduleLoadFailed = true;
    return null;
  }
}

/**
 * Check if the native module is available on this device (Android only)
 */
export function isNativeModuleAvailable(): boolean {
  return getNativeModule() !== null;
}

/**
 * Load a LiteRT-LM model from the given path
 * This is a long-running operation (~10s). Resolves when the model is ready.
 *
 * @param modelPath - Absolute path to the .litertlm file (no file:// prefix)
 */
export async function nativeLoadModel(modelPath: string): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw new Error('LiteRT-LM native module not available');
  return mod.loadModel(modelPath);
}

/**
 * Generate a response for the given prompt (blocking)
 *
 * @param prompt - The prompt to generate from
 * @returns The full generated text
 */
export async function nativeGenerate(prompt: string): Promise<string> {
  const mod = getNativeModule();
  if (!mod) throw new Error('LiteRT-LM native module not available');
  return mod.generate(prompt);
}

/**
 * Generate a response with token streaming.
 * Resolves immediately; tokens are emitted via 'onToken' events.
 * Completion is signaled by 'onGenerationComplete' or 'onGenerationError'.
 *
 * @param requestId - Unique identifier for this request
 * @param prompt - The prompt to generate from
 */
export async function nativeGenerateStream(requestId: string, prompt: string): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw new Error('LiteRT-LM native module not available');
  return mod.generateStream(requestId, prompt);
}

/**
 * Unload the current model from memory
 */
export async function nativeUnloadModel(): Promise<void> {
  const mod = getNativeModule();
  if (!mod) throw new Error('LiteRT-LM native module not available');
  return mod.unloadModel();
}

/**
 * Check if a model is currently loaded (synchronous)
 */
export function nativeIsModelLoaded(): boolean {
  const mod = getNativeModule();
  if (!mod) return false;
  return mod.isModelLoaded();
}

/**
 * Subscribe to token events during streaming generation
 */
export function addTokenListener(
  listener: (event: TokenEventPayload) => void
): { remove: () => void } {
  const mod = getNativeModule();
  if (!mod) return { remove: () => {} };
  return mod.addListener('onToken', listener);
}

/**
 * Subscribe to generation completion events
 */
export function addGenerationCompleteListener(
  listener: (event: GenerationCompletePayload) => void
): { remove: () => void } {
  const mod = getNativeModule();
  if (!mod) return { remove: () => {} };
  return mod.addListener('onGenerationComplete', listener);
}

/**
 * Subscribe to generation error events
 */
export function addGenerationErrorListener(
  listener: (event: GenerationErrorPayload) => void
): { remove: () => void } {
  const mod = getNativeModule();
  if (!mod) return { remove: () => {} };
  return mod.addListener('onGenerationError', listener);
}
