/**
 * useAnalyses Hook
 *
 * Autonomous hook for LLM analysis management.
 * Reads/writes to unified captureDetailStore.
 *
 * Story 5.1 - Refactoring: Extract analysis responsibility
 * Story 5.4 - Unified store: no more captureId indexing
 */

import { useState } from "react";
import { container } from "tsyringe";
import { CaptureAnalysisService } from "../contexts/Normalization/services/CaptureAnalysisService";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import { useTextEditor } from "./useTextEditor";
import { useCaptureDetailStore } from "../stores/captureDetailStore";
import { useToast } from "../design-system/components";

interface UseAnalysesReturn {
  analyses: Record<AnalysisType, CaptureAnalysis | null>;
  analysisLoading: Record<AnalysisType, boolean>;
  analysisError: string | null;
  isAnyAnalysisLoading: boolean;
  handleGenerateAnalysis: (type: AnalysisType) => Promise<void>;
  handleAnalyzeAll: () => Promise<void>;
  setAnalyses: (analyses: Record<AnalysisType, CaptureAnalysis | null>) => void;
}

export function useAnalyses(): UseAnalysesReturn {
  const toast = useToast();
  const { ensureTextSaved } = useTextEditor();

  // Read from unified store - direct selectors, no wrapper
  const captureId = useCaptureDetailStore((state) => state.captureId);
  const analyses = useCaptureDetailStore((state) => state.analyses);
  const analysisLoading = useCaptureDetailStore((state) => state.analysisLoading);
  const setAnalysis = useCaptureDetailStore((state) => state.setAnalysis);
  const setAnalysesInStore = useCaptureDetailStore((state) => state.setAnalyses);
  const setAnalysisLoading = useCaptureDetailStore((state) => state.setAnalysisLoading);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isAnyAnalysisLoading = Object.values(analysisLoading).some(Boolean);

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    if (!captureId) return;

    console.log("[useAnalyses] handleGenerateAnalysis called for:", type);
    setAnalysisLoading(type, true);
    setAnalysisError(null);

    try {
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      console.log("[useAnalyses] Calling analysisService.analyze...");
      const result = await analysisService.analyze(captureId, type);
      console.log("[useAnalyses] Analysis result:", result);

      if (result.success) {
        setAnalysis(type, result.analysis);
      } else {
        setAnalysisError(result.error);
        toast.error(result.error ?? "Erreur d'analyse");
      }
    } catch (error) {
      console.error("[useAnalyses] Analysis failed:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Erreur inconnue";
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setAnalysisLoading(type, false);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!captureId) return;

    console.log("[useAnalyses] handleAnalyzeAll called");
    setAnalysisLoading(ANALYSIS_TYPES.SUMMARY, true);
    setAnalysisLoading(ANALYSIS_TYPES.HIGHLIGHTS, true);
    setAnalysisLoading(ANALYSIS_TYPES.ACTION_ITEMS, true);
    setAnalysisLoading(ANALYSIS_TYPES.IDEAS, true);
    setAnalysisError(null);

    try {
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      const results = await analysisService.analyzeAll(captureId);

      const newAnalyses: Record<AnalysisType, CaptureAnalysis | null> = {
        [ANALYSIS_TYPES.SUMMARY]: null,
        [ANALYSIS_TYPES.HIGHLIGHTS]: null,
        [ANALYSIS_TYPES.ACTION_ITEMS]: null,
        [ANALYSIS_TYPES.IDEAS]: null,
      };

      let hasError = false;
      for (const [type, result] of Object.entries(results)) {
        if (result.success) {
          newAnalyses[type as AnalysisType] = result.analysis;
        } else {
          hasError = true;
          console.error(
            `[useAnalyses] Analysis ${type} failed:`,
            result.error,
          );
        }
      }

      setAnalysesInStore(newAnalyses);

      if (hasError) {
        toast.warning("Certaines analyses ont échoué. Vérifiez les logs.");
      }
    } catch (error) {
      console.error("[useAnalyses] AnalyzeAll failed:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Erreur inconnue";
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setAnalysisLoading(ANALYSIS_TYPES.SUMMARY, false);
      setAnalysisLoading(ANALYSIS_TYPES.HIGHLIGHTS, false);
      setAnalysisLoading(ANALYSIS_TYPES.ACTION_ITEMS, false);
      setAnalysisLoading(ANALYSIS_TYPES.IDEAS, false);
    }
  };

  return {
    analyses,
    analysisLoading,
    analysisError,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
    setAnalyses: setAnalysesInStore,
  };
}
