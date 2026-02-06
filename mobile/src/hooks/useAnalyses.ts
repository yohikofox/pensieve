/**
 * useAnalyses Hook
 *
 * Completely autonomous hook for LLM analysis management.
 * Reads all data from stores, no parameters needed.
 *
 * Manages LLM analysis generation (Summary, Highlights, Action Items, Ideas)
 * Story 5.1 - Refactoring: Extract analysis responsibility from CaptureDetailScreen
 * Story 5.4 - Autonomous hook: reads from stores, no prop drilling
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
import { useAnalysesStore, useCurrentAnalyses } from "../stores/analysesStore";
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
  // Read everything from stores - autonomous hook
  const capture = useCaptureDetailStore((state) => state.capture);
  const toast = useToast();
  const { ensureTextSaved } = useTextEditor();

  const captureId = capture?.id || "";

  // Use store for shared state
  const { analyses, analysisLoading } = useCurrentAnalyses(captureId);
  const setAnalysis = useAnalysesStore((state) => state.setAnalysis);
  const setAnalysesInStore = useAnalysesStore((state) => state.setAnalyses);
  const setAnalysisLoading = useAnalysesStore((state) => state.setAnalysisLoading);

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isAnyAnalysisLoading = Object.values(analysisLoading).some(Boolean);

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    console.log("[useAnalyses] handleGenerateAnalysis called for:", type);
    setAnalysisLoading(captureId, type, true);
    setAnalysisError(null);

    try {
      // Save text to DB if there are unsaved changes (needed for analysis)
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      console.log("[useAnalyses] Calling analysisService.analyze...");
      const result = await analysisService.analyze(captureId, type);
      console.log("[useAnalyses] Analysis result:", result);

      if (result.success) {
        setAnalysis(captureId, type, result.analysis);
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
      setAnalysisLoading(captureId, type, false);
    }
  };

  const handleAnalyzeAll = async () => {
    console.log("[useAnalyses] handleAnalyzeAll called");
    // Set all loading states
    setAnalysisLoading(captureId, ANALYSIS_TYPES.SUMMARY, true);
    setAnalysisLoading(captureId, ANALYSIS_TYPES.HIGHLIGHTS, true);
    setAnalysisLoading(captureId, ANALYSIS_TYPES.ACTION_ITEMS, true);
    setAnalysisLoading(captureId, ANALYSIS_TYPES.IDEAS, true);
    setAnalysisError(null);

    try {
      // Save text to DB if there are unsaved changes (needed for analysis)
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      const results = await analysisService.analyzeAll(captureId);

      // Update analyses with successful results
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

      setAnalysesInStore(captureId, newAnalyses);

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
      setAnalysisLoading(captureId, ANALYSIS_TYPES.SUMMARY, false);
      setAnalysisLoading(captureId, ANALYSIS_TYPES.HIGHLIGHTS, false);
      setAnalysisLoading(captureId, ANALYSIS_TYPES.ACTION_ITEMS, false);
      setAnalysisLoading(captureId, ANALYSIS_TYPES.IDEAS, false);
    }
  };

  return {
    analyses,
    analysisLoading,
    analysisError,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
    setAnalyses: (newAnalyses: Record<AnalysisType, CaptureAnalysis | null>) =>
      setAnalysesInStore(captureId, newAnalyses),
  };
}
