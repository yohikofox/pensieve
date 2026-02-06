/**
 * useAnalyses Hook
 *
 * Manages LLM analysis generation (Summary, Highlights, Action Items, Ideas)
 * Story 5.1 - Refactoring: Extract analysis responsibility from CaptureDetailScreen
 */

import { useState } from "react";
import { container } from "tsyringe";
import { CaptureAnalysisService } from "../contexts/Normalization/services/CaptureAnalysisService";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import type { ToastService } from "../contexts/common/ui/toast/ToastService";

interface UseAnalysesParams {
  captureId: string;
  toast: ToastService;
  ensureTextSaved: () => Promise<void>;
}

interface UseAnalysesReturn {
  analyses: Record<AnalysisType, CaptureAnalysis | null>;
  analysisLoading: Record<AnalysisType, boolean>;
  analysisError: string | null;
  isAnyAnalysisLoading: boolean;
  handleGenerateAnalysis: (type: AnalysisType) => Promise<void>;
  handleAnalyzeAll: () => Promise<void>;
  setAnalyses: React.Dispatch<React.SetStateAction<Record<AnalysisType, CaptureAnalysis | null>>>;
}

export function useAnalyses({
  captureId,
  toast,
  ensureTextSaved,
}: UseAnalysesParams): UseAnalysesReturn {
  const [analyses, setAnalyses] = useState<
    Record<AnalysisType, CaptureAnalysis | null>
  >({
    [ANALYSIS_TYPES.SUMMARY]: null,
    [ANALYSIS_TYPES.HIGHLIGHTS]: null,
    [ANALYSIS_TYPES.ACTION_ITEMS]: null,
    [ANALYSIS_TYPES.IDEAS]: null,
  });

  const [analysisLoading, setAnalysisLoading] = useState<
    Record<AnalysisType, boolean>
  >({
    [ANALYSIS_TYPES.SUMMARY]: false,
    [ANALYSIS_TYPES.HIGHLIGHTS]: false,
    [ANALYSIS_TYPES.ACTION_ITEMS]: false,
    [ANALYSIS_TYPES.IDEAS]: false,
  });

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isAnyAnalysisLoading = Object.values(analysisLoading).some(Boolean);

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    console.log("[useAnalyses] handleGenerateAnalysis called for:", type);
    setAnalysisLoading((prev) => ({ ...prev, [type]: true }));
    setAnalysisError(null);

    try {
      // Save text to DB if there are unsaved changes (needed for analysis)
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      console.log("[useAnalyses] Calling analysisService.analyze...");
      const result = await analysisService.analyze(captureId, type);
      console.log("[useAnalyses] Analysis result:", result);

      if (result.success) {
        setAnalyses((prev) => ({ ...prev, [type]: result.analysis }));
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
      setAnalysisLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleAnalyzeAll = async () => {
    console.log("[useAnalyses] handleAnalyzeAll called");
    // Set all loading states
    setAnalysisLoading({
      [ANALYSIS_TYPES.SUMMARY]: true,
      [ANALYSIS_TYPES.HIGHLIGHTS]: true,
      [ANALYSIS_TYPES.ACTION_ITEMS]: true,
      [ANALYSIS_TYPES.IDEAS]: true,
    });
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

      setAnalyses(newAnalyses);

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
      setAnalysisLoading({
        [ANALYSIS_TYPES.SUMMARY]: false,
        [ANALYSIS_TYPES.HIGHLIGHTS]: false,
        [ANALYSIS_TYPES.ACTION_ITEMS]: false,
        [ANALYSIS_TYPES.IDEAS]: false,
      });
    }
  };

  return {
    analyses,
    analysisLoading,
    analysisError,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
    setAnalyses,
  };
}
