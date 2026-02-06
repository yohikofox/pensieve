/**
 * Custom hook for managing audio playback in captures
 * Handles play/pause/stop state and audio player lifecycle
 */
import { useState, useEffect, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import { useToast } from '../design-system/components';

export function useCaptureAudioPlayer() {
  const { t } = useTranslation();
  const toast = useToast();

  const [playingCaptureId, setPlayingCaptureId] = useState<string | null>(null);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playingWavCaptureId, setPlayingWavCaptureId] = useState<string | null>(null);

  const player = useAudioPlayer(currentAudioPath);
  const playerStatus = useAudioPlayerStatus(player);

  // Auto-play when source is loaded and shouldAutoPlay is true
  useEffect(() => {
    if (shouldAutoPlay && playerStatus.isLoaded && !playerStatus.playing) {
      player.play();
      setShouldAutoPlay(false);
    }
  }, [shouldAutoPlay, playerStatus.isLoaded, playerStatus.playing, player]);

  // Handle player errors
  useEffect(() => {
    if (playerStatus.error) {
      console.error('[AudioPlayer] Player error:', playerStatus.error);
      toast.error(`Erreur de lecture: ${playerStatus.error}`);
    }
  }, [playerStatus.error, toast]);

  // Reset playing state when audio finishes
  useEffect(() => {
    if (playerStatus.didJustFinish && playingCaptureId) {
      player.pause();
      setTimeout(() => {
        player.seekTo(0);
      }, 100);
      setPlayingCaptureId(null);
    }
  }, [playerStatus.didJustFinish, player, playingCaptureId]);

  const handlePlayPause = useCallback(
    (capture: Capture) => {
      const audioPath = capture.rawContent;
      if (!audioPath) {
        console.error('[AudioPlayer] Play failed: no audio file');
        toast.error(t('capture.alerts.noAudioFile'));
        return;
      }

      // If same capture and already loaded, toggle play/pause
      if (playingCaptureId === capture.id && currentAudioPath === audioPath) {
        if (playerStatus.playing) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Different capture - load new source and auto-play when ready
        setCurrentAudioPath(audioPath);
        setPlayingCaptureId(capture.id);
        setShouldAutoPlay(true);
      }
    },
    [playingCaptureId, currentAudioPath, playerStatus.playing, player, t, toast]
  );

  const handleStop = useCallback(
    (capture: Capture) => {
      if (playingCaptureId === capture.id) {
        player.pause();
        player.seekTo(0);
        setPlayingCaptureId(null);
      }
    },
    [playingCaptureId, player]
  );

  const handlePlayWav = useCallback(
    (capture: Capture) => {
      if (!capture.wavPath) {
        console.error('[AudioPlayer] Play WAV failed: no wavPath', capture.id);
        toast.error(t('capture.alerts.noAudioFile'));
        return;
      }

      if (playingWavCaptureId === capture.id && currentAudioPath === capture.wavPath) {
        if (playerStatus.playing) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Stop any current playback first
        if (playingCaptureId || playingWavCaptureId) {
          player.pause();
        }

        setCurrentAudioPath(capture.wavPath);
        setPlayingCaptureId(null);
        setPlayingWavCaptureId(capture.id);
        setShouldAutoPlay(true);
      }
    },
    [playingWavCaptureId, playingCaptureId, currentAudioPath, playerStatus.playing, player, t, toast]
  );

  const stopWavPlayback = useCallback(() => {
    player.pause();
    setPlayingWavCaptureId(null);
    setCurrentAudioPath(null);
  }, [player]);

  return {
    playingCaptureId,
    playingWavCaptureId,
    playerStatus,
    handlePlayPause,
    handleStop,
    handlePlayWav,
    stopWavPlayback,
  };
}
