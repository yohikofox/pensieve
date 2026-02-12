/**
 * NativeRecognitionDebugCard Component
 *
 * Debug-only collapsible card that displays the full native speech recognition
 * results: all alternatives with confidence scores, segments, and selection reason.
 *
 * Autonomous component - uses hooks directly, no prop drilling.
 * Only visible in debug mode AND when native recognition metadata exists.
 */

import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { NavigationIcons } from "../../design-system/icons";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import {
  NativeRecognitionResultsSchema,
  type NativeRecognitionResults,
} from "../../contexts/capture/domain/NativeRecognitionResults.schema";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

function getConfidenceColor(
  confidence: number | null | undefined,
  isDark: boolean,
): string {
  if (confidence == null) return isDark ? colors.neutral[400] : "#999";
  if (confidence > 0.8) return isDark ? colors.success[400] : colors.success[600];
  if (confidence > 0.5) return isDark ? colors.warning[400] : colors.warning[600];
  return isDark ? colors.error[400] : colors.error[600];
}

function formatConfidence(confidence: number | null | undefined): string {
  if (confidence == null) return "N/A";
  return `${(confidence * 100).toFixed(1)}%`;
}

function formatTime(ms: number): string {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

export function NativeRecognitionDebugCard() {
  const debugMode = useSettingsStore((state) => state.debugMode);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const { themeColors, isDark } = useCaptureTheme();
  const [expanded, setExpanded] = useState(false);

  const rawJson =
    metadata[METADATA_KEYS.NATIVE_RECOGNITION_RESULTS]?.value;

  const parsed = useMemo(() => {
    if (!rawJson) return null;
    try {
      const json = JSON.parse(rawJson);
      const result = NativeRecognitionResultsSchema.safeParse(json);
      if (result.success) return { data: result.data, error: null };
      return { data: null, error: result.error.message };
    } catch (e) {
      return { data: null, error: `JSON parse error: ${e}` };
    }
  }, [rawJson]);

  if (!debugMode) return null;
  if (!rawJson) return null;

  const data: NativeRecognitionResults | null = parsed?.data ?? null;
  const parseError = parsed?.error ?? null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeColors.nativeDebugBg,
          borderColor: themeColors.nativeDebugBorder,
        },
      ]}
    >
      <Pressable
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.titleRow}>
          <Feather
            name="layers"
            size={18}
            color={themeColors.nativeDebugTitle}
          />
          <Text
            style={[styles.title, { color: themeColors.nativeDebugTitle }]}
          >
            Reconnaissance native
          </Text>
          {data && (
            <Text
              style={[styles.badge, { color: themeColors.nativeDebugText }]}
            >
              {data.results.length} alt.
            </Text>
          )}
        </View>
        <Feather
          name={expanded ? NavigationIcons.down : NavigationIcons.forward}
          size={16}
          color={themeColors.nativeDebugTitle}
        />
      </Pressable>

      {expanded && (
        <View
          style={[
            styles.content,
            {
              backgroundColor: themeColors.nativeDebugContentBg,
              borderTopColor: themeColors.nativeDebugBorder,
            },
          ]}
        >
          {parseError && (
            <View style={styles.errorBox}>
              <Feather name="alert-triangle" size={14} color={colors.error[500]} />
              <Text style={[styles.errorText, { color: colors.error[500] }]}>
                Erreur de parsing: {parseError}
              </Text>
            </View>
          )}

          {data && (
            <>
              <Text
                style={[styles.summary, { color: themeColors.nativeDebugText }]}
              >
                {data.results.length} alternative(s), selection #{data.selectedIndex}
              </Text>

              {data.results.map((result, index) => {
                const isSelected = index === data.selectedIndex;
                return (
                  <View
                    key={index}
                    style={[
                      styles.resultItem,
                      isSelected
                        ? {
                            backgroundColor:
                              themeColors.nativeDebugSelectedBg,
                            borderColor:
                              themeColors.nativeDebugSelectedBorder,
                          }
                        : {
                            backgroundColor:
                              themeColors.nativeDebugContentBg,
                            borderColor: themeColors.nativeDebugBorder,
                          },
                    ]}
                  >
                    <View style={styles.resultHeader}>
                      {isSelected ? (
                        <View
                          style={[
                            styles.selectedBadge,
                            {
                              backgroundColor: isDark
                                ? colors.success[800]
                                : colors.success[100],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.selectedBadgeText,
                              {
                                color: isDark
                                  ? colors.success[300]
                                  : colors.success[700],
                              },
                            ]}
                          >
                            SELECTED
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.indexBadge,
                            {
                              backgroundColor: isDark
                                ? colors.neutral[700]
                                : colors.neutral[200],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.indexBadgeText,
                              {
                                color: isDark
                                  ? colors.neutral[400]
                                  : colors.neutral[600],
                              },
                            ]}
                          >
                            #{index}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.confidence,
                          {
                            color: getConfidenceColor(
                              result.confidence,
                              isDark,
                            ),
                          },
                        ]}
                      >
                        {formatConfidence(result.confidence)}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.transcript,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {result.transcript || "(vide)"}
                    </Text>

                    {result.segments && result.segments.length > 0 && (
                      <View style={styles.segmentsContainer}>
                        <Text
                          style={[
                            styles.segmentsTitle,
                            { color: themeColors.nativeDebugText },
                          ]}
                        >
                          Segments:
                        </Text>
                        {result.segments.map((seg, segIdx) => (
                          <Text
                            key={segIdx}
                            style={[
                              styles.segmentText,
                              { color: themeColors.nativeDebugText },
                            ]}
                          >
                            [{formatTime(seg.startTimeMillis)} -{" "}
                            {formatTime(seg.endTimeMillis)}] {seg.segment}{" "}
                            <Text
                              style={{
                                color: getConfidenceColor(
                                  seg.confidence,
                                  isDark,
                                ),
                              }}
                            >
                              ({formatConfidence(seg.confidence)})
                            </Text>
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}

              <View style={styles.reasonContainer}>
                <Feather
                  name="info"
                  size={14}
                  color={themeColors.nativeDebugText}
                />
                <Text
                  style={[
                    styles.reasonText,
                    { color: themeColors.nativeDebugText },
                  ]}
                >
                  {data.selectionReason}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
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
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  badge: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: "italic",
  },
  content: {
    borderTopWidth: 1,
    padding: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
    fontFamily: "monospace",
  },
  summary: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 12,
  },
  resultItem: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  selectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  indexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  indexBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  confidence: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  transcript: {
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  segmentsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.3)",
  },
  segmentsTitle: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  segmentText: {
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 16,
    marginBottom: 2,
  },
  reasonContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  reasonText: {
    fontSize: 12,
    fontStyle: "italic",
    marginLeft: 6,
    flex: 1,
  },
});
