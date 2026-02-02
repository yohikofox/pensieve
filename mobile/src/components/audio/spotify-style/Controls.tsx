// Inspired by https://stackoverflow.com/a/56914186
// Adapted for expo-audio and TypeScript

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../../design-system/tokens';

interface ControlsProps {
  paused: boolean;
  onPressPlay: () => void;
  onPressPause: () => void;
  onBack?: () => void;
  onForward?: () => void;
  forwardDisabled?: boolean;
  backDisabled?: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  paused,
  onPressPlay,
  onPressPause,
  onBack,
  onForward,
  forwardDisabled = false,
  backDisabled = false,
}) => {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity onPress={onBack} disabled={backDisabled}>
          <Feather
            name="skip-back"
            size={32}
            color={backDisabled ? colors.neutral[300] : colors.neutral[900]}
          />
        </TouchableOpacity>
      )}

      <View style={styles.playButton}>
        {paused ? (
          <TouchableOpacity onPress={onPressPlay}>
            <Feather name="play" size={48} color={colors.neutral[0]} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onPressPause}>
            <Feather name="pause" size={48} color={colors.neutral[0]} />
          </TouchableOpacity>
        )}
      </View>

      {onForward && (
        <TouchableOpacity onPress={onForward} disabled={forwardDisabled}>
          <Feather
            name="skip-forward"
            size={32}
            color={forwardDisabled ? colors.neutral[300] : colors.neutral[900]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 32,
  },
  playButton: {
    height: 72,
    width: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
