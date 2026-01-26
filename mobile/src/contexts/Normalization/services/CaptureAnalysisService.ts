/**
 * CaptureAnalysisService - LLM-based capture analysis
 *
 * Provides analysis capabilities for captures:
 * - Summary: Concise 2-3 sentence summary
 * - Highlights: 3-5 key points
 * - Action Items: Extracted tasks and actions
 *
 * Uses the same LLM infrastructure as post-processing (LlamaRnBackend).
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { container } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import type { ICaptureAnalysisRepository } from '../../capture/domain/ICaptureAnalysisRepository';
import {
  type CaptureAnalysis,
  type AnalysisType,
  ANALYSIS_TYPES,
} from '../../capture/domain/CaptureAnalysis.model';
import { getPreparedSystemPrompt } from './analysisPrompts';
import { LlamaRnBackend } from './postprocessing/LlamaRnBackend';
import { LLMModelService } from './LLMModelService';

export interface AnalysisResult {
  analysis: CaptureAnalysis;
  success: true;
}

export interface AnalysisError {
  error: string;
  success: false;
}

export type AnalyzeResult = AnalysisResult | AnalysisError;

@injectable()
export class CaptureAnalysisService {
  private llamaBackend: LlamaRnBackend | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private currentModelId: string | null = null;

  constructor() {}

  /**
   * Initialize the service
   * Creates and loads the LLM backend
   */
  async initialize(): Promise<boolean> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if model selection has changed
    const modelService = container.resolve(LLMModelService);
    const selectedModelId = await modelService.getBestAvailableModelForTask('analysis', 'llamarn')
      || await modelService.getBestAvailableModelForTask('postProcessing', 'llamarn');

    if (this.isInitialized && this.llamaBackend?.isModelLoaded()) {
      // Check if the selected model is different from the loaded one
      if (selectedModelId && selectedModelId !== this.currentModelId) {
        console.log('[CaptureAnalysisService] Model changed, reloading...', {
          current: this.currentModelId,
          selected: selectedModelId,
        });
        // Dispose current backend and reinitialize
        await this.dispose();
      } else {
        console.log('[CaptureAnalysisService] Already initialized with correct model');
        return true;
      }
    }

    this.initializationPromise = this.doInitialize();
    const result = await this.initializationPromise;
    this.initializationPromise = null;
    return result;
  }

  private async doInitialize(): Promise<boolean> {
    try {
      console.log('[CaptureAnalysisService] Starting initialization...');

      // Get model service to find a downloaded model
      const modelService = container.resolve(LLMModelService);

      // Check if post-processing is enabled
      const enabled = await modelService.isPostProcessingEnabled();
      if (!enabled) {
        console.warn('[CaptureAnalysisService] Post-processing not enabled in settings');
        return false;
      }

      // Get the best available model for analysis task
      const modelId = await modelService.getBestAvailableModelForTask('analysis', 'llamarn');
      if (!modelId) {
        // Fallback to postProcessing model if no analysis-specific model
        const fallbackModelId = await modelService.getBestAvailableModelForTask('postProcessing', 'llamarn');
        if (!fallbackModelId) {
          console.warn('[CaptureAnalysisService] No LLM model downloaded for analysis');
          return false;
        }
        console.log('[CaptureAnalysisService] Using postProcessing model as fallback:', fallbackModelId);
        const modelConfig = modelService.getModelConfig(fallbackModelId);
        const modelPath = modelService.getModelPath(fallbackModelId);

        // Create and initialize the backend
        this.llamaBackend = new LlamaRnBackend();
        const backendReady = await this.llamaBackend.initialize();
        if (!backendReady) {
          console.error('[CaptureAnalysisService] Failed to initialize LlamaRnBackend');
          return false;
        }

        console.log('[CaptureAnalysisService] Loading fallback model from:', modelPath);
        const modelLoaded = await this.llamaBackend.loadModel(modelPath, modelConfig.promptTemplate);

        if (!modelLoaded) {
          console.error('[CaptureAnalysisService] Failed to load fallback model');
          return false;
        }

        this.isInitialized = true;
        this.currentModelId = fallbackModelId;
        console.log('[CaptureAnalysisService] Initialized with fallback model:', fallbackModelId);
        return true;
      }

      console.log('[CaptureAnalysisService] Using analysis model:', modelId);

      // Create and initialize the backend
      this.llamaBackend = new LlamaRnBackend();
      const backendReady = await this.llamaBackend.initialize();
      if (!backendReady) {
        console.error('[CaptureAnalysisService] Failed to initialize LlamaRnBackend');
        return false;
      }

      // Load the model
      const modelConfig = modelService.getModelConfig(modelId);
      const modelPath = modelService.getModelPath(modelId);

      console.log('[CaptureAnalysisService] Loading model from:', modelPath);
      const modelLoaded = await this.llamaBackend.loadModel(modelPath, modelConfig.promptTemplate);

      if (!modelLoaded) {
        console.error('[CaptureAnalysisService] Failed to load model');
        return false;
      }

      this.isInitialized = true;
      this.currentModelId = modelId;
      console.log('[CaptureAnalysisService] Initialized successfully with model:', modelId);
      return true;
    } catch (error) {
      console.error('[CaptureAnalysisService] Initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.llamaBackend !== null && this.llamaBackend.isModelLoaded();
  }

  /**
   * Analyze a capture
   *
   * @param captureId - The capture to analyze
   * @param analysisType - Type of analysis to perform
   * @returns Analysis result or error
   */
  async analyze(captureId: string, analysisType: AnalysisType): Promise<AnalyzeResult> {
    console.log('[CaptureAnalysisService] Starting analysis:', { captureId, analysisType });

    // Initialize if needed
    if (!this.isReady()) {
      console.log('[CaptureAnalysisService] Not ready, initializing...');
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('[CaptureAnalysisService] Initialization failed');
        return {
          success: false,
          error: 'Le service d\'analyse n\'est pas disponible. Verifiez qu\'un modele LLM est telecharge dans les parametres.',
        };
      }
    }

    try {
      // Get repositories
      const captureRepository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const analysisRepository = container.resolve<ICaptureAnalysisRepository>(
        TOKENS.ICaptureAnalysisRepository
      );

      // Get the capture
      const capture = await captureRepository.findById(captureId);

      if (!capture) {
        console.error('[CaptureAnalysisService] Capture not found:', captureId);
        return {
          success: false,
          error: 'Capture introuvable.',
        };
      }

      // Get the text to analyze - only use normalizedText (post-processed)
      // No fallback to raw_transcript: if post-processing didn't work, don't analyze
      const normalizedText = capture.normalizedText;

      if (!normalizedText || normalizedText.trim().length === 0) {
        console.error('[CaptureAnalysisService] No normalizedText to analyze');
        return {
          success: false,
          error: 'Cette capture n\'a pas de texte post-traite a analyser.',
        };
      }

      // Determine the text to use based on analysis type
      // For highlights and action_items, use the summary as base (generate if needed)
      let textToAnalyze = normalizedText;

      if (analysisType === 'highlights' || analysisType === 'action_items') {
        // Check if summary already exists
        let summaryContent = await analysisRepository.get(captureId, 'summary');

        if (!summaryContent) {
          // Generate summary first
          console.log('[CaptureAnalysisService] No summary found, generating first...');
          const summaryResult = await this.analyze(captureId, 'summary');

          if (!summaryResult.success) {
            console.error('[CaptureAnalysisService] Failed to generate summary for', analysisType);
            return {
              success: false,
              error: `Impossible de generer le resume necessaire pour ${analysisType === 'highlights' ? 'les points cles' : 'les actions'}.`,
            };
          }

          summaryContent = summaryResult.analysis;
        }

        // Use the summary as input for highlights/action_items
        textToAnalyze = summaryContent.content;
        console.log('[CaptureAnalysisService] Using summary as base for', analysisType, ':', textToAnalyze.substring(0, 100) + '...');
      }

      console.log('[CaptureAnalysisService] Text to analyze:', textToAnalyze.substring(0, 100) + '...');

      // Get the prompt for this analysis type (with capture creation date for context)
      const captureDate = capture.createdAt;
      console.log('[CaptureAnalysisService] 📅 Capture createdAt:', {
        raw: captureDate,
        iso: captureDate.toISOString(),
        local: captureDate.toLocaleString('fr-FR'),
      });
      const systemPrompt = getPreparedSystemPrompt(analysisType, captureDate);
      console.log('[CaptureAnalysisService] Using prompt for:', analysisType);
      if (analysisType === 'action_items') {
        // Log the date that will be inserted in the prompt
        console.log('[CaptureAnalysisService] 📅 Prompt preview (first 300 chars):', systemPrompt.substring(0, 300));
      }

      // Process with the LLM
      console.log('[CaptureAnalysisService] Calling LLM...');
      const result = await this.llamaBackend!.processWithCustomPrompt(systemPrompt, textToAnalyze);
      console.log('[CaptureAnalysisService] LLM result:', result.text.substring(0, 100) + '...');

      // Save the analysis
      const analysis = await analysisRepository.save({
        captureId,
        analysisType,
        content: result.text,
        modelId: result.model,
        processingDurationMs: result.processingDuration,
      });

      console.log('[CaptureAnalysisService] Analysis saved:', {
        captureId,
        analysisType,
        duration: result.processingDuration,
        contentLength: result.text.length,
      });

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      console.error('[CaptureAnalysisService] Analysis failed:', error);
      return {
        success: false,
        error: `L'analyse a echoue: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      };
    }
  }

  /**
   * Get all analyses for a capture
   */
  async getAnalyses(captureId: string): Promise<Record<AnalysisType, CaptureAnalysis | null>> {
    const analysisRepository = container.resolve<ICaptureAnalysisRepository>(
      TOKENS.ICaptureAnalysisRepository
    );
    return analysisRepository.getAllAsMap(captureId);
  }

  /**
   * Get a specific analysis
   */
  async getAnalysis(captureId: string, analysisType: AnalysisType): Promise<CaptureAnalysis | null> {
    const analysisRepository = container.resolve<ICaptureAnalysisRepository>(
      TOKENS.ICaptureAnalysisRepository
    );
    return analysisRepository.get(captureId, analysisType);
  }

  /**
   * Delete an analysis
   */
  async deleteAnalysis(captureId: string, analysisType: AnalysisType): Promise<void> {
    const analysisRepository = container.resolve<ICaptureAnalysisRepository>(
      TOKENS.ICaptureAnalysisRepository
    );
    await analysisRepository.delete(captureId, analysisType);
  }

  /**
   * Analyze all types at once
   */
  async analyzeAll(captureId: string): Promise<Record<AnalysisType, AnalyzeResult>> {
    const results: Record<AnalysisType, AnalyzeResult> = {
      [ANALYSIS_TYPES.SUMMARY]: { success: false, error: 'Not started' },
      [ANALYSIS_TYPES.HIGHLIGHTS]: { success: false, error: 'Not started' },
      [ANALYSIS_TYPES.ACTION_ITEMS]: { success: false, error: 'Not started' },
    };

    for (const type of Object.values(ANALYSIS_TYPES)) {
      results[type] = await this.analyze(captureId, type);
    }

    return results;
  }

  /**
   * Release resources
   */
  async dispose(): Promise<void> {
    if (this.llamaBackend) {
      await this.llamaBackend.dispose();
      this.llamaBackend = null;
    }
    this.isInitialized = false;
    this.currentModelId = null;
    console.log('[CaptureAnalysisService] Disposed');
  }
}
