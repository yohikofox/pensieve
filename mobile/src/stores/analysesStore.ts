/**
 * AnalysesStore
 *
 * Zustand store managing the state of analyses for the current capture
 * Allows multiple hooks and components to share analysis state
 */

import { create } from "zustand";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";

interface AnalysesState {
  // Analysis data per capture
  analyses: Record<string, Record<AnalysisType, CaptureAnalysis | null>>;

  // Loading states per capture
  analysisLoading: Record<string, Record<AnalysisType, boolean>>;

  // Actions
  setAnalysis: (captureId: string, type: AnalysisType, analysis: CaptureAnalysis | null) => void;
  setAnalyses: (captureId: string, analyses: Record<AnalysisType, CaptureAnalysis | null>) => void;
  setAnalysisLoading: (captureId: string, type: AnalysisType, loading: boolean) => void;
  reset: (captureId: string) => void;
}

const initialAnalysesState = {
  [ANALYSIS_TYPES.SUMMARY]: null,
  [ANALYSIS_TYPES.HIGHLIGHTS]: null,
  [ANALYSIS_TYPES.ACTION_ITEMS]: null,
  [ANALYSIS_TYPES.IDEAS]: null,
};

const initialLoadingState = {
  [ANALYSIS_TYPES.SUMMARY]: false,
  [ANALYSIS_TYPES.HIGHLIGHTS]: false,
  [ANALYSIS_TYPES.ACTION_ITEMS]: false,
  [ANALYSIS_TYPES.IDEAS]: false,
};

export const useAnalysesStore = create<AnalysesState>((set) => ({
  analyses: {},
  analysisLoading: {},

  setAnalysis: (captureId, type, analysis) =>
    set((state) => ({
      analyses: {
        ...state.analyses,
        [captureId]: {
          ...(state.analyses[captureId] || initialAnalysesState),
          [type]: analysis,
        },
      },
    })),

  setAnalyses: (captureId, analyses) =>
    set((state) => ({
      analyses: {
        ...state.analyses,
        [captureId]: analyses,
      },
    })),

  setAnalysisLoading: (captureId, type, loading) =>
    set((state) => ({
      analysisLoading: {
        ...state.analysisLoading,
        [captureId]: {
          ...(state.analysisLoading[captureId] || initialLoadingState),
          [type]: loading,
        },
      },
    })),

  reset: (captureId) =>
    set((state) => {
      const newAnalyses = { ...state.analyses };
      const newLoading = { ...state.analysisLoading };
      delete newAnalyses[captureId];
      delete newLoading[captureId];
      return {
        analyses: newAnalyses,
        analysisLoading: newLoading,
      };
    }),
}));

/**
 * Hook to get current capture's analyses
 */
export const useCurrentAnalyses = (captureId: string) => {
  const analyses = useAnalysesStore(
    (state) => state.analyses[captureId] || initialAnalysesState
  );
  const analysisLoading = useAnalysesStore(
    (state) => state.analysisLoading[captureId] || initialLoadingState
  );

  return { analyses, analysisLoading };
};
