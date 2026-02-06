/**
 * CaptureAudioPlayerSection
 *
 * Business logic layer for audio playback in capture context.
 * Knows about captures, extracts audio data, and delegates to generic AudioPlayerSection.
 *
 * Responsibilities:
 * - Access capture from store
 * - Validate capture is audio type with content
 * - Extract audio URI and metadata
 * - Manage audio position in store
 * - Delegate rendering to generic AudioPlayerSection
 *
 * Story 5.4 - Separation of Concerns: Business vs Presentation
 */

import React from "react";
import { AudioPlayerSection } from "./AudioPlayerSection";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export interface CaptureAudioPlayerSectionProps {
  onPositionChange?: (positionMs: number) => void;
  onPlaybackEnd?: () => void;
}

export function CaptureAudioPlayerSection({
  onPositionChange,
  onPlaybackEnd,
}: CaptureAudioPlayerSectionProps) {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const setAudioPosition = useCaptureDetailStore((state) => state.setAudioPosition);

  // Business logic: validate capture is audio with content
  if (!capture) return null;
  if (capture.type !== "audio") return null;
  if (!capture.rawContent) return null;

  // Handle position change - update store + notify parent if callback provided
  const handlePositionChange = (positionMs: number) => {
    setAudioPosition(positionMs);
    onPositionChange?.(positionMs);
  };

  // Handle playback end - reset position + notify parent if callback provided
  const handlePlaybackEnd = () => {
    setAudioPosition(0);
    onPlaybackEnd?.();
  };

  // Delegate to generic audio player with extracted data
  return (
    <AudioPlayerSection
      audioUri={capture.rawContent}
      captureId={capture.id}
      metadata={metadata}
      onPositionChange={handlePositionChange}
      onPlaybackEnd={handlePlaybackEnd}
    />
  );
}
