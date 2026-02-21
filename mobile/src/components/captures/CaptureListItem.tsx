/**
 * CaptureListItem - Wrapper for individual capture items in the list
 * Handles animations, gestures (swipe, long-press), and delegates to CaptureCard
 * Story 6.4 - AC6: Shows CaptureSyncBadge overlay when capture is not synced
 */
import React from "react";
import { View, Text } from "react-native";
import { LongPressGestureHandler, State } from "react-native-gesture-handler";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { AnimatedCaptureCard } from "../animations/AnimatedCaptureCard";
import { SwipeableCard } from "../cards/SwipeableCard";
import { CaptureCard } from "./CaptureCard";
import { CaptureSyncBadge } from "../CaptureSyncBadge";

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
};

type CaptureWithQueue = Capture & {
  isInQueue?: boolean;
};

interface CaptureListItemProps {
  item: CaptureWithTranscription;
  index: number;
  /** false = pas d'animation fade-in (ex: carte venant de remplacer un skeleton) */
  animated?: boolean;
  isReduceMotionEnabled: boolean;
  playback: {
    isPlaying: boolean;
    isPlayingWav: boolean;
    hasModelAvailable: boolean | null;
  };
  handlers: {
    onPress: () => void;
    onStop: () => void;
    onPlayPause: () => void;
    onTranscribe: () => void;
    onRetry: () => void;
    onPlayWav?: () => void;
    onDeleteWav?: () => void;
    onLongPress: () => void;
    onDelete: () => void;
    onShare: () => void;
  };
}

export function CaptureListItem({
  item,
  index,
  animated = true,
  isReduceMotionEnabled,
  playback,
  handlers,
}: CaptureListItemProps) {
  const { onLongPress, onDelete, onShare, ...cardHandlers } = handlers;
  const isProcessing =
    item.state === "processing" ||
    (item as CaptureWithQueue).isInQueue === true;

  return (
    <AnimatedCaptureCard
      index={index}
      enabled={!isReduceMotionEnabled && animated}
    >
      <LongPressGestureHandler
        minDurationMs={300}
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE) {
            onLongPress();
          }
        }}
      >
        <View>
          <SwipeableCard
            onDelete={onDelete}
            onShare={onShare}
            enabled={!isProcessing}
          >
            <CaptureCard
              item={item as CaptureWithQueue}
              playback={playback}
              handlers={cardHandlers}
            />
          </SwipeableCard>
          {/* Story 6.4 - AC6: Sync status badge (top-right overlay) */}
          <View
            style={{ position: "absolute", top: 8, right: 8 }}
            pointerEvents="none"
          >
            <CaptureSyncBadge capture={item} />
          </View>
        </View>
      </LongPressGestureHandler>
    </AnimatedCaptureCard>
  );
}
