/**
 * LogsAnalysisService — Story 7.3
 *
 * Service responsible for:
 * - Extracting and grouping error logs (AC2)
 * - Calling local LLM to analyze logs and generate GitHub issue content (AC3)
 *
 * ADR compliance:
 * - ADR-004: Single LLM call → JSON {title, body, labels, severity}
 * - ADR-021: Transient lifecycle (stateless after initialization)
 * - ADR-023: Result Pattern for returns
 * - ADR-036: LLM Local-First, SLA <60s
 */

import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ILLMModelService } from '../../../contexts/Normalization/domain/ILLMModelService';
import type { IPostProcessingBackend } from '../../../contexts/Normalization/services/postprocessing/IPostProcessingBackend';
import { LlamaRnBackend } from '../../../contexts/Normalization/services/postprocessing/LlamaRnBackend';
import { MediaPipeBackend } from '../../../contexts/Normalization/services/postprocessing/MediaPipeBackend';
import { LitertLmBackend } from '../../../contexts/Normalization/services/postprocessing/LitertLmBackend';
import type { LogEntry } from '../stores/logsDebugStore';
import {
  type Result,
  success,
  businessError,
  unknownError,
} from '../../../contexts/shared/domain/Result';

export interface GitHubIssueAnalysis {
  title: string;
  body: string;
  labels: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/** Maximum error logs sent to LLM (AC2) */
const MAX_LOGS_FOR_ANALYSIS = 20;

/** SLA <60s per ADR-036 — timeout enforced at service level */
const LLM_ANALYSIS_TIMEOUT_MS = 60_000;

/**
 * Prompt template following ADR-004 (single call → structured JSON).
 * LLM must return ONLY valid JSON, no markdown fences.
 */
const ANALYSIS_PROMPT = `Analyze these error logs and generate a GitHub issue as JSON only.
Return ONLY valid JSON with no markdown, no explanation, no backticks.

ERROR LOGS:
{logs_bundle}

Return exactly this JSON structure:
{ "title": string (max 80 chars), "body": string (markdown formatted), "labels": string[], "severity": "critical"|"high"|"medium"|"low" }`;

@injectable()
export class LogsAnalysisService {
  private backend: IPostProcessingBackend | null = null;
  private isInitialized = false;

  constructor(
    @inject(TOKENS.ILLMModelService) private readonly modelService: ILLMModelService
  ) {}

  /**
   * Extract and group error logs.
   * Filters level==='error', limits to last 20, deduplicates by message pattern.
   * (AC2)
   */
  groupErrorLogs(logs: LogEntry[]): LogEntry[] {
    const errorLogs = logs
      .filter((log) => log.level === 'error')
      .slice(-MAX_LOGS_FOR_ANALYSIS);

    // Deduplicate by first 60 chars of message (same error pattern)
    const seen = new Set<string>();
    return errorLogs.filter((log) => {
      const pattern = log.message.substring(0, 60);
      if (seen.has(pattern)) return false;
      seen.add(pattern);
      return true;
    });
  }

  /**
   * Initialize the LLM backend.
   * Follows same pattern as CaptureAnalysisService for backend selection.
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized && this.backend?.isModelLoaded()) {
      return true;
    }

    try {
      const enabled = await this.modelService.isPostProcessingEnabled();
      if (!enabled) {
        console.warn('[LogsAnalysisService] LLM post-processing not enabled in settings');
        return false;
      }

      const modelId =
        (await this.modelService.getBestAvailableModelForTask('analysis')) ||
        (await this.modelService.getBestAvailableModelForTask('postProcessing'));

      if (!modelId) {
        console.warn('[LogsAnalysisService] No LLM model available for analysis');
        return false;
      }

      const modelConfig = this.modelService.getModelConfig(modelId);
      const modelPath = this.modelService.getModelPath(modelId);

      console.log('[LogsAnalysisService] Using model:', modelId, 'backend:', modelConfig.backend);

      let backend: IPostProcessingBackend;
      if (modelConfig.backend === 'mediapipe') {
        const mediapipe = new MediaPipeBackend();
        if (!(await mediapipe.initialize())) {
          console.error('[LogsAnalysisService] MediaPipe backend unavailable');
          return false;
        }
        backend = mediapipe;
      } else if (modelConfig.backend === 'litert-lm') {
        const litertlm = new LitertLmBackend();
        if (!(await litertlm.initialize())) {
          console.error('[LogsAnalysisService] LiteRT-LM backend unavailable');
          return false;
        }
        backend = litertlm;
      } else {
        const llamarn = new LlamaRnBackend();
        if (!(await llamarn.initialize())) {
          console.error('[LogsAnalysisService] LlamaRn backend unavailable');
          return false;
        }
        backend = llamarn;
      }

      const loaded = await backend.loadModel(modelPath, modelConfig.promptTemplate);
      if (!loaded) {
        console.error('[LogsAnalysisService] Failed to load model:', modelId);
        return false;
      }

      this.backend = backend;
      this.isInitialized = true;
      console.log('[LogsAnalysisService] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[LogsAnalysisService] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Analyze error logs via local LLM and return structured GitHub issue content.
   * Single LLM call → JSON result (ADR-004).
   * SLA: <60s (ADR-036) — caller must show spinner if >5s.
   * (AC3)
   */
  async analyzeLogs(logs: LogEntry[]): Promise<Result<GitHubIssueAnalysis>> {
    const errorLogs = this.groupErrorLogs(logs);

    if (errorLogs.length === 0) {
      return businessError<GitHubIssueAnalysis>('No error logs to analyze');
    }

    if (!this.isInitialized || !this.backend?.isModelLoaded()) {
      const initialized = await this.initialize();
      if (!initialized) {
        return businessError<GitHubIssueAnalysis>(
          'LLM not available. Please download a model in Settings > LLM.'
        );
      }
    }

    let llmTimeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      const logsBundle = errorLogs
        .map((log) => `[${new Date(log.timestamp).toISOString()}] ERROR: ${log.message}`)
        .join('\n');

      const prompt = ANALYSIS_PROMPT.replace('{logs_bundle}', logsBundle);

      console.log('[LogsAnalysisService] Calling LLM for logs analysis...');
      const result = await Promise.race([
        this.backend!.processWithCustomPrompt(prompt, ''),
        new Promise<never>((_, reject) => {
          llmTimeoutId = setTimeout(
            () => reject(new Error('LLM analysis timed out after 60s (ADR-036 SLA)')),
            LLM_ANALYSIS_TIMEOUT_MS
          );
        }),
      ]);
      clearTimeout(llmTimeoutId!);
      console.log('[LogsAnalysisService] LLM response received in', result.processingDuration, 'ms');

      const analysis = this.parseJsonResponse(result.text);
      if (!analysis) {
        console.error('[LogsAnalysisService] Failed to parse LLM JSON response:', result.text.substring(0, 200));
        return businessError<GitHubIssueAnalysis>(
          'LLM returned an invalid response. Please try again.'
        );
      }

      return success(analysis);
    } catch (error) {
      if (llmTimeoutId !== null) clearTimeout(llmTimeoutId);
      console.error('[LogsAnalysisService] analyzeLogs failed:', error);
      return unknownError<GitHubIssueAnalysis>(
        error instanceof Error ? error.message : 'LLM analysis failed'
      );
    }
  }

  /**
   * Parse JSON from LLM response.
   * Handles cases where LLM wraps JSON in extra text.
   */
  private parseJsonResponse(text: string): GitHubIssueAnalysis | null {
    // Try direct parse first
    try {
      return JSON.parse(text) as GitHubIssueAnalysis;
    } catch {
      // Extract JSON object from surrounding text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as GitHubIssueAnalysis;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
