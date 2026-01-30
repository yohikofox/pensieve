/**
 * LlamaRnBackend - LLM inference using llama.rn (GGUF models)
 *
 * Uses llama.rn for running quantized GGUF models on GPU/CPU.
 * This is the fallback backend when TPU is not available.
 *
 * Supported models:
 * - Qwen 2.5 0.5B (~400MB) - Recommended for speed
 * - Gemma 3 1B (~800MB) - Good balance
 * - Phi-3 Mini (~2.3GB) - Best quality
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import {
  type IPostProcessingBackend,
  type PostProcessingResult,
  debugPromptManager,
  MODEL_PROMPT_OVERRIDES,
  extractModelIdFromPath,
  POSTPROCESSING_USER_PROMPT,
} from './IPostProcessingBackend';
import { type PromptTemplate } from '../LLMModelService';

// llama.rn types (will be available after npm install)
interface LlamaContext {
  completion: (params: {
    prompt: string;
    n_predict: number;
    temperature?: number;
    top_p?: number;
    stop?: string[];
  }) => Promise<{ text: string }>;
  release: () => Promise<void>;
}

interface LlamaModule {
  initLlama: (params: {
    model: string;
    n_ctx: number;
    n_gpu_layers?: number;
    use_mlock?: boolean;
  }) => Promise<LlamaContext>;
}

// Dynamic import to handle cases where llama.rn isn't installed yet
let llamaModule: LlamaModule | null = null;

async function getLlamaModule(): Promise<LlamaModule> {
  if (llamaModule) {
    return llamaModule;
  }

  try {
    // @ts-ignore - Dynamic import
    llamaModule = await import('llama.rn');
    return llamaModule;
  } catch (error) {
    console.error('[LlamaRnBackend] Failed to import llama.rn:', error);
    throw new Error(
      'llama.rn is not installed. Run: npm install llama.rn'
    );
  }
}

@injectable()
export class LlamaRnBackend implements IPostProcessingBackend {
  readonly name = 'llamarn' as const;

  private context: LlamaContext | null = null;
  private modelPath: string | null = null;
  private promptTemplate: PromptTemplate = 'chatml';
  private isInitialized: boolean = false;

  /**
   * Initialize the backend
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Just verify the module is available
      await getLlamaModule();
      this.isInitialized = true;
      console.log('[LlamaRnBackend] Initialized');
      return true;
    } catch (error) {
      console.error('[LlamaRnBackend] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if backend is available
   * llama.rn works on all devices (GPU/CPU fallback)
   */
  async isAvailable(): Promise<boolean> {
    try {
      await getLlamaModule();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a model is currently loaded
   */
  isModelLoaded(): boolean {
    return this.context !== null;
  }

  /**
   * Load a GGUF model
   *
   * @param modelPath - Path to the GGUF model file
   * @param promptTemplate - Chat template format for the model
   */
  async loadModel(modelPath: string, promptTemplate?: PromptTemplate): Promise<boolean> {
    try {
      // Unload previous model if any
      if (this.context) {
        await this.unloadModel();
      }

      const llama = await getLlamaModule();

      console.log('[LlamaRnBackend] Loading model:', modelPath, 'template:', promptTemplate);

      this.context = await llama.initLlama({
        model: modelPath,
        n_ctx: 4096, // Context window (increased for longer transcripts)
        n_gpu_layers: 99, // Use GPU when available
        use_mlock: true, // Lock memory to prevent swapping
      });

      this.modelPath = modelPath;
      this.promptTemplate = promptTemplate || 'chatml';

      console.log('[LlamaRnBackend] Model loaded successfully');
      return true;
    } catch (error) {
      console.error('[LlamaRnBackend] Failed to load model:', error);
      this.context = null;
      this.modelPath = null;
      this.promptTemplate = 'chatml';
      return false;
    }
  }

  /**
   * Unload the current model from memory
   */
  async unloadModel(): Promise<void> {
    if (this.context) {
      try {
        await this.context.release();
        console.log('[LlamaRnBackend] Model unloaded');
      } catch (error) {
        console.error('[LlamaRnBackend] Error unloading model:', error);
      }
      this.context = null;
      this.modelPath = null;
    }
  }

  /**
   * Process text to improve quality
   *
   * @param text - Raw transcription text
   */
  async process(text: string): Promise<PostProcessingResult> {
    if (!this.context) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    // Build the prompt
    const prompt = this.buildPrompt(text);

    console.log('[LlamaRnBackend] Processing text:', {
      modelPath: this.modelPath,
      inputLength: text.length,
      inputPreview: text.substring(0, 50) + '...',
      promptLength: prompt.length,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.context.completion({
        prompt,
        n_predict: 2048, // Max tokens to generate (increased for longer transcripts)
        temperature: 0.1, // Low temperature for deterministic output
        top_p: 0.9,
        stop: this.getStopTokens(),
      });

      const processingDuration = Date.now() - startTime;

      // Log raw output before cleaning
      console.log('[LlamaRnBackend] Raw model output:', {
        rawLength: result.text.length,
        rawText: result.text.substring(0, 200) + (result.text.length > 200 ? '...' : ''),
        stopTokens: this.getStopTokens(),
      });

      // Clean up the result FIRST (before leak detection)
      let processedText = result.text.trim();

      // Remove any leading/trailing quotes that models sometimes add
      if (processedText.startsWith('"') && processedText.endsWith('"')) {
        processedText = processedText.slice(1, -1);
      }

      // Remove any leaked special tokens from all model types
      processedText = processedText
        // Llama 3.x tokens
        .replace(/<\|begin_of_text\|>/g, '')
        .replace(/<\|end_of_text\|>/g, '')
        .replace(/<\|start_header_id\|>/g, '')
        .replace(/<\|end_header_id\|>/g, '')
        .replace(/<\|eot_id\|>/g, '')
        // Llama 2 tokens
        .replace(/<<SYS>>/g, '')
        .replace(/<\/SYS>>/g, '')
        .replace(/\[INST\]/g, '')
        .replace(/\[\/INST\]/g, '')
        // ChatML tokens
        .replace(/<\|im_start\|>/g, '')
        .replace(/<\|im_end\|>/g, '')
        // Gemma tokens
        .replace(/<start_of_turn>/g, '')
        .replace(/<end_of_turn>/g, '')
        // Phi tokens
        .replace(/<\|system\|>/g, '')
        .replace(/<\|user\|>/g, '')
        .replace(/<\|assistant\|>/g, '')
        .replace(/<\|end\|>/g, '')
        // General cleanup
        .replace(/<s>/g, '')
        .replace(/<\/s>/g, '')
        .trim();

      // Remove common model preambles/introductions
      const preamblePatterns = [
        /^voici\s+(le\s+)?texte\s+(corrigé|amélioré)\s*:?\s*/i,
        /^texte\s+(corrigé|amélioré)\s*:?\s*/i,
        /^le\s+texte\s+(corrigé|amélioré)\s+(est\s*)?:?\s*/i,
        /^here'?s?\s+(the\s+)?(corrected|improved)\s+text\s*:?\s*/i,
        /^(bien\s+sûr|d'accord|ok)\s*[,!.]?\s*/i,
        // Nouveaux patterns français
        /^voici\s+la\s+correction\s+(de\s+la\s+transcription\s+vocale)?\s*:?\s*/i,
        /^corrections?\s+effectuées?\s*:?\s*/i,
        /^corrections?\s*:\s*/i,  // NOUVEAU: Juste "Corrections :" au début
        /^texte\s+à\s+corriger\s*:?\s*/i,
        /^(voici|voilà)\s+le\s+résultat\s*:?\s*/i,
      ];
      for (const pattern of preamblePatterns) {
        processedText = processedText.replace(pattern, '');
      }
      processedText = processedText.trim();

      // Remove explanatory sections that models sometimes add
      // These patterns remove everything after the corrected text
      // IMPORTANT: Use \s+ instead of \n\n+ to catch single newlines too
      const explanatorySectionPatterns = [
        /\s+j'ai\s+(corrigé|effectué).*/is,
        /\s+corrections?\s*(effectuées?)?\s*:.*/is,  // Catch "Corrections :" or "Corrections effectuées :"
        /\s+la\s+correction\s+finale.*/is,
        /\s+erreurs?\s+suivantes?\s*:.*/is,
        /\s+modifications?\s+suivantes?\s*:.*/is,
        /\s+voici\s+les?\s+(corrections?|modifications?).*/is,
        /\s+liste\s+des?\s+(corrections?|modifications?).*/is,
      ];
      for (const pattern of explanatorySectionPatterns) {
        processedText = processedText.replace(pattern, '');
      }
      processedText = processedText.trim();

      // NOW detect prompt leak after cleaning (to avoid false positives on benign preambles)
      if (this.detectPromptLeak(processedText)) {
        console.error('[LlamaRnBackend] ❌ System prompt detected in output after cleaning! Aborting.');
        throw new Error(
          'Le modèle a généré une sortie invalide contenant les instructions système. ' +
          'Veuillez réessayer ou choisir un autre modèle.'
        );
      }

      console.log('[LlamaRnBackend] Processing completed:', {
        duration: processingDuration,
        inputLength: text.length,
        outputLength: processedText.length,
        ratio: (processedText.length / text.length).toFixed(2),
        outputPreview: processedText.substring(0, 100) + '...',
      });

      return {
        text: processedText,
        processingDuration,
        backend: 'llamarn',
        model: this.modelPath || 'unknown',
      };
    } catch (error) {
      console.error('[LlamaRnBackend] Processing failed:', error);
      throw new Error(
        `LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build the prompt for the LLM based on the model's template format
   * Properly separates system instructions from user message
   */
  private buildPrompt(text: string): string {
    // Get system prompt (with model-specific override if exists)
    const systemPrompt = this.getSystemPromptForModel();

    // Build user message separately
    const userMessage = `Texte à corriger :
"""${text}"""`;

    // Use the same logic as buildPromptWithCustomSystem
    return this.buildPromptWithCustomSystem(systemPrompt, userMessage);
  }

  /**
   * Get system prompt with model-specific override support
   */
  private getSystemPromptForModel(): string {
    if (!this.modelPath) {
      return debugPromptManager.getPrompt();
    }

    // Check for model-specific override
    const modelId = extractModelIdFromPath(this.modelPath);
    const override = MODEL_PROMPT_OVERRIDES[modelId];

    if (override) {
      console.log('[LlamaRnBackend] Using model-specific prompt for:', modelId);
      return override;
    }

    // Fallback to default (or custom debug prompt)
    return debugPromptManager.getPrompt();
  }

  /**
   * Get appropriate stop tokens for the model
   */
  private getStopTokens(): string[] {
    switch (this.promptTemplate) {
      case 'gemma':
        return ['<end_of_turn>', '<start_of_turn>'];
      case 'phi':
        return ['<|end|>', '<|user|>', '<|assistant|>'];
      case 'llama':
        // Llama 3.x stop tokens
        return ['<|eot_id|>', '<|end_of_text|>', '<|start_header_id|>'];
      case 'chatml':
      default:
        return ['\n\n', '<|end|>', '<|im_end|>', '</s>'];
    }
  }

  /**
   * Detect if the LLM output contains leaked system prompt instructions
   * This indicates a prompt construction bug
   */
  private detectPromptLeak(output: string): boolean {
    const leakIndicators = [
      'Tu es un assistant spécialisé',
      'assistant spécialisé dans la correction',
      'Règles strictes',
      'POSTPROCESSING_SYSTEM_PROMPT',
      'POSTPROCESSING_USER_PROMPT',
      'Corrections effectuées :',
      "J'ai corrigé",
      "J'ai effectué",
      'Instructions :',
      'Objectif :',
      'La correction finale',
      'erreurs suivantes',
      'modifications suivantes',
    ];

    const outputLower = output.toLowerCase();

    for (const indicator of leakIndicators) {
      if (outputLower.includes(indicator.toLowerCase())) {
        console.warn('[LlamaRnBackend] Prompt leak detected:', indicator);
        return true;
      }
    }

    // Vérifier si la sortie est anormalement longue (>5000 chars)
    // Ce qui peut indiquer que le prompt a été inclus
    if (output.length > 5000) {
      console.warn('[LlamaRnBackend] Suspiciously long output detected:', output.length);
      return true;
    }

    return false;
  }

  /**
   * Get the system prompt
   * Uses custom prompt if set in debug mode, otherwise default
   */
  getSystemPrompt(): string {
    return debugPromptManager.getPrompt();
  }

  /**
   * Process text with a custom prompt
   *
   * @param systemPrompt - The system prompt to use
   * @param userText - The text to process
   * @returns Processing result
   */
  async processWithCustomPrompt(
    systemPrompt: string,
    userText: string
  ): Promise<PostProcessingResult> {
    if (!this.context) {
      throw new Error('No model loaded. Call loadModel() first.');
    }

    const startTime = Date.now();

    // Build prompt with custom system prompt
    const prompt = this.buildPromptWithCustomSystem(systemPrompt, userText);

    console.log('[LlamaRnBackend] Processing with custom prompt:', systemPrompt.substring(0, 50) + '...');

    try {
      // Use stop tokens + repetition detection
      const stopTokens = [
        ...this.getStopTokens(),
        '\n\n\n', // Stop on triple newline (often indicates end of response)
      ];

      const result = await this.context.completion({
        prompt,
        n_predict: 512, // Reduced to prevent runaway generation
        temperature: 0.3,
        top_p: 0.9,
        stop: stopTokens,
      });

      const processingDuration = Date.now() - startTime;

      // Clean up the result
      let processedText = result.text.trim();

      // Detect prompt leak for analyses too
      if (this.detectPromptLeak(processedText)) {
        console.error('[LlamaRnBackend] ❌ System prompt leaked in analysis output');
        throw new Error('Sortie invalide détectée. Veuillez réessayer.');
      }

      // Remove any leading/trailing quotes
      if (processedText.startsWith('"') && processedText.endsWith('"')) {
        processedText = processedText.slice(1, -1);
      }

      // Remove any leaked special tokens
      processedText = this.cleanSpecialTokens(processedText);

      console.log('[LlamaRnBackend] Custom prompt processing completed:', {
        duration: processingDuration,
        inputLength: userText.length,
        outputLength: processedText.length,
      });

      return {
        text: processedText,
        processingDuration,
        backend: 'llamarn',
        model: this.modelPath || 'unknown',
      };
    } catch (error) {
      console.error('[LlamaRnBackend] Custom prompt processing failed:', error);
      throw new Error(
        `LLM processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build prompt with a custom system prompt
   */
  private buildPromptWithCustomSystem(systemPrompt: string, userText: string): string {
    switch (this.promptTemplate) {
      case 'gemma':
        return `<start_of_turn>user
${systemPrompt}

${userText}<end_of_turn>
<start_of_turn>model
`;

      case 'phi':
        return `<|system|>
${systemPrompt}<|end|>
<|user|>
${userText}<|end|>
<|assistant|>
`;

      case 'llama':
        return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

${systemPrompt}<|eot_id|><|start_header_id|>user<|end_header_id|>

${userText}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;

      case 'chatml':
      default:
        return `<|im_start|>system
${systemPrompt}
<|im_end|>
<|im_start|>user
${userText}
<|im_end|>
<|im_start|>assistant
`;
    }
  }

  /**
   * Clean special tokens from output
   */
  private cleanSpecialTokens(text: string): string {
    return text
      // Llama 3.x tokens
      .replace(/<\|begin_of_text\|>/g, '')
      .replace(/<\|end_of_text\|>/g, '')
      .replace(/<\|start_header_id\|>/g, '')
      .replace(/<\|end_header_id\|>/g, '')
      .replace(/<\|eot_id\|>/g, '')
      // Llama 2 tokens
      .replace(/<<SYS>>/g, '')
      .replace(/<\/SYS>>/g, '')
      .replace(/\[INST\]/g, '')
      .replace(/\[\/INST\]/g, '')
      // ChatML tokens
      .replace(/<\|im_start\|>/g, '')
      .replace(/<\|im_end\|>/g, '')
      // Gemma tokens
      .replace(/<start_of_turn>/g, '')
      .replace(/<end_of_turn>/g, '')
      // Phi tokens
      .replace(/<\|system\|>/g, '')
      .replace(/<\|user\|>/g, '')
      .replace(/<\|assistant\|>/g, '')
      .replace(/<\|end\|>/g, '')
      // General cleanup
      .replace(/<s>/g, '')
      .replace(/<\/s>/g, '')
      .trim();
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    await this.unloadModel();
    this.isInitialized = false;
    console.log('[LlamaRnBackend] Disposed');
  }
}
