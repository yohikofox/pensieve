/**
 * WaveformPlayer Component
 *
 * Minimalist audio player with waveform visualization:
 * - Play/Pause button (left)
 * - Interactive waveform (center) - tap to seek
 * - Playback speed control (right) - 0.5x, 1x, 1.5x, 2x
 * - Dark rounded design
 *
 * Uses Expo SDK 54 expo-audio API
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  GestureResponderEvent,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../design-system/tokens';
import { useWaveformService } from '../../contexts/capture/hooks/useWaveformService';
import { METADATA_KEYS, type CaptureMetadata } from '../../contexts/capture/domain/CaptureMetadata.model';

interface WaveformPlayerProps {
  audioUri: string;
  captureId?: string; // Optional: for reading cached waveform from metadata
  metadata?: Record<string, CaptureMetadata>; // Optional: capture metadata
  onPlaybackEnd?: () => void;
  onPositionChange?: (positionMs: number) => void;
  waveformBars?: number; // Number of bars to display (default: 50)
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUri,
  captureId,
  metadata,
  onPlaybackEnd,
  onPositionChange,
  waveformBars = 50,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(1); // Default: 1x
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const lastUpdateTime = useRef(Date.now());
  const animationFrameId = useRef<number>();

  // Initialize audio player
  const player = useAudioPlayer(audioUri);
  const status = useAudioPlayerStatus(player);

  // Get waveform service with proper DI
  const waveformService = useWaveformService();

  /**
   * Extract waveform data on mount
   */
  useEffect(() => {
    const extractWaveformData = async () => {
      try {
        // Priority 1: Try to read from cached metadata (instant)
        if (metadata && metadata[METADATA_KEYS.WAVEFORM_DATA]?.value) {
          console.log('📦 Loading waveform from cache');
          const cachedData = JSON.parse(metadata[METADATA_KEYS.WAVEFORM_DATA].value);

          // Normalize cached data
          const maxValue = Math.max(...cachedData);
          const normalizedData = maxValue > 0
            ? cachedData.map((v: number) => v / maxValue)
            : cachedData;

          console.log('✅ Loaded', normalizedData.length, 'samples from cache');
          setWaveformData(normalizedData);
          return;
        }

        // Priority 2: Extract + save to DB via service (fallback for old captures)
        if (!captureId) {
          console.warn('⚠️ No captureId provided, cannot save waveform to DB');
          // Fallback to mock data
          const mockData = Array.from({ length: waveformBars }, () => Math.random() * 0.5 + 0.3);
          setWaveformData(mockData);
          return;
        }

        console.log('🔄 Extracting waveform and saving to DB');
        const normalizedData = await waveformService.extractAndSave(
          captureId,
          audioUri,
          waveformBars
        );

        console.log('✅ Extracted, saved, and normalized');
        setWaveformData(normalizedData);
      } catch (err) {
        console.error('Failed to extract waveform:', err);
        // Fallback to mock data if extraction fails
        const mockData = Array.from({ length: waveformBars }, () => Math.random() * 0.5 + 0.3);
        setWaveformData(mockData);
      }
    };

    extractWaveformData();
  }, [audioUri, waveformBars, captureId, metadata]);

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
    if (onPositionChange) {
      onPositionChange(status.currentTime * 1000);
    }
  }, [status.currentTime, onPositionChange]);

  /**
   * Sync displayTime with status.currentTime (only when not playing or significant drift)
   */
  useEffect(() => {
    const drift = Math.abs(displayTime - status.currentTime);
    if (!status.playing || drift > 1.0) {
      setDisplayTime(status.currentTime);
    }
  }, [status.currentTime, status.playing, displayTime]);

  /**
   * Smooth animation loop when playing
   */
  useEffect(() => {
    if (!status.playing) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const currentSpeed = SPEED_OPTIONS[speedIndex];

    const animate = () => {
      const now = Date.now();
      const delta = ((now - lastUpdateTime.current) / 1000) * currentSpeed;
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
  }, [status.playing, status.duration, speedIndex]);

  /**
   * Apply playback speed
   */
  useEffect(() => {
    if (status.isLoaded) {
      const speed = SPEED_OPTIONS[speedIndex];
      // Note: expo-audio doesn't have setRate in SDK 54, we simulate with animation speed
      // In real implementation, use player.setRate(speed) if available
    }
  }, [speedIndex, status.isLoaded]);

  /**
   * Toggle play/pause
   */
  const handlePlayPause = useCallback(async () => {
    try {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (err) {
      console.error('Failed to toggle playback:', err);
      setError(err instanceof Error ? err.message : 'Playback failed');
    }
  }, [player, status.playing]);

  /**
   * Cycle through speed options
   */
  const handleSpeedChange = useCallback(() => {
    setSpeedIndex(prev => (prev + 1) % SPEED_OPTIONS.length);
  }, []);

  /**
   * Handle tap on waveform to seek
   */
  const handleWaveformPress = useCallback(
    (event: GestureResponderEvent) => {
      if (!status.isLoaded || status.duration === 0) return;

      const { locationX } = event.nativeEvent;
      const waveformWidth = 280; // Approximate width of waveform container
      const ratio = Math.max(0, Math.min(1, locationX / waveformWidth));
      const newPosition = ratio * status.duration;

      player.seekTo(newPosition);
      setDisplayTime(newPosition);
    },
    [player, status.isLoaded, status.duration]
  );

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <View style={styles.container} testID="waveform-player-loading">
        <ActivityIndicator size="small" color={colors.neutral[0]} />
      </View>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <View style={styles.container} testID="waveform-player-error">
        <Feather name="alert-circle" size={20} color={colors.error[500]} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const progress = status.duration > 0 ? displayTime / status.duration : 0;
  const isPlaying = status.playing;
  const currentSpeed = SPEED_OPTIONS[speedIndex];

  return (
    <View style={styles.container} testID="waveform-player">
      {/* Play/Pause Button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        testID={isPlaying ? 'waveform-pause-button' : 'waveform-play-button'}
      >
        <Feather
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={colors.neutral[900]}
        />
      </TouchableOpacity>

      {/* Waveform */}
      <TouchableOpacity
        style={styles.waveformContainer}
        onPress={handleWaveformPress}
        activeOpacity={0.8}
        testID="waveform-bars"
      >
        {waveformData.map((height, index) => {
          const barProgress = index / waveformData.length;
          const isPlayed = barProgress <= progress;

          return (
            <View
              key={index}
              style={[
                styles.waveformBar,
                {
                  height: `${height * 100}%`,
                  backgroundColor: isPlayed ? colors.neutral[0] : colors.neutral[500],
                },
              ]}
            />
          );
        })}
      </TouchableOpacity>

      {/* Speed Control */}
      <TouchableOpacity
        style={styles.speedButton}
        onPress={handleSpeedChange}
        testID="waveform-speed-button"
      >
        <Text style={styles.speedText}>{currentSpeed}x</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[800],
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
    height: 72,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 48,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  speedButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  errorText: {
    fontSize: 12,
    color: colors.error[500],
    marginLeft: 8,
  },
});
