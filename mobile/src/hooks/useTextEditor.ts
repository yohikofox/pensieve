/**
 * useTextEditor Hook
 *
 * Completely autonomous hook for text editing, saving, and sharing.
 * Reads all data from stores, no parameters needed except optional callback.
 *
 * Story 5.1 - Refactoring: Extract text editing responsibility
 * Story 5.4 - Autonomous hook: reads from stores, no prop drilling
 */

import { useEffect } from "react";
import { Keyboard, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { container } from "tsyringe";
import { TOKENS } from "../infrastructure/di/tokens";
import type { ICaptureRepository } from "../contexts/capture/domain/ICaptureRepository";
import type { Capture } from "../contexts/capture/domain/Capture.model";
import { METADATA_KEYS } from "../contexts/capture/domain/CaptureMetadata.model";
import { CorrectionLearningService } from "../contexts/Normalization/services/CorrectionLearningService";
import { useTextEditorStore, useCurrentTextEditor } from "../stores/textEditorStore";
import { useCaptureDetailStore } from "../stores/captureDetailStore";
import { useToast } from "../design-system/components";

interface UseTextEditorReturn {
  editedText: string;
  hasChanges: boolean;
  isSaving: boolean;
  copied: boolean;
  handleTextChange: (text: string) => void;
  handleSave: () => Promise<void>;
  handleDiscardChanges: () => void;
  handleCopy: () => Promise<void>;
  handleShare: () => Promise<void>;
  ensureTextSaved: () => Promise<void>;
}

export function useTextEditor(
  onCaptureUpdate?: (capture: Capture) => void
): UseTextEditorReturn {
  // Read everything from stores - autonomous hook
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const setCapture = useCaptureDetailStore((state) => state.setCapture);
  const toast = useToast();

  const captureId = capture?.id || "";

  // Use store for editor state
  const { editedText, hasChanges, isSaving, copied } = useCurrentTextEditor(captureId);
  const setEditedText = useTextEditorStore((state) => state.setEditedText);
  const setHasChanges = useTextEditorStore((state) => state.setHasChanges);
  const setIsSaving = useTextEditorStore((state) => state.setIsSaving);
  const setCopied = useTextEditorStore((state) => state.setCopied);

  // Initialize edited text when capture loads
  useEffect(() => {
    if (!capture) return;

    const isAudioCapture = capture.type === "audio";
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
    const initialText =
      capture.normalizedText ||
      rawTranscript ||
      (isAudioCapture ? "" : capture.rawContent) ||
      "";

    setEditedText(captureId, initialText);
    setHasChanges(captureId, false);
  }, [capture, metadata, captureId, setEditedText, setHasChanges]);

  const getOriginalText = (): string => {
    if (!capture) return "";
    const isAudioCapture = capture.type === "audio";
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
    return (
      capture.normalizedText ||
      rawTranscript ||
      (isAudioCapture ? "" : capture.rawContent) ||
      ""
    );
  };

  const handleTextChange = (text: string) => {
    setEditedText(captureId, text);
    const originalText = getOriginalText();
    setHasChanges(captureId, text !== originalText);
  };

  const handleSave = async () => {
    if (!capture || !hasChanges) return;

    setIsSaving(captureId, true);
    Keyboard.dismiss();

    try {
      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );

      // Learn from corrections before saving (passive vocabulary learning)
      const originalText = getOriginalText();
      if (originalText !== editedText) {
        await CorrectionLearningService.learn(
          originalText,
          editedText,
          captureId,
        );
      }

      await repository.update(captureId, {
        normalizedText: editedText,
      });

      // Update store
      const updatedCapture = { ...capture, normalizedText: editedText };
      setCapture(updatedCapture);
      setHasChanges(captureId, false);

      // Notify parent if callback provided
      onCaptureUpdate?.(updatedCapture);

      console.log("[useTextEditor] Transcript saved successfully");
    } catch (error) {
      console.error("[useTextEditor] Failed to save transcript:", error);
      toast.error("Impossible de sauvegarder les modifications");
    } finally {
      setIsSaving(captureId, false);
    }
  };

  const handleDiscardChanges = () => {
    const originalText = getOriginalText();
    setEditedText(captureId, originalText);
    setHasChanges(captureId, false);
    Keyboard.dismiss();
  };

  const handleCopy = async () => {
    if (!capture) return;

    await Clipboard.setStringAsync(editedText);
    setCopied(captureId, true);
    setTimeout(() => setCopied(captureId, false), 2000);
  };

  const handleShare = async () => {
    if (!capture) return;

    try {
      await Share.share({
        message: editedText,
        title: "Partager ma pensée",
      });
    } catch (error) {
      console.error("[useTextEditor] Share failed:", error);
    }
  };

  const ensureTextSaved = async () => {
    if (!capture) return;

    // For text captures, always ensure normalizedText is set (even if no changes)
    // This handles old notes created before normalizedText was set automatically
    const needsSave =
      hasChanges ||
      (capture.type === "text" && !capture.normalizedText && editedText);
    if (!needsSave) return;

    console.log("[useTextEditor] Saving text before analysis...", {
      hasChanges,
      isText: capture.type === "text",
      hasNormalizedText: !!capture.normalizedText,
      hasEditedText: !!editedText,
    });

    const repository = container.resolve<ICaptureRepository>(
      TOKENS.ICaptureRepository,
    );
    await repository.update(captureId, {
      normalizedText: editedText,
    });

    // Update store
    const updatedCapture = { ...capture, normalizedText: editedText };
    setCapture(updatedCapture);
    setHasChanges(captureId, false);

    // Notify parent if callback provided
    onCaptureUpdate?.(updatedCapture);
  };

  return {
    editedText,
    hasChanges,
    isSaving,
    copied,
    handleTextChange,
    handleSave,
    handleDiscardChanges,
    handleCopy,
    handleShare,
    ensureTextSaved,
  };
}
