/**
 * Custom hook for managing audio playback in captures
 * Handles play/pause/stop state and audio player lifecycle
 * Story 6.3 - Task 2.5: Lazy audio loading integration
 */
import { useState, useEffect, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import type { Capture } from '../contexts/capture/domain/Capture.model';
import { useToast } from '../design-system/components';
import { container } from '../infrastructure/di/container';
import { LazyAudioDownloader } from '../infrastructure/sync/LazyAudioDownloader';

export function useCaptureAudioPlayer() {
  const { t } = useTranslation();
  const toast = useToast();

  const [playingCaptureId, setPlayingCaptureId] = useState<string | null>(null);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playingWavCaptureId, setPlayingWavCaptureId] = useState<string | null>(null);
  const [isDownloadingAudio, setIsDownloadingAudio] = useState(false);

  const player = useAudioPlayer(currentAudioPath);
  const playerStatus = useAudioPlayerStatus(player);

  // Lazy audio downloader (Story 6.3 - Task 2.5)
  // Create instance directly (not using DI for simplicity)
  const lazyAudioDownloader = new LazyAudioDownloader();

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
    async (capture: Capture) => {
      // Story 6.3 - Task 2.5: Lazy audio loading
      // First try to get local audio path (either rawContent or audio_local_path)
      let audioPath = capture.rawContent;

      // If no local path, try lazy loading from server (audio_url)
      if (!audioPath) {
        console.log('[AudioPlayer] No local audio, attempting lazy download...');
        setIsDownloadingAudio(true);

        try {
          const downloadedPath = await lazyAudioDownloader.downloadAudioIfNeeded(capture.id);
          setIsDownloadingAudio(false);

          if (!downloadedPath) {
            console.error('[AudioPlayer] Play failed: audio download returned null');
            toast.error(t('capture.alerts.noAudioFile'));
            return;
          }

          audioPath = downloadedPath;
        } catch (error) {
          setIsDownloadingAudio(false);
          console.error('[AudioPlayer] Audio download failed:', error);
          toast.error('Échec du téléchargement audio');
          return;
        }
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
    [playingCaptureId, currentAudioPath, playerStatus.playing, player, t, toast, lazyAudioDownloader]
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
    isDownloadingAudio, // Story 6.3 - Task 2.5: Expose download state
  };
}
