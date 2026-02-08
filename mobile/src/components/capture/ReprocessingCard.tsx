/**
 * ReprocessingCard Component
 *
 * Debug tool for reprocessing captures:
 * - Re-transcribe with Whisper
 * - Re-post-process with LLM
 * - Display current processing status
 *
 * Story 5.4: Autonomous component - uses hooks directly, no prop drilling
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { CaptureIcons, NavigationIcons } from "../../design-system/icons";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useReprocessing } from "../../hooks/useReprocessing";

export function ReprocessingCard() {
  const debugMode = useSettingsStore((state) => state.debugMode);
  // Autonomous hook - reads from stores
  const { reprocessing, handleReTranscribe, handleRePostProcess } = useReprocessing();
  const capture = useCaptureDetailStore((state) => state.capture);
  const isAudio = useCaptureDetailStore((state) => state.isAudio);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const { themeColors, isDark } = useCaptureTheme();
  const [showReprocess, setShowReprocess] = useState(false);

  // Component manages its own visibility conditions
  if (!debugMode) return null;
  if (!capture) return null;
  if (!isAudio || capture.state !== "ready") return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.reprocessBg,
          borderColor: themeColors.reprocessBorder,
        },
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setShowReprocess(!showReprocess)}
      >
        <View style={styles.titleRow}>
          <Feather
            name="tool"
            size={18}
            color={isDark ? colors.warning[500] : colors.warning[700]}
          />
          <Text
            style={[
              styles.title,
              { color: themeColors.reprocessTitle },
            ]}
          >
            Retraitement
          </Text>
        </View>
        <Feather
          name={
            showReprocess ? NavigationIcons.down : NavigationIcons.forward
          }
          size={16}
          color={isDark ? colors.warning[500] : colors.warning[600]}
        />
      </Pressable>
      {showReprocess && (
        <View
          style={[
            styles.content,
            {
              backgroundColor: themeColors.reprocessContentBg,
              borderTopColor: themeColors.reprocessBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.info,
              { color: themeColors.reprocessText },
            ]}
          >
            Outils de debug pour relancer le pipeline de traitement.
          </Text>

          {/* Status info */}
          <View
            style={[
              styles.status,
              {
                backgroundColor: themeColors.reprocessStatusBg,
                borderColor: themeColors.reprocessStatusBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.statusLabel,
                { color: themeColors.reprocessStatusLabel },
              ]}
            >
              État actuel:
            </Text>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusValue,
                  { color: themeColors.reprocessStatusValue },
                ]}
              >
                • raw_transcript:{" "}
              </Text>
              {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value ? (
                <Text
                  style={[
                    styles.statusValue,
                    { color: themeColors.reprocessStatusValue },
                  ]}
                >
                  {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value?.length}{" "}
                  chars
                </Text>
              ) : (
                <View style={styles.statusMissing}>
                  <Feather
                    name="x-circle"
                    size={12}
                    color={colors.error[500]}
                  />
                  <Text
                    style={[
                      styles.statusMissingText,
                      { color: themeColors.reprocessStatusError },
                    ]}
                  >
                    absent
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusValue,
                  { color: themeColors.reprocessStatusValue },
                ]}
              >
                • normalizedText:{" "}
              </Text>
              {capture.normalizedText ? (
                <Text
                  style={[
                    styles.statusValue,
                    { color: themeColors.reprocessStatusValue },
                  ]}
                >
                  {capture.normalizedText.length} chars
                </Text>
              ) : (
                <View style={styles.statusMissing}>
                  <Feather
                    name="x-circle"
                    size={12}
                    color={colors.error[500]}
                  />
                  <Text
                    style={[
                      styles.statusMissingText,
                      { color: themeColors.reprocessStatusError },
                    ]}
                  >
                    absent
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              <Text
                style={[
                  styles.statusValue,
                  { color: themeColors.reprocessStatusValue },
                ]}
              >
                • LLM model:{" "}
              </Text>
              {metadata[METADATA_KEYS.LLM_MODEL]?.value ? (
                <Text
                  style={[
                    styles.statusValue,
                    { color: themeColors.reprocessStatusValue },
                  ]}
                >
                  {metadata[METADATA_KEYS.LLM_MODEL]?.value}
                </Text>
              ) : (
                <View style={styles.statusMissing}>
                  <Feather
                    name="x-circle"
                    size={12}
                    color={colors.error[500]}
                  />
                  <Text
                    style={[
                      styles.statusMissingText,
                      { color: themeColors.reprocessStatusError },
                    ]}
                  >
                    non appliqué
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Re-transcribe button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: themeColors.reprocessButtonTranscribe },
            ]}
            onPress={handleReTranscribe}
            disabled={reprocessing.transcribe}
          >
            {reprocessing.transcribe ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather
                  name={CaptureIcons.voice}
                  size={24}
                  color={colors.neutral[0]}
                  style={styles.buttonIcon}
                />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonTitle}>
                    Re-transcrire
                  </Text>
                  <Text style={styles.buttonDesc}>
                    Relance Whisper sur l'audio
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Re-post-process button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: themeColors.reprocessButtonPostProcess },
            ]}
            onPress={handleRePostProcess}
            disabled={
              reprocessing.postProcess ||
              !metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value
            }
          >
            {reprocessing.postProcess ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather
                  name="cpu"
                  size={24}
                  color={colors.neutral[0]}
                  style={styles.buttonIcon}
                />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonTitle}>
                    Re-post-traiter
                  </Text>
                  <Text style={styles.buttonDesc}>
                    {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value
                      ? "Repasse raw_transcript dans le LLM"
                      : "Nécessite raw_transcript"}
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Info about analysis */}
          <View style={styles.noteContainer}>
            <Feather
              name="info"
              size={14}
              color={isDark ? colors.neutral[400] : colors.neutral[500]}
            />
            <Text
              style={[
                styles.note,
                { color: themeColors.reprocessText },
              ]}
            >
              Pour relancer l'analyse IA, utilisez la section "Analyse IA"
              ci-dessus.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E65100",
    marginLeft: 8,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: "#FFE0B2",
    padding: 16,
    backgroundColor: "#FFF8E1",
  },
  info: {
    fontSize: 13,
    color: "#666",
    marginBottom: 16,
    fontStyle: "italic",
  },
  status: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
  },
  statusMissing: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusMissingText: {
    fontSize: 12,
    color: "#EF4444",
    fontFamily: "monospace",
    marginLeft: 4,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDesc: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  note: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginLeft: 6,
    flex: 1,
  },
});
