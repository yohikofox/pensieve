/**
 * AudioPlayerSection
 *
 * Audio player section for CaptureDetailScreen.
 * Conditionally renders WaveformPlayer or AudioPlayer based on user preference.
 *
 * Extracted from CaptureDetailScreen.tsx to reduce complexity.
 * Story 5.4: Refactored to consume stores directly instead of props.
 */

import React from "react";
import { View } from "react-native";
import { AudioPlayer } from "../audio/AudioPlayer";
import { WaveformPlayer } from "../audio/WaveformPlayer";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export interface AudioPlayerSectionProps {
  onPositionChange: (positionMs: number) => void;
  onPlaybackEnd: () => void;
}

export function AudioPlayerSection({
  onPositionChange,
  onPlaybackEnd,
}: AudioPlayerSectionProps) {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const audioPlayerType = useSettingsStore((state) => state.audioPlayerType);
  const { themeColors } = useCaptureTheme();

  if (!capture?.rawContent) return null;

  return (
    <View style={[styles.audioCard, { backgroundColor: themeColors.cardBg }]}>
      {audioPlayerType === "waveform" ? (
        <WaveformPlayer
          audioUri={capture.rawContent}
          captureId={capture.id}
          metadata={metadata}
          onPositionChange={onPositionChange}
          onPlaybackEnd={onPlaybackEnd}
        />
      ) : (
        <AudioPlayer
          audioUri={capture.rawContent}
          onPositionChange={onPositionChange}
          onPlaybackEnd={onPlaybackEnd}
        />
      )}
    </View>
  );
}
