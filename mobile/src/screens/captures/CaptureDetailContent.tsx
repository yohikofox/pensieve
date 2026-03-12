/**
 * CaptureDetailContent
 *
 * Route vers le bon layout selon le type de capture.
 * Responsabilités : initialisation du store, garde de chargement, switch de type.
 * Tout le chrome (header, action bar, modal satellite) est dans CaptureDetailShell.
 */

import React from "react";
import { useCaptureDetailInit } from "../../hooks/useCaptureDetailInit";
import { useCaptureDetailListener } from "../../hooks/useCaptureDetailListener";
import {
  CaptureDetailLoading,
  CaptureAudioDetailContent,
  CaptureTextDetailContent,
} from "../../components/capture";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export interface CaptureDetailContentProps {
  captureId: string;
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureDetailContent({
  captureId,
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureDetailContentProps) {
  useCaptureDetailInit(captureId);
  useCaptureDetailListener();

  const loading = useCaptureDetailStore((state) => state.loading);
  const captureType = useCaptureDetailStore((state) => state.capture?.type);

  if (loading) {
    return <CaptureDetailLoading />;
  }

  const props = { startAnalysis, highlightIdeaId, highlightTodoId };

  switch (captureType) {
    case "audio":
      return <CaptureAudioDetailContent {...props} />;
    case "text":
      return <CaptureTextDetailContent {...props} />;
    default:
      return null;
  }
}
