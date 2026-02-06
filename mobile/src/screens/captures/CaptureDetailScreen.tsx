/**
 * CaptureDetailScreen - Wrapper for capture detail view
 *
 * This is the wrapper component in the Wrapper + Content pattern.
 * It extracts route parameters and passes them to CaptureDetailContent.
 *
 * Pattern similar to CaptureScreen (wrapper) + CaptureContent.
 */

import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CaptureDetailContent } from "./CaptureDetailContent";

type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: {
    captureId: string;
    startAnalysis?: boolean;
    highlightIdeaId?: string;
    highlightTodoId?: string;
  };
};

type Props = NativeStackScreenProps<CapturesStackParamList, "CaptureDetail">;

/**
 * Wrapper component that extracts route params and delegates to CaptureDetailContent
 */
export function CaptureDetailScreen({ route }: Props) {
  const { captureId, startAnalysis, highlightIdeaId, highlightTodoId } = route.params;

  return (
    <CaptureDetailContent
      captureId={captureId}
      startAnalysis={startAnalysis}
      highlightIdeaId={highlightIdeaId}
      highlightTodoId={highlightTodoId}
    />
  );
}
