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
import { inject, injectable } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import type { ICaptureAnalysisRepository } from '../../capture/domain/ICaptureAnalysisRepository';
import type { ILLMModelService } from '../domain/ILLMModelService';
import {
  type CaptureAnalysis,
  type AnalysisType,
  ANALYSIS_TYPES,
} from '../../capture/domain/CaptureAnalysis.model';
import { getPreparedSystemPrompt, filterIdeasContent } from './analysisPrompts';
import { type IPostProcessingBackend } from './postprocessing/IPostProcessingBackend';
import { LlamaRnBackend } from './postprocessing/LlamaRnBackend';
import { MediaPipeBackend } from './postprocessing/MediaPipeBackend';
import { LitertLmBackend } from './postprocessing/LitertLmBackend';

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
  private backend: IPostProcessingBackend | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private currentModelId: string | null = null;

  constructor(
    @inject(TOKENS.ILLMModelService) private modelService: ILLMModelService,
    @inject(TOKENS.ICaptureRepository) private captureRepository: ICaptureRepository,
    @inject(TOKENS.ICaptureAnalysisRepository) private analysisRepository: ICaptureAnalysisRepository
  ) {}

  /**
   * Initialize the service
   * Creates and loads the LLM backend
   */
  async initialize(): Promise<boolean> {
    // Return existing promise if initialization is in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Check if model selection has changed (any backend)
    const selectedModelId = await this.modelService.getBestAvailableModelForTask('analysis')
      || await this.modelService.getBestAvailableModelForTask('postProcessing');

    if (this.isInitialized && this.backend?.isModelLoaded()) {
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

      // Check if post-processing is enabled
      const enabled = await this.modelService.isPostProcessingEnabled();
      if (!enabled) {
        console.warn('[CaptureAnalysisService] Post-processing not enabled in settings');
        return false;
      }

      // Get the best available model for analysis (any backend)
      const modelId = await this.modelService.getBestAvailableModelForTask('analysis')
        || await this.modelService.getBestAvailableModelForTask('postProcessing');

      if (!modelId) {
        console.warn('[CaptureAnalysisService] No LLM model downloaded for analysis');
        return false;
      }

      const modelConfig = this.modelService.getModelConfig(modelId);
      const modelPath = this.modelService.getModelPath(modelId);
      console.log('[CaptureAnalysisService] Using model:', modelId, 'backend:', modelConfig.backend);

      // Select backend based on model type
      let backend: IPostProcessingBackend;
      if (modelConfig.backend === 'mediapipe') {
        const mediapipe = new MediaPipeBackend();
        if (!await mediapipe.initialize()) {
          console.error('[CaptureAnalysisService] MediaPipe backend unavailable');
          return false;
        }
        backend = mediapipe;
      } else if (modelConfig.backend === 'litert-lm') {
        const litertlm = new LitertLmBackend();
        if (!await litertlm.initialize()) {
          console.error('[CaptureAnalysisService] LiteRT-LM backend unavailable');
          return false;
        }
        backend = litertlm;
      } else {
        const llamarn = new LlamaRnBackend();
        if (!await llamarn.initialize()) {
          console.error('[CaptureAnalysisService] LlamaRn backend unavailable');
          return false;
        }
        backend = llamarn;
      }

      const modelLoaded = await backend.loadModel(modelPath, modelConfig.promptTemplate);
      if (!modelLoaded) {
        console.error('[CaptureAnalysisService] Failed to load model:', modelId);
        return false;
      }

      this.backend = backend;
      this.isInitialized = true;
      this.currentModelId = modelId;
      console.log('[CaptureAnalysisService] Initialized successfully with model:', modelId, 'backend:', modelConfig.backend);
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
    return this.isInitialized && this.backend !== null && this.backend.isModelLoaded();
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
      // Get the capture
      const capture = await this.captureRepository.findById(captureId);

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
      // For summary and ideas, use the full normalizedText
      // For highlights and action_items, use the summary as base (generate if needed)
      let textToAnalyze = normalizedText;

      if (analysisType === 'highlights' || analysisType === 'action_items') {
        // Check if summary already exists
        let summaryContent = await this.analysisRepository.get(captureId, 'summary');

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
      const result = await this.backend!.processWithCustomPrompt(systemPrompt, textToAnalyze);
      console.log('[CaptureAnalysisService] LLM result:', result.text.substring(0, 100) + '...');

      // Filtrer les pistes opérationnelles pour le type "ideas"
      const contentToSave =
        analysisType === "ideas"
          ? filterIdeasContent(result.text)
          : result.text;

      // Save the analysis
      const analysis = await this.analysisRepository.save({
        captureId,
        analysisType,
        content: contentToSave,
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
    return this.analysisRepository.getAllAsMap(captureId);
  }

  /**
   * Get a specific analysis
   */
  async getAnalysis(captureId: string, analysisType: AnalysisType): Promise<CaptureAnalysis | null> {
    return this.analysisRepository.get(captureId, analysisType);
  }

  /**
   * Delete an analysis
   */
  async deleteAnalysis(captureId: string, analysisType: AnalysisType): Promise<void> {
    await this.analysisRepository.delete(captureId, analysisType);
  }

  /**
   * Analyze all types at once
   */
  async analyzeAll(captureId: string): Promise<Record<AnalysisType, AnalyzeResult>> {
    const results: Record<AnalysisType, AnalyzeResult> = {
      [ANALYSIS_TYPES.SUMMARY]: { success: false, error: 'Not started' },
      [ANALYSIS_TYPES.HIGHLIGHTS]: { success: false, error: 'Not started' },
      [ANALYSIS_TYPES.ACTION_ITEMS]: { success: false, error: 'Not started' },
      [ANALYSIS_TYPES.IDEAS]: { success: false, error: 'Not started' },
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
    if (this.backend) {
      await this.backend.dispose();
      this.backend = null;
    }
    this.isInitialized = false;
    this.currentModelId = null;
    console.log('[CaptureAnalysisService] Disposed');
  }
}
