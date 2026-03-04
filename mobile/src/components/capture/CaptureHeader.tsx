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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.success(t("capture.header.transcriptionStarted"));
    } catch (error) {
      console.error("[CaptureHeader] Failed to enqueue:", error);
      toast.error(t("capture.header.transcriptionError"));
    }
  };

  // Determine compact status label and colors
  const getStatusBadge = () => {
    if (!isAudio) return null;

    if (isReady) {
      return {
        icon: StatusIcons.success,
        color: isDark ? colors.success[400] : colors.success[700],
        bg: themeColors.statusReadyBg,
        label: t("capture.header.transcriptionComplete"),
      };
    }
    if (capture.state === "processing") {
      return {
        icon: null as null,
        color: isDark ? colors.info[400] : colors.info[700],
        bg: themeColors.statusProcessingBg,
        label: t("capture.header.transcribing"),
      };
    }
    if (capture.state === "failed") {
      return {
        icon: StatusIcons.error,
        color: isDark ? colors.error[400] : colors.error[700],
        bg: themeColors.statusFailedBg,
        label: t("capture.header.transcriptionFailed"),
      };
    }
    if (capture.state === "captured" && hasModelAvailable === false && !capture.normalizedText) {
      return {
        icon: StatusIcons.error,
        color: isDark ? colors.error[400] : colors.error[700],
        bg: isDark ? colors.error[900] : colors.error[50],
        label: t("capture.header.modelRequired"),
      };
    }
    if (capture.state === "captured") {
      return {
        icon: StatusIcons.pending,
        color: isDark ? colors.warning[400] : colors.warning[700],
        bg: themeColors.statusPendingBg,
        label: autoTranscriptionEnabled
          ? t("capture.header.awaitingTranscription")
          : t("capture.header.manualTranscription"),
      };
    }
    return null;
  };

  const statusBadge = getStatusBadge();

  return (
    <View style={styles.container}>
      {/* Compact info row: icon · type · date · duration · status */}
      <View style={styles.compactRow}>
        {/* Type icon */}
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
            size={16}
            color={isAudio ? colors.primary[500] : colors.secondary[500]}
          />
        </View>

        {/* Info text */}
        <Text
          style={[styles.infoText, { color: themeColors.textPrimary }]}
          numberOfLines={1}
        >
          {isAudio ? t("capture.header.audioRecording") : t("capture.header.textNote")}
          {" · "}
          {formatDate(capture.createdAt)}
          {isAudio && capture.duration
            ? ` · ${formatDuration(capture.duration)}`
            : ""}
        </Text>

        {/* Compact status badge */}
        {statusBadge && (
          <View
            style={[styles.compactBadge, { backgroundColor: statusBadge.bg }]}
          >
            {capture.state === "processing" ? (
              <ActivityIndicator size="small" color={statusBadge.color} />
            ) : statusBadge.icon ? (
              <Feather
                name={statusBadge.icon}
                size={12}
                color={statusBadge.color}
              />
            ) : null}
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
              {t("capture.header.downloadModel")}
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
              {t("capture.header.startTranscription")}
            </Button>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  compactBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  actionContainer: {
    marginTop: 8,
  },
});
