/**
 * Web stub for expo-litert-lm
 * LiteRT-LM is Android-only — this stub prevents web/iOS build errors.
 */

export function isNativeModuleAvailable(): boolean {
  return false;
}

export async function nativeLoadModel(_modelPath: string): Promise<void> {
  throw new Error('LiteRT-LM is not available on this platform');
}

export async function nativeGenerate(_prompt: string): Promise<string> {
  throw new Error('LiteRT-LM is not available on this platform');
}

export async function nativeGenerateStream(_requestId: string, _prompt: string): Promise<void> {
  throw new Error('LiteRT-LM is not available on this platform');
}

export async function nativeUnloadModel(): Promise<void> {
  throw new Error('LiteRT-LM is not available on this platform');
}

export function nativeIsModelLoaded(): boolean {
  return false;
}

export function addTokenListener(_listener: unknown): { remove: () => void } {
  return { remove: () => {} };
}

export function addGenerationCompleteListener(_listener: unknown): { remove: () => void } {
  return { remove: () => {} };
}

export function addGenerationErrorListener(_listener: unknown): { remove: () => void } {
  return { remove: () => {} };
}
