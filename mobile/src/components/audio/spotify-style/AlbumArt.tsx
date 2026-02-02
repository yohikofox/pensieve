// Inspired by https://stackoverflow.com/a/56914186
// Adapted for expo-audio and TypeScript

import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../../design-system/tokens';

interface AlbumArtProps {
  url?: string;
  onPress?: () => void;
}

export const AlbumArt: React.FC<AlbumArtProps> = ({ url, onPress }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress}>
        <View style={styles.imageWrapper}>
          {url ? (
            <Image style={styles.image} source={{ uri: url }} />
          ) : (
            <View style={[styles.image, styles.placeholderContainer]}>
              <Feather name="mic" size={80} color={colors.neutral[400]} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const { width } = Dimensions.get('window');
const imageSize = width - 100;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 30,
    paddingLeft: 24,
    paddingRight: 24,
  },
  imageWrapper: {
    elevation: 10,
    shadowColor: '#d9d9d9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  image: {
    width: imageSize,
    height: imageSize,
    borderRadius: 20,
  },
  placeholderContainer: {
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
