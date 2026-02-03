/**
 * AudioPlayer Component (Story 3.2b - Task 1)
 *
 * Full-featured audio playback component with:
 * - Play/Pause controls
 * - Seek slider
 * - Time display (current / duration)
 * - Loading states
 * - Error handling
 * - Lifecycle management (cleanup on unmount)
 *
 * Uses Expo SDK 54 expo-audio API (useAudioPlayer hooks)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../design-system/tokens';
import { useTheme } from '../../hooks/useTheme';
import { ProgressBar } from './ProgressBar';

interface AudioPlayerProps {
  audioUri: string;
  onPlaybackEnd?: () => void;
  onPositionChange?: (positionMs: number) => void;
}

const getThemeColors = (isDark: boolean) => ({
  cardBg: isDark ? colors.neutral[900] : colors.neutral[0],
  textPrimary: isDark ? colors.neutral[50] : colors.neutral[900],
  textSecondary: isDark ? colors.neutral[300] : colors.neutral[600],
  textTertiary: isDark ? colors.neutral[400] : colors.neutral[500],
});

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUri,
  onPlaybackEnd,
  onPositionChange,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const wasPlayingBeforeSeek = useRef(false);
  const lastUpdateTime = useRef(Date.now());
  const animationFrameId = useRef<number>();

  // Initialize audio player with expo-audio hooks
  const player = useAudioPlayer(audioUri);
  const status = useAudioPlayerStatus(player);

  // Theme support
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);

  /**
   * Format seconds to MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Configure audio mode on mount
   */
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
        setError(err instanceof Error ? err.message : 'Failed to configure audio');
        setIsLoading(false);
      }
    };

    configureAudio();
  }, []);

  /**
   * Monitor loading state
   */
  useEffect(() => {
    if (status.isLoaded) {
      setIsLoading(false);
      setError(null);
    }
  }, [status.isLoaded]);

  /**
   * Handle playback end
   */
  useEffect(() => {
    if (status.playing === false && status.currentTime >= status.duration && status.duration > 0) {
      if (onPlaybackEnd) {
        onPlaybackEnd();
      }
    }
  }, [status.playing, status.currentTime, status.duration, onPlaybackEnd]);

  /**
   * Notify position changes
   */
  useEffect(() => {
    if (!isSeeking && onPositionChange) {
      onPositionChange(status.currentTime * 1000); // Convert to ms
    }
  }, [status.currentTime, isSeeking, onPositionChange]);

  /**
   * Monitor loading completion
   */
  useEffect(() => {
    if (status.isLoaded && !status.playing && status.currentTime === 0) {
      // Audio loaded successfully
      setError(null);
    }
  }, [status.isLoaded, status.playing, status.currentTime]);

  /**
   * Sync displayTime with status.currentTime (only when not playing or significant drift)
   */
  useEffect(() => {
    const drift = Math.abs(displayTime - status.currentTime);
    // Only sync if not playing (paused/seeking) or drift > 1s
    if (!status.playing || drift > 1.0) {
      setDisplayTime(status.currentTime);
    }
  }, [status.currentTime, status.playing, displayTime]);

  /**
   * Smooth animation loop when playing
   */
  useEffect(() => {
    if (!status.playing || isSeeking) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const animate = () => {
      const now = Date.now();
      const delta = (now - lastUpdateTime.current) / 1000;
      lastUpdateTime.current = now;

      setDisplayTime(prev => Math.min(prev + delta, status.duration));
      animationFrameId.current = requestAnimationFrame(animate);
    };

    lastUpdateTime.current = Date.now();
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [status.playing, status.duration, isSeeking]);

  /**
   * Play audio
   */
  const handlePlay = useCallback(async () => {
    try {
      // If at the end, reset to beginning before playing
      if (status.currentTime >= status.duration && status.duration > 0) {
        player.seekTo(0);
        setDisplayTime(0);
      }
      player.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      setError(err instanceof Error ? err.message : 'Playback failed');
    }
  }, [player, status.currentTime, status.duration]);

  /**
   * Pause audio
   */
  const handlePause = useCallback(async () => {
    try {
      player.pause();
    } catch (err) {
      console.error('Failed to pause audio:', err);
      setError(err instanceof Error ? err.message : 'Pause failed');
    }
  }, [player]);

  /**
   * Handle slider start (memorize playing state)
   */
  const handleSlidingStart = useCallback(() => {
    wasPlayingBeforeSeek.current = status.playing;
    if (status.playing) {
      player.pause();
    }
    setIsSeeking(true);
  }, [status.playing, player]);

  /**
   * Seek to position (restore playing state)
   */
  const handleSeek = useCallback(
    async (value: number) => {
      try {
        // Clamp value to valid range
        const clampedValue = Math.max(0, Math.min(value, status.duration));
        player.seekTo(clampedValue);
        setSeekPosition(clampedValue);
        setIsSeeking(false);

        // Restore playing state
        if (wasPlayingBeforeSeek.current) {
          player.play();
        }
      } catch (err) {
        console.error('Failed to seek:', err);
        setError(err instanceof Error ? err.message : 'Seek failed');
        setIsSeeking(false);
      }
    },
    [player, status.duration]
  );

  /**
   * Rewind 15 seconds
   */
  const handleRewind = useCallback(() => {
    const newPosition = Math.max(0, status.currentTime - 15);
    player.seekTo(newPosition);
  }, [player, status.currentTime]);

  /**
   * Forward 15 seconds
   */
  const handleForward = useCallback(() => {
    const newPosition = Math.min(status.duration, status.currentTime + 15);
    player.seekTo(newPosition);
  }, [player, status.currentTime, status.duration]);

  /**
   * Render loading state
   */
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.cardBg }]} testID="audio-player-loading">
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Chargement de l'audio...</Text>
      </View>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.cardBg }]} testID="audio-player-error">
        <Feather name="alert-circle" size={48} color={colors.error[500]} />
        <Text style={[styles.errorText, { color: colors.error[500] }]}>{error}</Text>
      </View>
    );
  }

  const currentPosition = isSeeking ? seekPosition : displayTime;
  const isPlaying = status.playing;

  /**
   * Render player controls
   */
  return (
    <View style={[styles.container, { backgroundColor: themeColors.cardBg }]} testID="audio-player">
      {/* Control Buttons Row */}
      <View style={styles.controlsRow}>
        {/* Rewind Button */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}
          onPress={handleRewind}
          testID="audio-player-rewind-button"
        >
          <Feather name="rotate-ccw" size={20} color={themeColors.textPrimary} />
          <Text style={[styles.controlLabel, { color: themeColors.textSecondary }]}>15s</Text>
        </TouchableOpacity>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.primary[500] }]}
          onPress={isPlaying ? handlePause : handlePlay}
          testID={isPlaying ? 'audio-player-pause-button' : 'audio-player-play-button'}
        >
          <Feather
            name={isPlaying ? 'pause' : 'play'}
            size={32}
            color={colors.neutral[0]}
          />
        </TouchableOpacity>

        {/* Forward Button */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: isDark ? colors.neutral[800] : colors.neutral[100] }]}
          onPress={handleForward}
          testID="audio-player-forward-button"
        >
          <Feather name="rotate-cw" size={20} color={themeColors.textPrimary} />
          <Text style={[styles.controlLabel, { color: themeColors.textSecondary }]}>15s</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <ProgressBar
        value={currentPosition}
        duration={status.duration}
        isPlaying={isPlaying}
        onSlidingStart={handleSlidingStart}
        onValueChange={(value) => {
          setSeekPosition(value);
        }}
        onSlidingComplete={handleSeek}
        isDark={isDark}
      />

      {/* Time Display */}
      <Text style={[styles.timeText, { color: themeColors.textSecondary }]} testID="audio-player-time-display">
        {formatTime(currentPosition)} / {formatTime(status.duration)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4], // 16
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg, // 12
    alignItems: 'center',
    justifyContent: 'center',

  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: spacing[4], // 16
  },
  controlButton: {
    width: 56, // Custom size for control buttons
    height: 56,
    borderRadius: borderRadius.full, // Circular (28)
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontSize: typography.fontSize.xs, // 11 (closest to 10)
    marginTop: spacing[0.5], // 2
    fontWeight: typography.fontWeight.semibold, // '600'
  },
  playButton: {
    width: 64, // Custom size for main play button
    height: 64,
    borderRadius: borderRadius.full, // Circular (32)
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2], // 8
  },
  slider: {
    width: '100%',
    height: 40, // Custom slider height
  },
  timeText: {
    fontSize: typography.fontSize.base, // 15 (closest to 14)
    color: colors.neutral[600],
    fontFamily: typography.fontFamily.mono, // 'monospace'
  },
  loadingText: {
    marginTop: spacing[3], // 12
    fontSize: typography.fontSize.base, // 15
    color: colors.neutral[600],
  },
  errorText: {
    marginTop: spacing[3], // 12
    fontSize: typography.fontSize.base, // 15
    color: colors.error[500],
    textAlign: 'center',
  },
});
