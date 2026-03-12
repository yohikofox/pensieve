/**
 * CaptureAudioDetailContent
 *
 * Layout dédié aux captures audio : player sticky + tabs Analyse/Transcription.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { CaptureDetailShell } from "./CaptureDetailShell";
import { CaptureAudioPlayerSection } from "./CaptureAudioPlayerSection";
import { CaptureDetailTabs } from "./CaptureDetailTabs";

interface CaptureAudioDetailContentProps {
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureAudioDetailContent({
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureAudioDetailContentProps) {
  return (
    <CaptureDetailShell>
      <View style={styles.content}>
        <CaptureAudioPlayerSection />
        <CaptureDetailTabs
          startAnalysis={startAnalysis}
          highlightIdeaId={highlightIdeaId}
          highlightTodoId={highlightTodoId}
        />
      </View>
    </CaptureDetailShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
});
