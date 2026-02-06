/**
 * ActionsSection Component
 *
 * Quick actions card for post-processing and re-transcription
 * Story 5.1 - Refactoring: Extract quick actions responsibility
 * Story 5.4 - Refactored to consume stores directly instead of props
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { CaptureIcons } from "../../design-system/icons";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useCurrentTextEditor } from "../../stores/textEditorStore";

interface ActionsSectionProps {
  reprocessing: {
    transcribe: boolean;
    postProcess: boolean;
  };
  onReTranscribe: () => void;
  onRePostProcess: () => void;
}

export function ActionsSection({
  reprocessing,
  onReTranscribe,
  onRePostProcess,
}: ActionsSectionProps) {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const debugMode = useSettingsStore((state) => state.debugMode);
  const { themeColors, isDark } = useCaptureTheme();
  const { editedText } = useCurrentTextEditor(capture?.id || "");

  if (!capture) return null;

  const isAudioCapture = capture.type === "audio";
  const isTextCapture = capture.type === "text";
  const hasRawTranscript = !!metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
  const hasBeenPostProcessed = !!metadata[METADATA_KEYS.LLM_MODEL]?.value;
  const canPostProcess =
    (isAudioCapture && hasRawTranscript) || (isTextCapture && editedText);
  const showPostProcessButton =
    canPostProcess && (!hasBeenPostProcessed || debugMode);
  const showReTranscribeButton = isAudioCapture && debugMode;

  // Only show section if there are actions available
  if (!showPostProcessButton && !showReTranscribeButton) return null;

  return (
    <View
      style={[
        styles.actionsCard,
        {
          backgroundColor: themeColors.actionsBg,
          borderColor: themeColors.actionsBorder,
        },
      ]}
    >
      <View style={styles.actionsHeader}>
        <View style={styles.actionsTitleRow}>
          <Feather
            name="zap"
            size={16}
            color={isDark ? colors.info[400] : colors.info[700]}
          />
          <Text
            style={[
              styles.actionsTitle,
              { color: themeColors.actionsTitle },
            ]}
          >
            Actions rapides
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.actionsContent,
          { backgroundColor: themeColors.actionsContentBg },
        ]}
      >
        {/* Post-processing action */}
        {showPostProcessButton && (
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              { backgroundColor: themeColors.actionButtonBg },
            ]}
            onPress={onRePostProcess}
            disabled={reprocessing.postProcess}
          >
            {reprocessing.postProcess ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>
                    Traitement en cours...
                  </Text>
                  <Text style={styles.actionButtonDesc}>
                    Le LLM analyse le texte
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Feather
                  name="cpu"
                  size={20}
                  color={colors.neutral[0]}
                />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>
                    {hasBeenPostProcessed
                      ? "Re-post-traiter"
                      : "Post-traitement LLM"}
                  </Text>
                  <Text style={styles.actionButtonDesc}>
                    {isTextCapture
                      ? "Améliorer le texte avec l'IA"
                      : "Améliorer la transcription avec l'IA"}
                  </Text>
                </View>
                {hasBeenPostProcessed && debugMode && (
                  <View style={styles.debugBadge}>
                    <Text style={styles.debugBadgeText}>DEBUG</Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Re-transcribe action (audio only, debug only) */}
        {showReTranscribeButton && (
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              {
                backgroundColor: themeColors.reprocessButtonTranscribe,
                marginTop: 12,
              },
            ]}
            onPress={onReTranscribe}
            disabled={reprocessing.transcribe}
          >
            {reprocessing.transcribe ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>
                    Transcription en cours...
                  </Text>
                  <Text style={styles.actionButtonDesc}>
                    Whisper analyse l'audio
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Feather
                  name={CaptureIcons.voice}
                  size={20}
                  color={colors.neutral[0]}
                />
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>
                    Re-transcrire
                  </Text>
                  <Text style={styles.actionButtonDesc}>
                    Relancer Whisper sur l'audio
                  </Text>
                </View>
                <View style={styles.debugBadge}>
                  <Text style={styles.debugBadgeText}>DEBUG</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionsCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  actionsHeader: {
    padding: 12,
  },
  actionsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  actionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  quickActionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    padding: 12,
    minHeight: 56,
  },
  actionButtonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  actionButtonDesc: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.8)",
  },
  debugBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  debugBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
