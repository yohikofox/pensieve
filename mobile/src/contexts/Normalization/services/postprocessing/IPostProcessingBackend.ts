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
  backend: "mediapipe" | "llamarn";
  /** Model used for processing */
  model: string;
}

export interface IPostProcessingBackend {
  /**
   * Backend identifier
   */
  readonly name: "mediapipe" | "llamarn";

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
// export const DEFAULT_POSTPROCESSING_PROMPT = `Corrige la ponctuation et capitalisation du texte suivant. Réponds UNIQUEMENT avec le texte corrigé, RIEN d'autre. Pas de commentaire, pas d'introduction, pas d'explication.`;

export const POSTPROCESSING_USER_PROMPT = `
Texte à corriger :
"""{{TRANSCRIPT}}"""
`;

export const POSTPROCESSING_SYSTEM_PROMPT = `
Tu es un assistant spécialisé dans la correction de transcriptions vocales automatiques.

Objectif :
Transformer un texte transcrit automatiquement en un texte clair, correct et naturel,
sans modifier le sens ni ajouter d’informations.

Règles strictes :
- Corrige uniquement les erreurs évidentes de reconnaissance vocale
- Ajoute la ponctuation correcte
- Corrige la grammaire et l’orthographe
- Corrige la capitalisation (début de phrase, noms propres)
- Supprime les hésitations orales inutiles (ex: "euh", "bah")
- Ne reformule pas inutilement
- Ne rends pas le texte plus formel que nécessaire
- Ne change jamais le sens original
- Chaque mot doit rester identique sauf si une correction est strictement nécessaire

Noms propres :
- Ne modifie jamais un nom propre sauf si l’erreur est absolument évidente
- Ne corrige pas phonétiquement les noms propres
- Si un mot ressemble à un nom propre ou commence par une majuscule, conserve-le tel quel
- En cas de doute, conserve strictement le mot original

Langue :
- Utilise la même langue que le texte d’entrée

Sortie :
- Retourne uniquement le texte corrigé
- Aucune explication
- Aucun commentaire
`;
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
    console.log("[DebugPromptManager] Custom prompt set (in-memory)");
  }

  /**
   * Get the current prompt (custom if set, otherwise default)
   */
  getPrompt(): string {
    return this.customPrompt ?? this.getDefaultPrompt();
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
    console.log("[DebugPromptManager] Reset to default prompt");
  }

  /**
   * Get the original default prompt (for display/comparison)
   */
  getDefaultPrompt(): string {
    return POSTPROCESSING_SYSTEM_PROMPT + POSTPROCESSING_USER_PROMPT;
  }

  getEnrichedPrompt(text: string): string {
    const promptTemplate = this.getPrompt();
    return promptTemplate.replace("{{TRANSCRIPT}}", text);
  }
}

// Singleton instance
export const debugPromptManager = new DebugPromptManager();
