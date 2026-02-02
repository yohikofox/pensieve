// Inspired by https://stackoverflow.com/a/56914186
// Adapted for expo-audio and TypeScript

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../../design-system/tokens';

interface TrackDetailsProps {
  title: string;
  artist?: string;
  onTitlePress?: () => void;
  onArtistPress?: () => void;
}

export const TrackDetails: React.FC<TrackDetailsProps> = ({
  title,
  artist,
  onTitlePress,
  onArtistPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.detailsWrapper}>
        <TouchableOpacity onPress={onTitlePress}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </TouchableOpacity>
        {artist && (
          <TouchableOpacity onPress={onArtistPress}>
            <Text style={styles.artist}>{artist}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    flexDirection: 'row',
    paddingLeft: 20,
    alignItems: 'center',
    paddingRight: 20,
  },
  detailsWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  artist: {
    color: colors.neutral[600],
    fontSize: 12,
    marginTop: 4,
  },
});
