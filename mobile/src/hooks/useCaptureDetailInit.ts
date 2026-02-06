/**
 * useCaptureDetailInit
 *
 * Custom hook that manages the initialization logic for CaptureDetailScreen.
 * Consolidates multiple useEffects into a single cohesive initialization flow.
 *
 * Extracted from CaptureDetailScreen.tsx to reduce complexity and improve testability.
 */

import { useEffect, useCallback, useState } from "react";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureRepository } from "../contexts/capture/domain/ICaptureRepository";
import type { ICaptureMetadataRepository } from "../contexts/capture/domain/ICaptureMetadataRepository";
import type { Capture } from "../contexts/capture/domain/Capture.model";
import type { CaptureMetadata } from "../contexts/capture/domain/CaptureMetadata.model";
import { CaptureAnalysisService } from "../contexts/Normalization/services/CaptureAnalysisService";
import { TranscriptionModelService } from "../contexts/Normalization/services/TranscriptionModelService";
import { TranscriptionEngineService } from "../contexts/Normalization/services/TranscriptionEngineService";

export interface UseCaptureDetailInitParams {
  captureId: string;
  onCaptureLoaded: (capture: Capture | null) => void;
  onMetadataLoaded: (metadata: Record<string, CaptureMetadata>) => void;
  onLoadingChange: (loading: boolean) => void;
  onModelAvailabilityChange: (available: boolean | null) => void;
  onEngineTypeChange: (isNative: boolean) => void;
}

export interface UseCaptureDetailInitReturn {
  loading: boolean;
  error: Error | null;
  loadCapture: () => Promise<void>;
  hasModelAvailable: boolean | null;
  isNativeEngine: boolean;
  existingAnalyses: any | null;
}

/**
 * Hook that manages capture detail initialization
 *
 * Consolidates:
 * - Initial capture loading
 * - Metadata loading
 * - Existing analyses loading
 * - Model availability check
 * - Transcription engine type check
 *
 * @param params - Initialization parameters and callbacks
 * @returns Initialization state and loadCapture function
 *
 * @example
 * ```tsx
 * const init = useCaptureDetailInit({
 *   captureId,
 *   onCaptureLoaded: setCapture,
 *   onMetadataLoaded: setMetadata,
 *   onAnalysesLoaded: analysesHook.setAnalyses,
 *   onLoadingChange: setLoading,
 *   onModelAvailabilityChange: setHasModelAvailable,
 *   onEngineTypeChange: setIsNativeEngine,
 * });
 *
 * if (init.loading) return <LoadingSpinner />;
 * if (init.error) return <ErrorDisplay error={init.error} />;
 * ```
 */
export function useCaptureDetailInit(
  params: UseCaptureDetailInitParams
): UseCaptureDetailInitReturn {
  const {
    captureId,
    onCaptureLoaded,
    onMetadataLoaded,
    onLoadingChange,
    onModelAvailabilityChange,
    onEngineTypeChange,
  } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasModelAvailable, setHasModelAvailable] = useState<boolean | null>(null);
  const [isNativeEngine, setIsNativeEngine] = useState(false);
  const [existingAnalyses, setExistingAnalyses] = useState<any | null>(null);

  /**
   * Load capture and metadata from repositories
   */
  const loadCapture = useCallback(async () => {
    try {
      setLoading(true);
      onLoadingChange(true);
      setError(null);

      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository
      );
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(
        TOKENS.ICaptureMetadataRepository
      );

      // Load capture
      const result = await repository.findById(captureId);
      onCaptureLoaded(result);

      // Load metadata
      const captureMetadata = await metadataRepository.getAllAsMap(captureId);
      onMetadataLoaded(captureMetadata);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[useCaptureDetailInit] Failed to load capture:", error);
      setError(error);
      onCaptureLoaded(null);
    } finally {
      setLoading(false);
      onLoadingChange(false);
    }
  }, [captureId, onCaptureLoaded, onMetadataLoaded, onLoadingChange]);

  /**
   * Load existing analyses for the capture
   */
  const loadExistingAnalyses = useCallback(async () => {
    try {
      const analysisService = container.resolve(CaptureAnalysisService);
      const analyses = await analysisService.getAnalyses(captureId);
      setExistingAnalyses(analyses);
    } catch (err) {
      console.error("[useCaptureDetailInit] Failed to load analyses:", err);
    }
  }, [captureId]);

  /**
   * Check if transcription model is available
   */
  const checkModelAvailability = useCallback(async () => {
    try {
      const modelService = container.resolve(TranscriptionModelService);
      const bestModel = await modelService.getBestAvailableModel();
      const available = bestModel !== null;
      setHasModelAvailable(available);
      onModelAvailabilityChange(available);
    } catch (err) {
      console.error(
        "[useCaptureDetailInit] Failed to check model availability:",
        err
      );
      setHasModelAvailable(null); // Unknown state
      onModelAvailabilityChange(null);
    }
  }, [onModelAvailabilityChange]);

  /**
   * Check transcription engine type (native vs Whisper)
   */
  const checkEngineType = useCallback(async () => {
    try {
      const engineService = container.resolve(TranscriptionEngineService);
      const isNative = await engineService.isNativeEngineSelected();
      setIsNativeEngine(isNative);
      onEngineTypeChange(isNative);
    } catch (err) {
      console.error(
        "[useCaptureDetailInit] Failed to check engine type:",
        err
      );
      setIsNativeEngine(false); // Default to Whisper on error
      onEngineTypeChange(false);
    }
  }, [onEngineTypeChange]);

  // Effect 1: Initial capture load
  useEffect(() => {
    loadCapture();
  }, [loadCapture]);

  // Effect 2: Load existing analyses
  useEffect(() => {
    loadExistingAnalyses();
  }, [loadExistingAnalyses]);

  // Effect 3: Check model availability
  useEffect(() => {
    checkModelAvailability();
  }, [checkModelAvailability]);

  // Effect 4: Check engine type
  useEffect(() => {
    checkEngineType();
  }, [checkEngineType]);

  return {
    loading,
    error,
    loadCapture,
    hasModelAvailable,
    isNativeEngine,
    existingAnalyses,
  };
}
