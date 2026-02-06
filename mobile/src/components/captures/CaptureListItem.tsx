/**
 * CaptureListItem - Wrapper for individual capture items in the list
 * Handles animations, gestures (swipe, long-press), and delegates to CaptureCard
 */
import React from 'react';
import { View } from 'react-native';
import { LongPressGestureHandler, State } from 'react-native-gesture-handler';
import type { Capture } from '../../contexts/capture/domain/Capture.model';
import { AnimatedCaptureCard } from '../animations/AnimatedCaptureCard';
import { SwipeableCard } from '../cards/SwipeableCard';
import { CaptureCard } from './CaptureCard';

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
};

type CaptureWithQueue = Capture & {
  isInQueue?: boolean;
};

interface CaptureListItemProps {
  item: CaptureWithTranscription;
  index: number;
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
  isReduceMotionEnabled,
  playback,
  handlers,
}: CaptureListItemProps) {
  const { onLongPress, onDelete, onShare, ...cardHandlers } = handlers;

  return (
    <AnimatedCaptureCard index={index} enabled={!isReduceMotionEnabled}>
      <LongPressGestureHandler
        minDurationMs={300}
        onHandlerStateChange={({ nativeEvent }) => {
          if (nativeEvent.state === State.ACTIVE) {
            onLongPress();
          }
        }}
      >
        <View>
          <SwipeableCard onDelete={onDelete} onShare={onShare}>
            <CaptureCard
              item={item as CaptureWithQueue}
              playback={playback}
              handlers={cardHandlers}
            />
          </SwipeableCard>
        </View>
      </LongPressGestureHandler>
    </AnimatedCaptureCard>
  );
}
