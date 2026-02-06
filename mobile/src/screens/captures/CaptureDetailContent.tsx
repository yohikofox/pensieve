/**
 * CaptureDetailContent - Main content component for capture detail view
 *
 * Features:
 * - Full transcription text display
 * - Copy to clipboard
 * - Share functionality
 * - Audio playback
 * - Delete capture
 * - AI analysis
 *
 * This is the content component in the Wrapper + Content pattern.
 * The wrapper (CaptureDetailScreen) handles route params extraction.
 */

import React, { useEffect } from "react";
import { View, ScrollView } from "react-native";
import { useCaptureDetailInit } from "../../hooks/useCaptureDetailInit";
import { StandardLayout } from "../../components/layouts";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { useSettingsStore } from "../../stores/settingsStore";
import { useNavigation } from "@react-navigation/native";
import { useCaptureDetailListener } from "../../hooks/useCaptureDetailListener";
import {
  ReprocessingCard,
  CaptureHeader,
  MetadataSection,
  RawTranscriptSection,
  ActionsSection,
  ActionBar,
  AnalysisCard,
  CaptureDetailLoading,
  CaptureDetailError,
  CaptureAudioPlayerSection,
  ContentSection,
  DeleteCaptureDialog,
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
  const navigation = useNavigation();

  // Zustand store for capture detail state
  const loading = useCaptureDetailStore((state) => state.loading);
  const isReady = useCaptureDetailStore((state) => state.isReady);
  const setShowAnalysis = useCaptureDetailStore(
    (state) => state.setShowAnalysis,
  );

  // Initialization hook - autonomous, reads and writes to stores
  // Also exposes captureId and reloadCapture in store for useCaptureDetailListener
  useCaptureDetailInit(captureId);

  // Event-driven updates - autonomous, reads from store
  useCaptureDetailListener();

  // Auto-expand analysis section if highlighting an idea or todo
  useEffect(() => {
    if ((highlightIdeaId || highlightTodoId) && isReady) {
      setShowAnalysis(true);
    }
  }, [highlightIdeaId, highlightTodoId, isReady, setShowAnalysis]);

  // Note: Delete dialog managed by DeleteCaptureDialog component (autonomous)

  if (loading) {
    return <CaptureDetailLoading />;
  }

  return (
    <CaptureDetailError onGoBack={() => navigation.goBack()}>
      <StandardLayout>
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
          >
            {/* Header Info */}
            <CaptureHeader />

            {/* Audio Player (Story 3.2b - AC2) - Handles its own business logic */}
            <CaptureAudioPlayerSection />

            {/* Content */}
            <ContentSection />

            {/* Raw Transcript (before LLM) - Show when different from final text */}
            {/* <RawTranscriptSection /> */}

            {/* Metadata Section */}
            {/* <MetadataSection /> */}

            {/* Actions Section - Quick actions for captures - Autonomous */}
            {/* <ActionsSection /> */}

            {/* Analysis Section - Autonomous, calls hooks directly */}
            {/* <AnalysisCard
              startAnalysis={startAnalysis}
              highlightIdeaId={highlightIdeaId}
              highlightTodoId={highlightTodoId}
            /> */}

            {/* Reprocess Section - Debug tools (manages own visibility) */}
            {/* <ReprocessingCard /> */}
          </ScrollView>

          {/* Action Bar - Autonomous */}
          {/* <ActionBar /> */}

          {/* Delete confirmation dialog - Autonomous */}
          {/* <DeleteCaptureDialog /> */}
        </View>
      </StandardLayout>
    </CaptureDetailError>
  );
}
