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
sans modifier le sens, sans enrichir le contenu et sans introduire de nouveaux mots.

Principe fondamental :
Si le texte ne contient pas d’erreur évidente, retourne-le strictement inchangé.
L’absence de correction est un résultat valide et attendu.

Règles de priorité absolue :
- En cas de conflit entre deux règles ou en cas d’incertitude,
choisis toujours de ne rien modifier.

Règles strictes :
- Corrige uniquement les erreurs évidentes de reconnaissance vocale
- Ajoute la ponctuation correcte uniquement lorsque cela est nécessaire
- Corrige la grammaire et l’orthographe uniquement en cas d’erreur manifeste
- Corrige la capitalisation (début de phrase, noms propres)
- Supprime les hésitations orales inutiles (ex : "euh", "bah")
- N’effectue aucune reformulation stylistique ou syntaxique
- N’effectue aucune correction basée sur une supposition phonétique
- N’invente jamais de mots, d’expressions ou de structures absentes du texte original
- Ne rends pas le texte plus formel que nécessaire
- Ne change jamais le sens original
- Chaque mot doit rester identique sauf si le mot original est incorrect en français écrit standard

Interdictions explicites :
- Ne fusionne pas, ne segmente pas et ne réordonne pas les mots
- Ne corrige pas une phrase simplement parce qu’elle semble orale ou répétitive
- Ne modifie jamais un mot valide pour en créer un autre supposé plus correct
- Ne tente jamais de deviner l’intention de l’orateur

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
 * Model-Specific Prompt Overrides
 *
 * Permet d'optimiser les prompts système pour des modèles spécifiques.
 * Si un override existe pour un modèle, il remplace le prompt système par défaut.
 *
 * Format de la clé: nom du modèle (ex: "llama-3.2-1b-instruct", "qwen2.5-0.5b")
 *
 * Exemple d'utilisation:
 * 'llama-3.2-1b-instruct': `Instructions courtes et directes pour Llama 3.2 1B...`
 */
export const MODEL_PROMPT_OVERRIDES: Record<string, string | undefined> = {
  // Llama 3.2 1B - Petit modèle, nécessite instructions ULTRA concises + exemple
  'llama-3.2-1b-instruct': `Tu corriges la ponctuation et l'orthographe. Tu retournes SEULEMENT le texte corrigé, sans explication.

Exemple:
Entrée: "bonjour ça va bien et toi"
Sortie: "Bonjour, ça va bien et toi ?"

Maintenant, corrige le texte suivant:`,

  // Qwen 2.5 0.5B - Utilise prompt par défaut
  // 'qwen2.5-0.5b-instruct': undefined,

  // Gemma 3 1B - Utilise prompt par défaut
  // 'gemma-3-1b-it': undefined,

  // Ajouter d'autres modèles au besoin
};

/**
 * Extraire l'ID du modèle depuis le chemin de fichier
 * Ex: "/path/to/llama-3.2-1b-instruct-q4_k_m.gguf" -> "llama-3.2-1b-instruct"
 *
 * @param modelPath - Chemin complet vers le fichier GGUF
 * @returns Nom de base du modèle sans quantization suffix
 */
export function extractModelIdFromPath(modelPath: string): string {
  const filename = modelPath.split('/').pop() || '';
  // Remove extension and quantization suffix (ex: -q4_k_m.gguf)
  const baseName = filename.replace(/(-q\d_[kfm](_[ms])?)?\.gguf$/i, '');
  return baseName;
}

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
   * Returns ONLY the system prompt (instructions), not the user template
   */
  getDefaultPrompt(): string {
    return POSTPROCESSING_SYSTEM_PROMPT;
  }
}

// Singleton instance
export const debugPromptManager = new DebugPromptManager();
