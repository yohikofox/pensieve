/**
 * ProgressBar Component (Story 3.2b - Custom Progress Bar)
 *
 * Custom audio progress bar with:
 * - Tap anywhere to seek
 * - Drag thumb to seek
 * - Smooth visual feedback
 * - Theme support
 */

import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  LayoutChangeEvent,
} from 'react-native';
import { colors } from '../../design-system/tokens';

interface ProgressBarProps {
  /** Current position in seconds */
  value: number;
  /** Total duration in seconds */
  duration: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Callback when user starts seeking */
  onSlidingStart?: () => void;
  /** Callback when value changes during seek */
  onValueChange?: (value: number) => void;
  /** Callback when user finishes seeking */
  onSlidingComplete?: (value: number) => void;
  /** Theme flag */
  isDark: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  duration,
  isPlaying,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
  isDark,
}) => {
  const barWidth = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  /**
   * Calculate value from touch position
   */
  const getValueFromPosition = (x: number): number => {
    if (barWidth.current === 0 || duration === 0) return 0;

    const clampedX = Math.max(0, Math.min(x, barWidth.current));
    const percentage = clampedX / barWidth.current;
    return percentage * duration;
  };

  /**
   * Handle layout to get bar width
   */
  const handleLayout = (event: LayoutChangeEvent) => {
    barWidth.current = event.nativeEvent.layout.width;
  };

  /**
   * Pan responder for drag gestures
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt: GestureResponderEvent) => {
        setIsScrubbing(true);
        if (onSlidingStart) {
          onSlidingStart();
        }

        const x = evt.nativeEvent.locationX;
        const newValue = getValueFromPosition(x);
        setScrubValue(newValue);
        if (onValueChange) {
          onValueChange(newValue);
        }
      },

      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const x = evt.nativeEvent.locationX;
        const newValue = getValueFromPosition(x);
        setScrubValue(newValue);
        if (onValueChange) {
          onValueChange(newValue);
        }
      },

      onPanResponderRelease: (evt: GestureResponderEvent) => {
        const x = evt.nativeEvent.locationX;
        const newValue = getValueFromPosition(x);
        setIsScrubbing(false);
        if (onSlidingComplete) {
          onSlidingComplete(newValue);
        }
      },

      onPanResponderTerminate: () => {
        setIsScrubbing(false);
      },
    })
  ).current;

  // Calculate progress - use scrub value when scrubbing, otherwise real value
  const safeDuration = duration > 0 ? duration : 1;
  const currentValue = isScrubbing ? scrubValue : value;
  const progressRatio = Math.min(1, Math.max(0, currentValue / safeDuration));
  const progressPercentage = `${progressRatio * 100}%`;

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
      testID="progress-bar"
    >
      {/* Background track */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: isDark
              ? colors.neutral[700]
              : colors.neutral[300],
          },
        ]}
      />

      {/* Progress track */}
      <View
        style={[
          styles.progressTrack,
          {
            width: progressPercentage,
            backgroundColor: colors.primary[500],
          },
        ]}
      />

      {/* Thumb */}
      <View
        style={[
          styles.thumb,
          {
            left: progressPercentage,
            backgroundColor: colors.primary[500],
            shadowColor: isDark ? colors.neutral[900] : colors.neutral[900],
          },
        ]}
      />
    </View>
  );
};

const THUMB_SIZE = 16;
const TRACK_HEIGHT = 4;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    width: '100%',
  },
  progressTrack: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    left: 0,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -THUMB_SIZE / 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
});
