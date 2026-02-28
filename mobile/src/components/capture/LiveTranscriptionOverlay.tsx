/**
 * LiveTranscriptionOverlay Component
 *
 * Full-screen overlay for live speech-to-text transcription.
 * Displays a VU meter (animated bars), real-time text (confirmed + partial),
 * and Stop/Cancel controls.
 *
 * Story 8.6 — Transcription Live avec Waveform
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../../design-system/tokens";

// ---------------------------------------------------------------------------
// VU Meter
// ---------------------------------------------------------------------------

const BAR_COUNT = 12;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 48;

interface LiveVUMeterProps {
  volumeLevel: number; // -2 to 10
}

const LiveVUMeter = ({ volumeLevel }: LiveVUMeterProps) => {
  // Each bar has its own Animated.Value — created once, never re-created
  const animatedHeights = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(BAR_MIN_HEIGHT)),
  ).current;

  useEffect(() => {
    const clampedVolume = Math.max(0, Math.min(10, volumeLevel));
    const isInaudible = volumeLevel < 0;

    animatedHeights.forEach((animValue, i) => {
      // Stagger variation so bars look natural rather than all identical
      const variation = 0.6 + ((i % 3) * 0.2);
      const targetHeight = isInaudible
        ? BAR_MIN_HEIGHT
        : BAR_MIN_HEIGHT + (clampedVolume / 10) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) * variation;

      Animated.timing(animValue, {
        toValue: targetHeight,
        duration: 100,
        useNativeDriver: false, // height is not supported by native driver
      }).start();
    });
  }, [volumeLevel, animatedHeights]);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        height: BAR_MAX_HEIGHT + 8,
        gap: 4,
        paddingVertical: 4,
      }}
    >
      {animatedHeights.map((animValue, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6,
            height: animValue,
            backgroundColor: colors.primary[500],
            borderRadius: 3,
          }}
        />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// LiveTranscriptionOverlay
// ---------------------------------------------------------------------------

export interface LiveTranscriptionOverlayProps {
  confirmedText: string;
  partialText: string;
  volumeLevel: number; // -2 à 10
  isSaving: boolean;
  onStop: () => void;
  onCancel: () => void;
}

export const LiveTranscriptionOverlay = ({
  confirmedText,
  partialText,
  volumeLevel,
  isSaving,
  onStop,
  onCancel,
}: LiveTranscriptionOverlayProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);

  const hasText = confirmedText !== "" || partialText !== "";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
      }}
    >
      {/* Title */}
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: "600",
          marginBottom: 24,
        }}
      >
        {t("liveTranscription.title")}
      </Text>

      {/* VU Meter */}
      <LiveVUMeter volumeLevel={volumeLevel} />

      {/* Transcription text zone */}
      <ScrollView
        ref={scrollRef}
        style={{
          width: "100%",
          height: 180,
          marginTop: 24,
          marginBottom: 24,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 12,
        }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {!hasText ? (
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 16,
              fontStyle: "italic",
            }}
          >
            {t("liveTranscription.placeholder")}
          </Text>
        ) : (
          <>
            {confirmedText !== "" && (
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  lineHeight: 24,
                }}
              >
                {confirmedText}
              </Text>
            )}
            {partialText !== "" && (
              <Text
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 16,
                  lineHeight: 24,
                  fontStyle: "italic",
                }}
              >
                {partialText}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Controls */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
        {isSaving ? (
          <ActivityIndicator size="large" color="#FFFFFF" />
        ) : (
          <>
            {/* Cancel */}
            <TouchableOpacity
              onPress={onCancel}
              disabled={isSaving}
              style={{ paddingVertical: 12, paddingHorizontal: 20 }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t("liveTranscription.cancel")}
            >
              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 16,
                  fontWeight: "500",
                }}
              >
                {t("liveTranscription.cancel")}
              </Text>
            </TouchableOpacity>

            {/* Stop / Save */}
            <TouchableOpacity
              onPress={onStop}
              disabled={isSaving}
              style={{
                backgroundColor: colors.primary[500],
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 32,
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t("liveTranscription.stop")}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {isSaving
                  ? t("liveTranscription.saving")
                  : t("liveTranscription.stop")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};
