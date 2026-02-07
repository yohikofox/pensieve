/**
 * CaptureHeader Component
 *
 * Displays capture metadata, type, status badges, and action buttons
 * Story 5.1 - Refactoring: Extract header responsibility from CaptureDetailScreen
 *
 * Styling: All styles defined in component (self-contained design)
 * Pattern: Same as RawTranscriptSection - compact card with header and dynamic theme
 */

import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { container } from "tsyringe";
import { colors } from "../../design-system/tokens";
import { Button, useToast } from "../../design-system/components";
import {
  CaptureIcons,
  StatusIcons,
  ActionIcons,
} from "../../design-system/icons";
import { formatDate, formatDuration } from "../../utils/formatters";
import { TranscriptionQueueService } from "../../contexts/Normalization/services/TranscriptionQueueService";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export function CaptureHeader() {
  const capture = useCaptureDetailStore((state) => state.capture);
  const hasModelAvailable = useCaptureDetailStore(
    (state) => state.hasModelAvailable,
  );
  const isNativeEngine = useCaptureDetailStore((state) => state.isNativeEngine);

  const autoTranscriptionEnabled = useSettingsStore(
    (state) => state.autoTranscriptionEnabled,
  );
  const { themeColors, isDark } = useCaptureTheme();
  const navigation = useNavigation();
  const toast = useToast();

  if (!capture) return null;

  const isAudio = useCaptureDetailStore((state) => state.isAudio);
  const isReady = useCaptureDetailStore((state) => state.isReady);

  const handleStartTranscription = async () => {
    try {
      const queueService = container.resolve(TranscriptionQueueService);
      await queueService.enqueue({
        captureId: capture.id,
        audioPath: capture.rawContent || "",
        audioDuration: capture.duration ?? undefined,
      });
      toast.success("Transcription lancée");
    } catch (error) {
      console.error("[CaptureHeader] Failed to enqueue:", error);
      toast.error("Échec du lancement de la transcription");
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.cardBg,
          borderColor: themeColors.borderDefault,
        },
      ]}
    >
      <View style={styles.header}>
        {/* Type Row */}
        <View style={styles.typeRow}>
          <View
            style={[
              styles.typeIconContainer,
              {
                backgroundColor: isDark
                  ? isAudio
                    ? colors.primary[900]
                    : colors.secondary[900]
                  : isAudio
                    ? colors.primary[100]
                    : colors.secondary[100],
              },
            ]}
          >
            <Feather
              name={isAudio ? CaptureIcons.voice : ActionIcons.edit}
              size={20}
              color={isAudio ? colors.primary[500] : colors.secondary[500]}
            />
          </View>
          <Text style={[styles.typeLabel, { color: themeColors.textPrimary }]}>
            {isAudio ? "Enregistrement audio" : "Note texte"}
          </Text>
        </View>

        {/* Date */}
        <Text style={[styles.date, { color: themeColors.textMuted }]}>
          {formatDate(capture.createdAt)}
        </Text>

        {/* Duration (audio only) */}
        {isAudio && !!capture.duration && (
          <Text style={[styles.duration, { color: themeColors.textMuted }]}>
            Durée: {formatDuration(capture.duration)}
          </Text>
        )}

        {/* Status Badges (audio only) */}
        {isAudio && (
          <View style={styles.statusRow}>
            {/* Model required badge */}
            {capture.state === "captured" &&
              hasModelAvailable === false &&
              !capture.normalizedText && (
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isDark
                        ? colors.error[900]
                        : colors.error[50],
                    },
                  ]}
                >
                  <Feather
                    name="alert-circle"
                    size={14}
                    color={isDark ? colors.error[400] : colors.error[700]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        marginLeft: 6,
                        color: isDark ? colors.error[300] : colors.error[700],
                      },
                    ]}
                  >
                    Modèle de transcription requis
                  </Text>
                </View>
              )}

            {/* Waiting for transcription */}
            {capture.state === "captured" &&
              (hasModelAvailable === true ||
                hasModelAvailable === null ||
                capture.normalizedText) && (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: themeColors.statusPendingBg },
                  ]}
                >
                  <Feather
                    name={StatusIcons.pending}
                    size={14}
                    color={isDark ? colors.warning[400] : colors.warning[700]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        marginLeft: 6,
                        color: isDark ? colors.warning[300] : colors.warning[700],
                      },
                    ]}
                  >
                    {autoTranscriptionEnabled
                      ? "En attente de transcription"
                      : "Transcription manuelle"}
                  </Text>
                </View>
              )}

            {/* Processing */}
            {capture.state === "processing" && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: themeColors.statusProcessingBg },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color={isDark ? colors.info[400] : colors.info[600]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      marginLeft: 8,
                      color: isDark ? colors.info[300] : colors.info[700],
                    },
                  ]}
                >
                  Transcription en cours...
                </Text>
              </View>
            )}

            {/* Ready */}
            {isReady && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: themeColors.statusReadyBg },
                ]}
              >
                <Feather
                  name={StatusIcons.success}
                  size={14}
                  color={isDark ? colors.success[400] : colors.success[700]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      marginLeft: 6,
                      color: isDark ? colors.success[300] : colors.success[700],
                    },
                  ]}
                >
                  Transcription terminée
                </Text>
              </View>
            )}

            {/* Failed */}
            {capture.state === "failed" && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: themeColors.statusFailedBg },
                ]}
              >
                <Feather
                  name={StatusIcons.error}
                  size={14}
                  color={isDark ? colors.error[400] : colors.error[700]}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      marginLeft: 6,
                      color: isDark ? colors.error[300] : colors.error[700],
                    },
                  ]}
                >
                  Transcription échouée
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Configure Model Button */}
      {isAudio &&
        capture.state === "captured" &&
        !isNativeEngine &&
        hasModelAvailable === false &&
        !capture.normalizedText && (
          <View style={styles.actionContainer}>
            <Button
              variant="secondary"
              size="md"
              onPress={() => {
                navigation.navigate("WhisperSettings" as never);
              }}
            >
              <Feather
                name="download"
                size={18}
                color={isDark ? colors.neutral[100] : colors.neutral[700]}
                style={{ marginRight: 8 }}
              />
              Télécharger un modèle
            </Button>
          </View>
        )}

      {/* Manual Transcription Button */}
      {isAudio &&
        capture.state === "captured" &&
        !capture.normalizedText &&
        (isNativeEngine ||
          (!autoTranscriptionEnabled && hasModelAvailable === true)) && (
          <View style={styles.actionContainer}>
            <Button
              variant="primary"
              size="md"
              onPress={handleStartTranscription}
            >
              <Feather
                name="file-text"
                size={18}
                color={colors.neutral[0]}
                style={{ marginRight: 8 }}
              />
              Lancer la transcription
            </Button>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    padding: 12,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  date: {
    fontSize: 14,
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusRow: {
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "500",
  },
  actionContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    padding: 12,
  },
});
