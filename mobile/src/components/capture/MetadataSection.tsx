/**
 * MetadataSection Component
 *
 * Collapsible section displaying capture transcription metadata
 * Story 5.1 - Refactoring: Extract metadata display responsibility
 */

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NavigationIcons } from "../../design-system/icons";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export function MetadataSection() {
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const showMetadata = useCaptureDetailStore((state) => state.showMetadata);
  const setShowMetadata = useCaptureDetailStore(
    (state) => state.setShowMetadata,
  );

  const { themeColors } = useCaptureTheme();

  if (Object.keys(metadata).length === 0) return null;

  return (
    <View
      style={[
        styles.metadataCard,
        {
          backgroundColor: themeColors.metadataBg,
          borderColor: themeColors.metadataBorder,
        },
      ]}
    >
      <Pressable
        style={styles.metadataHeader}
        onPress={() => setShowMetadata(!showMetadata)}
      >
        <View style={styles.metadataTitleRow}>
          <Feather name="info" size={16} color={themeColors.textSecondary} />
          <Text
            style={[styles.metadataTitle, { color: themeColors.textSecondary }]}
          >
            Métadonnées de transcription
          </Text>
        </View>
        <Feather
          name={showMetadata ? NavigationIcons.down : NavigationIcons.forward}
          size={16}
          color={themeColors.textTertiary}
        />
      </Pressable>
      {showMetadata && (
        <View
          style={[
            styles.metadataContent,
            {
              backgroundColor: themeColors.metadataContentBg,
              borderTopColor: themeColors.metadataBorder,
            },
          ]}
        >
          {metadata[METADATA_KEYS.WHISPER_MODEL]?.value && (
            <View
              style={[
                styles.metadataRow,
                { borderBottomColor: themeColors.borderDefault },
              ]}
            >
              <Text
                style={[
                  styles.metadataLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Moteur de transcription
              </Text>
              <Text
                style={[
                  styles.metadataValue,
                  { color: themeColors.textPrimary },
                ]}
              >
                {metadata[METADATA_KEYS.WHISPER_MODEL]?.value}
              </Text>
            </View>
          )}
          {metadata[METADATA_KEYS.WHISPER_DURATION_MS]?.value && (
            <View
              style={[
                styles.metadataRow,
                { borderBottomColor: themeColors.borderDefault },
              ]}
            >
              <Text
                style={[
                  styles.metadataLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Durée de transcription
              </Text>
              <Text
                style={[
                  styles.metadataValue,
                  { color: themeColors.textPrimary },
                ]}
              >
                {Math.round(
                  (parseInt(
                    metadata[METADATA_KEYS.WHISPER_DURATION_MS]?.value!,
                  ) /
                    1000) *
                    10,
                ) / 10}
                s
              </Text>
            </View>
          )}
          {metadata[METADATA_KEYS.WHISPER_LANGUAGE]?.value && (
            <View
              style={[
                styles.metadataRow,
                { borderBottomColor: themeColors.borderDefault },
              ]}
            >
              <Text
                style={[
                  styles.metadataLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Langue détectée
              </Text>
              <Text
                style={[
                  styles.metadataValue,
                  { color: themeColors.textPrimary },
                ]}
              >
                {metadata[METADATA_KEYS.WHISPER_LANGUAGE]?.value}
              </Text>
            </View>
          )}
          {metadata[METADATA_KEYS.WHISPER_NO_SPEECH_PROB]?.value && (
            <View
              style={[
                styles.metadataRow,
                { borderBottomColor: themeColors.borderDefault },
              ]}
            >
              <Text
                style={[
                  styles.metadataLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Probabilité de silence
              </Text>
              <Text
                style={[
                  styles.metadataValue,
                  { color: themeColors.textPrimary },
                ]}
              >
                {Math.round(
                  parseFloat(
                    metadata[METADATA_KEYS.WHISPER_NO_SPEECH_PROB]?.value!,
                  ) * 100,
                )}
                %
              </Text>
            </View>
          )}
          {metadata[METADATA_KEYS.WHISPER_COMPRESSION_RATIO]?.value && (
            <View
              style={[
                styles.metadataRow,
                { borderBottomColor: themeColors.borderDefault },
              ]}
            >
              <Text
                style={[
                  styles.metadataLabel,
                  { color: themeColors.textSecondary },
                ]}
              >
                Ratio de compression
              </Text>
              <Text
                style={[
                  styles.metadataValue,
                  { color: themeColors.textPrimary },
                ]}
              >
                {parseFloat(
                  metadata[METADATA_KEYS.WHISPER_COMPRESSION_RATIO]?.value!,
                ).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  metadataCard: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  metadataHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  metadataTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metadataTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  metadataContent: {
    borderTopWidth: 1,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  metadataLabel: {
    fontSize: 13,
    flex: 1,
  },
  metadataValue: {
    fontSize: 13,
    fontWeight: "500",
  },
});
