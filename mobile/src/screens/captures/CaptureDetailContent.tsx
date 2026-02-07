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

import React from "react";
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

  // Initialization hook - autonomous, reads and writes to stores
  // Also exposes captureId and reloadCapture in store for useCaptureDetailListener
  useCaptureDetailInit(captureId);

  // Event-driven updates - autonomous, reads from store
  useCaptureDetailListener();

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
            <View style={styles.contentStack}>
              {/* Header Info */}
              <CaptureHeader />

              {/* Audio Player (Story 3.2b - AC2) - Handles its own business logic */}
              <CaptureAudioPlayerSection />

              {/* Content */}
              <ContentSection />

              {/* Raw Transcript (before LLM) - Show when different from final text */}
              <RawTranscriptSection />

              {/* Metadata Section */}
              <MetadataSection />

              {/* Actions Section - Quick actions for captures - Autonomous */}
              <ActionsSection />

              {/* Analysis Section - Autonomous, calls hooks directly */}
              <AnalysisCard
                startAnalysis={startAnalysis}
                highlightIdeaId={highlightIdeaId}
                highlightTodoId={highlightTodoId}
              />

              {/* Reprocess Section - Debug tools (manages own visibility) */}
              <ReprocessingCard />
            </View>
          </ScrollView>

          {/* Action Bar - Autonomous */}
          <ActionBar />

          {/* Delete confirmation dialog - Autonomous */}
          <DeleteCaptureDialog />
        </View>
      </StandardLayout>
    </CaptureDetailError>
  );
}
