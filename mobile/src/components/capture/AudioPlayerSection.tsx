/**
 * AudioPlayerSection
 *
 * Generic audio player component - completely agnostic of business entities.
 * Conditionally renders WaveformPlayer or simple AudioPlayer based on user preference.
 *
 * Responsibilities:
 * - Choose between waveform and simple audio player
 * - Apply theme styling
 * - Delegate to appropriate player implementation
 *
 * Does NOT know about:
 * - Captures or any business entities
 * - Store management (receives callbacks)
 * - Business logic (validation, state updates)
 *
 * Story 5.4: Separation of Concerns - Generic Presentation Component
 */

import React from "react";
import { View } from "react-native";
import { AudioPlayer } from "../audio/AudioPlayer";
import { WaveformPlayer } from "../audio/WaveformPlayer";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import type { CaptureMetadata } from "../../contexts/capture/domain/CaptureMetadata.model";

export interface AudioPlayerSectionProps {
  audioUri: string;
  captureId?: string; // Optional: only needed for waveform player
  metadata?: Record<string, CaptureMetadata>; // Optional: only needed for waveform player
  onPositionChange?: (positionMs: number) => void;
  onPlaybackEnd?: () => void;
}

export function AudioPlayerSection({
  audioUri,
  captureId,
  metadata,
  onPositionChange,
  onPlaybackEnd,
}: AudioPlayerSectionProps) {
  const audioPlayerType = useSettingsStore((state) => state.audioPlayerType);
  const { themeColors } = useCaptureTheme();

  return (
    <View style={[styles.audioCard, { backgroundColor: themeColors.cardBg }]}>
      {audioPlayerType === "waveform" && captureId && metadata ? (
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
