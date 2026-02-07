/**
 * useTextEditor Hook
 *
 * Autonomous hook for text editing, saving, and sharing.
 * Reads/writes to unified captureDetailStore.
 *
 * Story 5.1 - Refactoring: Extract text editing responsibility
 * Story 5.4 - Unified store: no more captureId indexing
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
  onCaptureUpdate?: (capture: Capture) => void,
): UseTextEditorReturn {
  const toast = useToast();

  // Read from unified store
  const captureId = useCaptureDetailStore((state) => state.captureId);
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const setCapture = useCaptureDetailStore((state) => state.setCapture);

  // Text editor state from unified store
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const hasChanges = useCaptureDetailStore((state) => state.hasTextChanges);
  const isSaving = useCaptureDetailStore((state) => state.isSavingText);
  const copied = useCaptureDetailStore((state) => state.textCopied);

  // Store setters
  const setEditedText = useCaptureDetailStore((state) => state.setEditedText);
  const setHasChanges = useCaptureDetailStore((state) => state.setHasTextChanges);
  const setIsSaving = useCaptureDetailStore((state) => state.setIsSavingText);
  const setCopied = useCaptureDetailStore((state) => state.setTextCopied);

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

    setEditedText(initialText);
    setHasChanges(false);
  }, [capture, metadata, setEditedText, setHasChanges]);

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
    setEditedText(text);
    const originalText = getOriginalText();
    setHasChanges(text !== originalText);
  };

  const handleSave = async () => {
    if (!capture || !captureId || !hasChanges) return;

    setIsSaving(true);
    Keyboard.dismiss();

    try {
      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );

      // Learn from corrections before saving
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
      setHasChanges(false);

      onCaptureUpdate?.(updatedCapture);

      console.log("[useTextEditor] Transcript saved successfully");
    } catch (error) {
      console.error("[useTextEditor] Failed to save transcript:", error);
      toast.error("Impossible de sauvegarder les modifications");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    const originalText = getOriginalText();
    setEditedText(originalText);
    setHasChanges(false);
    Keyboard.dismiss();
  };

  const handleCopy = async () => {
    if (!capture) return;

    await Clipboard.setStringAsync(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    if (!capture || !captureId) return;

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
    setHasChanges(false);

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
