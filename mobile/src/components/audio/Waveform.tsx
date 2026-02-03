/**
 * Waveform Component (Story 3.2b - Task 4)
 *
 * Audio waveform visualization with:
 * - Real-time waveform rendering from audio samples
 * - Playback position indicator
 * - Tap-to-seek functionality
 * - Visual distinction for played/unplayed sections
 *
 * Uses expo-audio useAudioSampleListener for native sample access
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAudioSampleListener } from 'expo-audio';
import { colors, spacing, borderRadius } from '../../design-system/tokens';

interface WaveformProps {
  player: any;
  duration: number;
  currentPosition: number;
  onSeek?: (position: number) => void;
  barCount?: number; // Number of bars to display
  height?: number; // Height of waveform container
}

export const Waveform: React.FC<WaveformProps> = ({
  player,
  duration,
  currentPosition,
  onSeek,
  barCount = 60,
  height = 80,
}) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<View>(null);

  /**
   * Listen to audio samples and build waveform data
   */
  useAudioSampleListener(player, useCallback((sample) => {
    if (!sample || !sample.channels || sample.channels.length === 0) {
      return;
    }

    const frames = sample.channels[0].frames; // Use first channel (mono or left)

    if (frames.length === 0) {
      return;
    }

    // Downsample frames to match desired bar count
    const samplesPerBar = Math.ceil(frames.length / barCount);
    const bars: number[] = [];

    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, frames.length);

      // Calculate RMS (Root Mean Square) for this segment
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += frames[j] * frames[j];
      }
      const rms = Math.sqrt(sum / (end - start));

      // Normalize to 0-1 range (frames are already -1 to 1)
      bars.push(rms);
    }

    setWaveformData((prevData) => {
      // Merge new data (keep accumulating samples)
      if (prevData.length === 0) {
        setIsLoading(false);
        return bars;
      }

      // Average with existing data for smoother waveform
      return prevData.map((val, idx) => (val + (bars[idx] || 0)) / 2);
    });
  }, [barCount]));

  /**
   * Handle tap-to-seek
   */
  const handlePress = useCallback(
    (event: any) => {
      if (!onSeek || !containerRef.current) return;

      containerRef.current.measure((x, y, width, height, pageX, pageY) => {
        const locationX = event.nativeEvent.locationX;
        const percentage = Math.max(0, Math.min(1, locationX / width));
        const seekPosition = percentage * duration;
        onSeek(seekPosition);
      });
    },
    [onSeek, duration]
  );

  /**
   * Calculate position indicator percentage
   */
  const positionPercentage = duration > 0 ? (currentPosition / duration) * 100 : 0;

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <View style={[styles.container, { height }]} testID="waveform-loading">
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  }

  /**
   * Render waveform with bars
   */
  return (
    <TouchableWithoutFeedback onPress={handlePress} testID="waveform-touchable">
      <View
        ref={containerRef}
        style={[styles.container, { height }]}
        testID="waveform-container"
      >
        {/* Waveform Bars */}
        <View style={styles.barsContainer} testID="waveform-bars">
          {waveformData.map((amplitude, index) => {
            const barHeight = Math.max(2, amplitude * height * 0.8);
            const isPlayed = (index / barCount) * 100 < positionPercentage;

            return (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isPlayed
                      ? colors.primary[500]
                      : colors.neutral[300],
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Playback Position Indicator */}
        <View
          style={[
            styles.positionIndicator,
            { left: `${positionPercentage}%`, height },
          ]}
          testID="waveform-position-indicator"
        />
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.base, // 8
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
    paddingHorizontal: spacing[1], // 4
    gap: spacing.px, // 1
  },
  bar: {
    flex: 1,
    borderRadius: spacing[0.5], // 2
    minHeight: spacing[0.5], // 2
  },
  positionIndicator: {
    position: 'absolute',
    width: spacing[0.5], // 2
    backgroundColor: colors.error[500],
    opacity: 0.8,
  },
});
