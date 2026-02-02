// Inspired by https://stackoverflow.com/a/56914186
// Adapted for expo-audio and TypeScript

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors } from '../../../design-system/tokens';

function pad(n: number, width: number, z: string = '0'): string {
  const str = n.toString();
  return str.length >= width ? str : new Array(width - str.length + 1).join(z) + str;
}

const minutesAndSeconds = (position: number): [string, string] => {
  const mins = Math.floor(position / 60);
  const secs = Math.floor(position % 60);
  return [pad(mins, 2), pad(secs, 2)];
};

interface SeekBarProps {
  trackLength: number;
  currentPosition: number;
  onSeek: (time: number) => void;
  onSlidingStart: () => void;
}

export const SeekBar: React.FC<SeekBarProps> = ({
  trackLength,
  currentPosition,
  onSeek,
  onSlidingStart,
}) => {
  const elapsed = minutesAndSeconds(currentPosition);
  const remaining = minutesAndSeconds(trackLength - currentPosition);

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row' }}>
        <Text style={styles.text}>
          {elapsed[0] + ':' + elapsed[1]}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={[styles.text, { width: 40 }]}>
          {trackLength > 1 && '-' + remaining[0] + ':' + remaining[1]}
        </Text>
      </View>
      <Slider
        style={styles.slider}
        maximumValue={Math.max(trackLength, 1, currentPosition + 1)}
        onSlidingStart={onSlidingStart}
        onSlidingComplete={onSeek}
        value={currentPosition}
        minimumTrackTintColor={colors.primary[500]}
        maximumTrackTintColor={colors.neutral[300]}
        thumbTintColor={colors.primary[500]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
  },
  slider: {
    marginTop: -12,
  },
  text: {
    color: colors.neutral[600],
    fontSize: 12,
    textAlign: 'center',
  },
});
