/**
 * useAnalyses Hook
 *
 * Autonomous hook for LLM analysis management.
 * Reads/writes to unified captureDetailStore.
 *
 * Story 5.1 - Refactoring: Extract analysis responsibility
 * Story 5.4 - Unified store: no more captureId indexing
 * Story 16.3 - Queue asynchrone: enqueue via AnalysisQueueService + EventBus subscription
 */

import { useEffect, useState } from "react";
import { container } from "tsyringe";
import { AnalysisQueueService } from "../contexts/Normalization/services/AnalysisQueueService";
import { eventBus } from "../contexts/shared/events/EventBus";
import type {
  AnalysisCompletedEvent,
  AnalysisFailedEvent,
  AnalysisStartedEvent,
} from "../contexts/Normalization/events/AnalysisEvents";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../contexts/capture/domain/CaptureAnalysis.model";
import { useTextEditor } from "./useTextEditor";
import { useCaptureDetailStore } from "../stores/captureDetailStore";
import { useToast } from "../design-system/components";
import type { AnalysisQueueStatus } from "../contexts/Normalization/services/AnalysisQueueService";

interface UseAnalysesReturn {
  analyses: Record<AnalysisType, CaptureAnalysis | null>;
  analysisLoading: Record<AnalysisType, boolean>;
  analysisQueueStatus: Record<AnalysisType, AnalysisQueueStatus>;
  analysisError: string | null;
  isAnyAnalysisLoading: boolean;
  handleGenerateAnalysis: (type: AnalysisType) => void;
  handleAnalyzeAll: () => void;
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

  // Queue status per analysis type — initialized from the real queue state on mount (H1: AC3/AC5)
  const [analysisQueueStatus, setAnalysisQueueStatus] = useState<
    Record<AnalysisType, AnalysisQueueStatus>
  >(() => {
    if (!captureId) {
      return {
        [ANALYSIS_TYPES.SUMMARY]: 'idle',
        [ANALYSIS_TYPES.HIGHLIGHTS]: 'idle',
        [ANALYSIS_TYPES.ACTION_ITEMS]: 'idle',
        [ANALYSIS_TYPES.IDEAS]: 'idle',
      };
    }
    return container.resolve(AnalysisQueueService).getQueueStatus(captureId);
  });

  // Re-sync queue status when captureId changes (navigation between captures)
  useEffect(() => {
    if (!captureId) return;
    setAnalysisQueueStatus(
      container.resolve(AnalysisQueueService).getQueueStatus(captureId),
    );
  }, [captureId]);

  const isAnyAnalysisLoading = Object.values(analysisLoading).some(Boolean);

  /**
   * Subscribe to AnalysisCompleted and AnalysisFailed events for the current capture.
   * Updates store and queue status when events arrive.
   */
  useEffect(() => {
    if (!captureId) return;

    // Transition queued → processing when the worker starts an item (M4)
    const startedSub = eventBus.subscribe<AnalysisStartedEvent>(
      'AnalysisStarted',
      (event) => {
        if (event.payload.captureId !== captureId) return;
        setAnalysisQueueStatus((prev) => ({
          ...prev,
          [event.payload.analysisType]: 'processing',
        }));
      },
    );

    const completedSub = eventBus.subscribe<AnalysisCompletedEvent>(
      'AnalysisCompleted',
      (event) => {
        if (event.payload.captureId !== captureId) return;

        const { analysisType, result } = event.payload;

        // Update loading state off
        setAnalysisLoading(analysisType, false);

        // Update queue status
        setAnalysisQueueStatus((prev) => ({
          ...prev,
          [analysisType]: 'idle',
        }));

        if (result.success) {
          setAnalysis(analysisType, result.analysis);
        } else {
          setAnalysisError(result.error);
          toast.error(result.error ?? "Erreur d'analyse");
        }
      },
    );

    const failedSub = eventBus.subscribe<AnalysisFailedEvent>(
      'AnalysisFailed',
      (event) => {
        if (event.payload.captureId !== captureId) return;

        const { analysisType, error } = event.payload;

        setAnalysisLoading(analysisType, false);
        setAnalysisQueueStatus((prev) => ({
          ...prev,
          [analysisType]: 'idle',
        }));
        setAnalysisError(error);
        toast.error(error);
      },
    );

    return () => {
      startedSub.unsubscribe();
      completedSub.unsubscribe();
      failedSub.unsubscribe();
    };
  }, [captureId, setAnalysis, setAnalysisLoading, toast]);

  const handleGenerateAnalysis = (type: AnalysisType): void => {
    if (!captureId) return;

    console.log("[useAnalyses] handleGenerateAnalysis (enqueue):", type);
    setAnalysisError(null);

    // Snapshot captureId to guard against navigation during async text save (M3)
    const captureIdSnapshot = captureId;

    ensureTextSaved().then(() => {
      // Guard: abort if the user navigated to a different capture during text save
      if (useCaptureDetailStore.getState().captureId !== captureIdSnapshot) return;

      const queueService = container.resolve(AnalysisQueueService);

      if (queueService.isInQueue(captureIdSnapshot, type)) {
        console.log("[useAnalyses] Already in queue, ignoring:", type);
        return;
      }

      setAnalysisLoading(type, true);
      setAnalysisQueueStatus((prev) => ({ ...prev, [type]: 'queued' }));
      queueService.enqueue(captureIdSnapshot, type);
    });
  };

  const handleAnalyzeAll = (): void => {
    if (!captureId) return;

    console.log("[useAnalyses] handleAnalyzeAll (enqueue all)");
    setAnalysisError(null);

    // Snapshot captureId to guard against navigation during async text save (M3)
    const captureIdSnapshot = captureId;

    ensureTextSaved().then(() => {
      // Guard: abort if the user navigated to a different capture during text save
      if (useCaptureDetailStore.getState().captureId !== captureIdSnapshot) return;

      const queueService = container.resolve(AnalysisQueueService);
      const types = Object.values(ANALYSIS_TYPES) as AnalysisType[];

      for (const type of types) {
        if (!queueService.isInQueue(captureIdSnapshot, type)) {
          setAnalysisLoading(type, true);
          setAnalysisQueueStatus((prev) => ({ ...prev, [type]: 'queued' }));
          queueService.enqueue(captureIdSnapshot, type);
        }
      }
    });
  };

  return {
    analyses,
    analysisLoading,
    analysisQueueStatus,
    analysisError,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
    setAnalyses: setAnalysesInStore,
  };
}
