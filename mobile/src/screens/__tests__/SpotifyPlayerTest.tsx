/**
 * Test Screen for Spotify-Style Player
 *
 * Temporary screen to test the Spotify-inspired player with real audio
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Player } from '../../components/audio/spotify-style';

export const SpotifyPlayerTest = () => {
  // Example tracks - replace with your real audio URLs
  const TRACKS = [
    {
      title: 'Audio Capture Test',
      artist: 'Pensieve Recording',
      // Replace with a real audio file from your captures
      audioUrl: 'file:///path/to/your/audio.m4a',
      albumArtUrl: undefined, // Will show mic icon placeholder
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Player tracks={TRACKS} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
});
