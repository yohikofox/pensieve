/**
 * useReprocessing Hook
 *
 * Completely autonomous hook for reprocessing operations.
 * Reads all data from stores, no parameters needed except optional callback.
 *
 * Manages reprocessing operations for captures:
 * - Re-transcribe: Re-run Whisper transcription
 * - Re-post-process: Re-run LLM post-processing
 *
 * Story 5.4 - Autonomous hook: reads from stores, no prop drilling
 */

import { useState } from "react";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureRepository } from "../contexts/capture/domain/ICaptureRepository";
import type { ICaptureMetadataRepository } from "../contexts/capture/domain/ICaptureMetadataRepository";
import { METADATA_KEYS } from "../contexts/capture/domain/CaptureMetadata.model";
import { TranscriptionQueueService } from "../contexts/Normalization/services/TranscriptionQueueService";
import { PostProcessingService } from "../contexts/Normalization/services/PostProcessingService";
import { useToast } from "../design-system/components";
import { useCaptureDetailStore } from "../stores/captureDetailStore";

interface ReprocessingState {
  transcribe: boolean;
  postProcess: boolean;
}

interface UseReprocessingReturn {
  reprocessing: ReprocessingState;
  handleReTranscribe: () => Promise<void>;
  handleRePostProcess: () => Promise<void>;
}

export function useReprocessing(): UseReprocessingReturn {
  // Read everything from stores - autonomous hook
  const capture = useCaptureDetailStore((state) => state.capture);
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const reloadCapture = useCaptureDetailStore((state) => state.reloadCapture);
  const toast = useToast();
  const [reprocessing, setReprocessing] = useState<ReprocessingState>({
    transcribe: false,
    postProcess: false,
  });

  const handleReTranscribe = async () => {
    if (!capture || capture.type !== "audio") return;

    try {
      setReprocessing((prev) => ({ ...prev, transcribe: true }));
      console.log("[useReprocessing] Re-transcribing capture:", capture.id);

      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      const queueService = container.resolve(TranscriptionQueueService);

      // Reset capture state to trigger re-transcription
      await repository.update(capture.id, {
        state: "captured",
        normalizedText: "",
      });

      // Clear metadata
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(
        TOKENS.ICaptureMetadataRepository,
      );
      await metadataRepository.delete(capture.id, METADATA_KEYS.RAW_TRANSCRIPT);
      await metadataRepository.delete(capture.id, METADATA_KEYS.LLM_MODEL);

      // Enqueue for transcription
      await queueService.enqueue({
        captureId: capture.id,
        audioPath: capture.rawContent,
        audioDuration: capture.duration || undefined,
      });

      toast.success("La capture a été remise en queue pour transcription");

      // Reload capture to see new state (if callback provided)
      await reloadCapture?.();
    } catch (error) {
      console.error("[useReprocessing] Re-transcribe failed:", error);
      toast.error("Impossible de relancer la transcription");
    } finally {
      setReprocessing((prev) => ({ ...prev, transcribe: false }));
    }
  };

  const handleRePostProcess = async () => {
    if (!capture) return;

    try {
      setReprocessing((prev) => ({ ...prev, postProcess: true }));
      console.log("[useReprocessing] Re-post-processing capture:", capture.id);

      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(
        TOKENS.ICaptureMetadataRepository,
      );
      const postProcessingService = container.resolve(PostProcessingService);

      // Get raw text to post-process
      // Priority: metadata RAW_TRANSCRIPT > editedText > normalizedText > rawContent
      let rawTranscript: string | null = null;
      if (capture.type === "text") {
        rawTranscript = editedText || capture.rawContent || null;
      } else {
        rawTranscript =
          (await metadataRepository.get(capture.id, METADATA_KEYS.RAW_TRANSCRIPT))
            ?.value
          || capture.normalizedText
          || null;
      }

      if (!rawTranscript) {
        toast.error("Aucun texte brut disponible pour le post-traitement");
        setReprocessing((prev) => ({ ...prev, postProcess: false }));
        return;
      }

      // Save RAW_TRANSCRIPT if not already stored (needed for original/AI toggle)
      const existingRaw = await metadataRepository.get(
        capture.id,
        METADATA_KEYS.RAW_TRANSCRIPT,
      );
      if (!existingRaw?.value) {
        await metadataRepository.set(
          capture.id,
          METADATA_KEYS.RAW_TRANSCRIPT,
          rawTranscript,
        );
      }

      // Run post-processing
      const normalizedText = await postProcessingService.process(rawTranscript);

      // Update capture with new normalized text
      await repository.update(capture.id, {
        normalizedText,
        state: "ready",
      });

      // Update LLM model metadata
      const llmModelId = postProcessingService.getCurrentModelId();
      if (llmModelId) {
        await metadataRepository.set(
          capture.id,
          METADATA_KEYS.LLM_MODEL,
          llmModelId,
        );
      }

      toast.success("Post-traitement terminé");

      // Reload capture to see new text
      await reloadCapture?.();
    } catch (error) {
      console.error("[useReprocessing] Re-post-process failed:", error);
      toast.error("Impossible de relancer le post-traitement");
    } finally {
      setReprocessing((prev) => ({ ...prev, postProcess: false }));
    }
  };

  return {
    reprocessing,
    handleReTranscribe,
    handleRePostProcess,
  };
}
