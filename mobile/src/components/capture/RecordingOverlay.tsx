import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { formatDuration } from "../../design-system/utils";
import { CalibrationGridWrapper, CalibrationBorder } from "../debug";

interface RecordingOverlayProps {
  duration: number;
  onStop: () => void;
  onCancel: () => void;
  isStopping: boolean;
}

/**
 * Recording Overlay Component
 * Full-screen overlay displayed during voice recording
 */
export const RecordingOverlay = ({
  duration,
  onStop,
  onCancel,
  isStopping,
}: RecordingOverlayProps) => {
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the recording indicator
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View className="flex-1 bg-black/85 justify-center items-center">
      <CalibrationGridWrapper />
      <View className="items-center px-10">
        {/* Recording indicator */}
        <Animated.View
          className="w-[100px] h-[100px] rounded-full bg-error-500/20 justify-center items-center mb-8"
          style={{ transform: [{ scale: pulseAnim }] }}
        >
          <View className="w-10 h-10 rounded-full bg-error-500" />
        </Animated.View>

        {/* Status text */}
        <Text className="text-lg text-white mb-4 font-medium">
          {isStopping
            ? t("capture.recording.isStopping")
            : t("capture.recording.inProgress")}
        </Text>

        {/* Duration display */}
        <Text
          className="text-[64px] font-extralight text-white mb-14"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {formatDuration(duration)}
        </Text>

        {/* Buttons */}
        <View className="flex-row items-center gap-10">
          {isStopping ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <>
              <TouchableOpacity
                className="py-3 px-6"
                onPress={onCancel}
                accessible={true}
                accessibilityLabel={t("common.cancel")}
                accessibilityRole="button"
              >
                <Text className="text-lg text-neutral-400 font-medium">
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>

              <CalibrationBorder>
                <TouchableOpacity
                  className="w-20 h-20 rounded-full bg-error-500 justify-center items-center"
                  style={{
                    shadowColor: "#FF3B30",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                  onPress={onStop}
                  accessible={true}
                  accessibilityLabel={t("capture.recording.stop")}
                  accessibilityRole="button"
                >
                  <View className="w-7 h-7 rounded-sm bg-white" />
                </TouchableOpacity>
              </CalibrationBorder>
            </>
          )}
        </View>
      </View>
    </View>
  );
};
