/**
 * RawTranscriptSection Component
 *
 * Collapsible section showing raw Whisper transcription before LLM normalization
 * Story 5.1 - Refactoring: Extract raw transcript display responsibility
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { CaptureIcons, NavigationIcons } from "../../design-system/icons";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export function RawTranscriptSection() {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const showRawTranscript = useCaptureDetailStore((state) => state.showRawTranscript);
  const setShowRawTranscript = useCaptureDetailStore((state) => state.setShowRawTranscript);

  const { themeColors, isDark } = useCaptureTheme();

  if (!capture) return null;

  const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
  const shouldShow = rawTranscript && rawTranscript !== capture.normalizedText;

  if (!shouldShow) return null;

  return (
    <View
      style={[
        styles.rawTranscriptCard,
        {
          backgroundColor: themeColors.metadataBg,
          borderColor: themeColors.metadataBorder,
        },
      ]}
    >
      <Pressable
        style={styles.rawTranscriptHeader}
        onPress={() => setShowRawTranscript(!showRawTranscript)}
      >
        <View style={styles.rawTranscriptTitleRow}>
          <Feather
            name={CaptureIcons.voice}
            size={16}
            color={themeColors.textSecondary}
          />
          <Text
            style={[
              styles.rawTranscriptTitle,
              { color: themeColors.textSecondary },
            ]}
          >
            Transcription brute (Whisper)
          </Text>
        </View>
        <Feather
          name={
            showRawTranscript
              ? NavigationIcons.down
              : NavigationIcons.forward
          }
          size={16}
          color={themeColors.textTertiary}
        />
      </Pressable>
      {showRawTranscript && (
        <View
          style={[
            styles.rawTranscriptContent,
            {
              backgroundColor: themeColors.metadataContentBg,
              borderTopColor: themeColors.metadataBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.rawTranscriptText,
              { color: themeColors.textSecondary },
            ]}
            selectable
          >
            {rawTranscript}
          </Text>
          <View
            style={[
              styles.rawTranscriptBadge,
              {
                backgroundColor: isDark
                  ? colors.success[900]
                  : "#E8F5E9",
              },
            ]}
          >
            <Feather
              name="zap"
              size={12}
              color={isDark ? colors.success[400] : colors.success[600]}
            />
            <Text
              style={[
                styles.rawTranscriptBadgeText,
                {
                  color: isDark
                    ? colors.success[400]
                    : colors.success[600],
                },
              ]}
            >
              Amélioré par IA
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rawTranscriptCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  rawTranscriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  rawTranscriptTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rawTranscriptTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  rawTranscriptContent: {
    borderTopWidth: 1,
    padding: 12,
  },
  rawTranscriptText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  rawTranscriptBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  rawTranscriptBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
