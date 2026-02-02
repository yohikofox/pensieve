// Inspired by https://stackoverflow.com/a/56914186
// Adapted for expo-audio and TypeScript

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { AlbumArt } from './AlbumArt';
import { TrackDetails } from './TrackDetails';
import { SeekBar } from './SeekBar';
import { Controls } from './Controls';
import { colors } from '../../../design-system/tokens';

interface Track {
  title: string;
  artist?: string;
  albumArtUrl?: string;
  audioUrl: string;
}

interface PlayerProps {
  tracks: Track[];
}

export const Player: React.FC<PlayerProps> = ({ tracks }) => {
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const track = tracks[selectedTrack];
  const player = useAudioPlayer(track.audioUrl);
  const status = useAudioPlayerStatus(player);

  // Configure audio mode on mount
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to configure audio:', err);
        setIsLoading(false);
      }
    };

    configureAudio();
  }, []);

  const handleSeek = useCallback(
    (time: number) => {
      const roundedTime = Math.round(time);
      player.seekTo(roundedTime);
    },
    [player]
  );

  const handlePlay = useCallback(() => {
    player.play();
  }, [player]);

  const handlePause = useCallback(() => {
    player.pause();
  }, [player]);

  const handleBack = useCallback(() => {
    if (status.currentTime < 10 && selectedTrack > 0) {
      player.seekTo(0);
      setSelectedTrack((prev) => prev - 1);
    } else {
      player.seekTo(0);
    }
  }, [player, status.currentTime, selectedTrack]);

  const handleForward = useCallback(() => {
    if (selectedTrack < tracks.length - 1) {
      player.seekTo(0);
      setSelectedTrack((prev) => prev + 1);
    }
  }, [player, selectedTrack, tracks.length]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AlbumArt url={track.albumArtUrl} />
      <TrackDetails title={track.title} artist={track.artist} />
      <SeekBar
        onSeek={handleSeek}
        trackLength={status.duration}
        onSlidingStart={handlePause}
        currentPosition={status.currentTime}
      />
      <Controls
        onPressPlay={handlePlay}
        onPressPause={handlePause}
        onBack={tracks.length > 1 ? handleBack : undefined}
        onForward={tracks.length > 1 ? handleForward : undefined}
        forwardDisabled={selectedTrack === tracks.length - 1}
        backDisabled={false}
        paused={!status.playing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
  },
});
