/**
 * AudioPlayerSection
 *
 * Audio player section for CaptureDetailScreen.
 * Conditionally renders WaveformPlayer or AudioPlayer based on user preference.
 *
 * Extracted from CaptureDetailScreen.tsx to reduce complexity.
 */

import React from "react";
import { View } from "react-native";
import { AudioPlayer } from "../audio/AudioPlayer";
import { WaveformPlayer } from "../audio/WaveformPlayer";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import type { ThemeColors } from "../../hooks/useCaptureTheme";
import type { CaptureMetadata } from "../../contexts/capture/domain/CaptureMetadata.model";

export interface AudioPlayerSectionProps {
  audioUri: string;
  captureId: string;
  metadata: Record<string, CaptureMetadata>;
  audioPlayerType: "waveform" | "simple";
  themeColors: ThemeColors;
  onPositionChange: (positionMs: number) => void;
  onPlaybackEnd: () => void;
}

export function AudioPlayerSection({
  audioUri,
  captureId,
  metadata,
  audioPlayerType,
  themeColors,
  onPositionChange,
  onPlaybackEnd,
}: AudioPlayerSectionProps) {
  return (
    <View style={[styles.audioCard, { backgroundColor: themeColors.cardBg }]}>
      {audioPlayerType === "waveform" ? (
        <WaveformPlayer
          audioUri={audioUri}
          captureId={captureId}
          metadata={metadata}
          onPositionChange={onPositionChange}
          onPlaybackEnd={onPlaybackEnd}
        />
      ) : (
        <AudioPlayer
          audioUri={audioUri}
          onPositionChange={onPositionChange}
          onPlaybackEnd={onPlaybackEnd}
        />
      )}
    </View>
  );
}
