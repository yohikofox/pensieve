/**
 * IPostProcessingBackend - Interface for LLM post-processing backends
 *
 * Defines the contract for text post-processing implementations.
 * Each backend (MediaPipe/TPU, llama.rn) implements this interface.
 *
 * Responsibilities:
 * - Process transcription text to improve quality
 * - Add punctuation, fix grammar, normalize capitalization
 * - Report backend status (initialized, model loaded)
 */

export interface PostProcessingResult {
  /** The processed/normalized text */
  text: string;
  /** Processing duration in milliseconds */
  processingDuration: number;
  /** Backend that processed the text */
  backend: 'mediapipe' | 'llamarn';
  /** Model used for processing */
  model: string;
}

export interface IPostProcessingBackend {
  /**
   * Backend identifier
   */
  readonly name: 'mediapipe' | 'llamarn';

  /**
   * Initialize the backend
   * Called once before first use
   *
   * @returns true if initialization successful
   */
  initialize(): Promise<boolean>;

  /**
   * Check if backend is available on this device
   * For MediaPipe: checks for TPU
   * For llama.rn: always available (fallback)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(): boolean;

  /**
   * Load a model for processing
   *
   * @param modelPath - Path to the model file
   * @param promptTemplate - Optional chat template format for the model
   * @returns true if model loaded successfully
   */
  loadModel(modelPath: string, promptTemplate?: string): Promise<boolean>;

  /**
   * Unload the current model from memory
   */
  unloadModel(): Promise<void>;

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text from Whisper
   * @returns Processed text with improved quality
   */
  process(text: string): Promise<PostProcessingResult>;

  /**
   * Get the system prompt used for post-processing
   */
  getSystemPrompt(): string;

  /**
   * Release all resources
   */
  dispose(): Promise<void>;
}

/**
 * Default system prompt for text normalization
 * Shared by all backends
 */
export const DEFAULT_POSTPROCESSING_PROMPT = `Corrige la ponctuation et capitalisation du texte suivant. Réponds UNIQUEMENT avec le texte corrigé, RIEN d'autre. Pas de commentaire, pas d'introduction, pas d'explication.

Texte:`;

/**
 * Debug Prompt Manager - In-memory storage for custom prompts (debug mode only)
 *
 * This allows testing different prompts without persisting them.
 * The custom prompt is lost when the app is restarted.
 */
class DebugPromptManager {
  private customPrompt: string | null = null;

  /**
   * Set a custom prompt for testing (in-memory only)
   */
  setCustomPrompt(prompt: string): void {
    this.customPrompt = prompt;
    console.log('[DebugPromptManager] Custom prompt set (in-memory)');
  }

  /**
   * Get the current prompt (custom if set, otherwise default)
   */
  getPrompt(): string {
    return this.customPrompt ?? DEFAULT_POSTPROCESSING_PROMPT;
  }

  /**
   * Check if a custom prompt is currently active
   */
  hasCustomPrompt(): boolean {
    return this.customPrompt !== null;
  }

  /**
   * Reset to default prompt
   */
  resetToDefault(): void {
    this.customPrompt = null;
    console.log('[DebugPromptManager] Reset to default prompt');
  }

  /**
   * Get the original default prompt (for display/comparison)
   */
  getDefaultPrompt(): string {
    return DEFAULT_POSTPROCESSING_PROMPT;
  }
}

// Singleton instance
export const debugPromptManager = new DebugPromptManager();
