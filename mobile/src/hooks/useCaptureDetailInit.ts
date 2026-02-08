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
import { CaptureAnalysisService } from "../contexts/Normalization/services/CaptureAnalysisService";
import { TranscriptionModelService } from "../contexts/Normalization/services/TranscriptionModelService";
import { TranscriptionEngineService } from "../contexts/Normalization/services/TranscriptionEngineService";
import { useCaptureDetailStore } from "../stores/captureDetailStore";

export interface UseCaptureDetailInitReturn {
  loading: boolean;
  error: Error | null;
  hasModelAvailable: boolean | null;
  isNativeEngine: boolean;
}

/**
 * Hook that manages capture detail initialization
 *
 * Autonomous hook - reads and writes directly to stores
 * Also exposes captureId and reloadCapture in store for useCaptureDetailListener
 *
 * Consolidates:
 * - Initial capture loading
 * - Metadata loading
 * - Existing analyses loading
 * - Model availability check
 * - Transcription engine type check
 *
 * @param captureId - ID of the capture to load
 * @returns Initialization state
 *
 * @example
 * ```tsx
 * const init = useCaptureDetailInit(captureId);
 *
 * if (init.loading) return <LoadingSpinner />;
 * if (init.error) return <ErrorDisplay error={init.error} />;
 * ```
 */
export function useCaptureDetailInit(
  captureId: string,
): UseCaptureDetailInitReturn {
  // Autonomous - reads and writes directly to stores
  const resetStore = useCaptureDetailStore((state) => state.reset);
  const setStoreCapture = useCaptureDetailStore((state) => state.setCapture);
  const setStoreMetadata = useCaptureDetailStore((state) => state.setMetadata);
  const setStoreLoading = useCaptureDetailStore((state) => state.setLoading);
  const setCaptureId = useCaptureDetailStore((state) => state.setCaptureId);
  const setReloadCapture = useCaptureDetailStore(
    (state) => state.setReloadCapture,
  );
  const setStoreHasModelAvailable = useCaptureDetailStore(
    (state) => state.setHasModelAvailable,
  );
  const setStoreIsNativeEngine = useCaptureDetailStore(
    (state) => state.setIsNativeEngine,
  );

  // Local state for init-specific data that's not in the detail store
  const [error, setError] = useState<Error | null>(null);

  // Read from store for return values
  const loading = useCaptureDetailStore((state) => state.loading);
  const hasModelAvailable = useCaptureDetailStore(
    (state) => state.hasModelAvailable,
  );
  const isNativeEngine = useCaptureDetailStore((state) => state.isNativeEngine);

  /**
   * Load capture and metadata from repositories
   */
  const loadCapture = useCallback(async () => {
    try {
      // Reset stale state (showOriginalContent, editedText, etc.) before loading new capture
      resetStore();
      setStoreLoading(true);
      setError(null);

      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(
        TOKENS.ICaptureMetadataRepository,
      );

      // Load capture
      const result = await repository.findById(captureId);
      setStoreCapture(result);

      // Load metadata
      const captureMetadata = await metadataRepository.getAllAsMap(captureId);
      setStoreMetadata(captureMetadata);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[useCaptureDetailInit] Failed to load capture:", error);
      setError(error);
      setStoreCapture(null);
    } finally {
      setStoreLoading(false);
    }
  }, [captureId, resetStore, setStoreCapture, setStoreMetadata, setStoreLoading]);

  // Store setter for analyses
  const setAnalyses = useCaptureDetailStore((state) => state.setAnalyses);

  /**
   * Load existing analyses for the capture
   */
  const loadExistingAnalyses = useCallback(async () => {
    try {
      const analysisService = container.resolve(CaptureAnalysisService);
      const analyses = await analysisService.getAnalyses(captureId);

      // Write directly to unified store (autonomous pattern)
      setAnalyses(analyses);
    } catch (err) {
      console.error("[useCaptureDetailInit] Failed to load analyses:", err);
    }
  }, [captureId, setAnalyses]);

  /**
   * Check if transcription model is available (engine-aware)
   */
  const checkModelAvailability = useCallback(async () => {
    try {
      const engineService = container.resolve(TranscriptionEngineService);
      const isNative = await engineService.isNativeEngineSelected();

      if (isNative) {
        const { NativeTranscriptionEngine } = await import(
          "../contexts/Normalization/services/NativeTranscriptionEngine"
        );
        const nativeEngine = container.resolve(NativeTranscriptionEngine);
        const available = await nativeEngine.isAvailable();
        setStoreHasModelAvailable(available);
      } else {
        const modelService = container.resolve(TranscriptionModelService);
        const bestModel = await modelService.getBestAvailableModel();
        setStoreHasModelAvailable(bestModel !== null);
      }
    } catch (err) {
      console.error(
        "[useCaptureDetailInit] Failed to check model availability:",
        err,
      );
      setStoreHasModelAvailable(null); // Unknown state
    }
  }, [setStoreHasModelAvailable]);

  /**
   * Check transcription engine type (native vs Whisper)
   */
  const checkEngineType = useCallback(async () => {
    try {
      const engineService = container.resolve(TranscriptionEngineService);
      const isNative = await engineService.isNativeEngineSelected();
      setStoreIsNativeEngine(isNative);
    } catch (err) {
      console.error("[useCaptureDetailInit] Failed to check engine type:", err);
      setStoreIsNativeEngine(false); // Default to Whisper on error
    }
  }, [setStoreIsNativeEngine]);

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

  // Effect 5: Expose captureId and reloadCapture in store for useCaptureDetailListener
  useEffect(() => {
    setCaptureId(captureId);
    setReloadCapture(loadCapture);

    return () => {
      setCaptureId(null);
      setReloadCapture(null);
    };
  }, [captureId, loadCapture, setCaptureId, setReloadCapture]);

  return {
    loading,
    error,
    hasModelAvailable,
    isNativeEngine,
  };
}
