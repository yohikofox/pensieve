/**
 * CapturesListScreen - Display all captures with transcription status
 *
 * Story 2.5 - Task 5.1: Show progress indicator on captures
 *
 * Features:
 * - List all captures (audio + text)
 * - Show transcription status for audio captures
 * - Spinner for "processing" state
 * - Display transcribed text for "ready" state
 * - Retry button for "failed" state
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { Capture } from '../../contexts/capture/domain/Capture.model';
import { TranscriptionQueueService } from '../../contexts/Normalization/services/TranscriptionQueueService';
import { WhisperModelService } from '../../contexts/Normalization/services/WhisperModelService';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';
import { NativeTranscriptionEngine } from '../../contexts/Normalization/services/NativeTranscriptionEngine';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCapturesStore } from '../../stores/capturesStore';
import { useCapturesListener } from '../../hooks/useCapturesListener';
import { useTheme } from '../../hooks/useTheme';
import { colors, shadows } from '../../design-system/tokens';
import { Card, Badge, Button, IconButton, LoadingView, EmptyState, AlertDialog, useToast } from '../../design-system/components';
import { CaptureIcons, StatusIcons, MediaIcons, ActionIcons } from '../../design-system/icons';

// Override with extended param list that includes startAnalysis
type CapturesStackParamListExtended = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
};

type NavigationProp = NativeStackNavigationProp<CapturesStackParamListExtended, 'CapturesList'>;

export function CapturesListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isDark } = useTheme();

  // Zustand store pour les captures (remplace useState)
  const captures = useCapturesStore(state => state.captures);
  const isLoading = useCapturesStore(state => state.isLoading);
  const loadCaptures = useCapturesStore(state => state.loadCaptures);

  // Active l'écoute des événements
  useCapturesListener();

  const [refreshing, setRefreshing] = useState(false);
  const [playingCaptureId, setPlayingCaptureId] = useState<string | null>(null);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playingWavCaptureId, setPlayingWavCaptureId] = useState<string | null>(null);

  // Debug mode from settings store
  const debugMode = useSettingsStore((state) => state.debugMode);
  const autoTranscriptionEnabled = useSettingsStore((state) => state.autoTranscriptionEnabled);
  const toast = useToast();

  // Error messages for failed captures (debug mode only)
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  // Dialog states
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showDeleteWavDialog, setShowDeleteWavDialog] = useState(false);
  const [captureToDeleteWav, setCaptureToDeleteWav] = useState<Capture | null>(null);

  // Audio player - source changes when user taps play on different capture
  const player = useAudioPlayer(currentAudioPath);
  const playerStatus = useAudioPlayerStatus(player);

  // Auto-play when source is loaded and shouldAutoPlay is true
  useEffect(() => {
    console.log('[CapturesListScreen] Auto-play effect triggered', {
      shouldAutoPlay,
      isLoaded: playerStatus.isLoaded,
      playing: playerStatus.playing,
      currentAudioPath
    });
    if (shouldAutoPlay && playerStatus.isLoaded && !playerStatus.playing) {
      console.log('[CapturesListScreen] Starting auto-play');
      player.play();
      setShouldAutoPlay(false);
    }
  }, [shouldAutoPlay, playerStatus.isLoaded, playerStatus.playing, player, currentAudioPath]);

  // Log player status changes for debugging
  useEffect(() => {
    console.log('[CapturesListScreen] Player status changed:', {
      isLoaded: playerStatus.isLoaded,
      playing: playerStatus.playing,
      duration: playerStatus.duration,
      error: playerStatus.error,
      currentAudioPath
    });

    if (playerStatus.error) {
      console.error('[CapturesListScreen] Player error:', playerStatus.error);
      toast.error(`Erreur de lecture: ${playerStatus.error}`);
    }
  }, [playerStatus.isLoaded, playerStatus.playing, playerStatus.error, currentAudioPath, toast]);

  // Reset playing state and seek to beginning when audio finishes
  useEffect(() => {
    if (playerStatus.didJustFinish && playingCaptureId) {
      console.log('[CapturesListScreen] Audio finished, resetting');
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
    [playingCaptureId, currentAudioPath, playerStatus.playing, player, t]
  );

  const handleStop = useCallback(
    (capture: Capture) => {
      // Stop and reset to beginning
      if (playingCaptureId === capture.id) {
        player.pause();
        player.seekTo(0);
        setPlayingCaptureId(null);
      }
    },
    [playingCaptureId, player]
  );

  // Charge les captures une seule fois au mount
  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  // Load error messages for failed captures (debug mode only)
  useEffect(() => {
    if (!debugMode) {
      setErrorMessages({});
      return;
    }

    const fetchErrorMessages = async () => {
      const queueService = container.resolve(TranscriptionQueueService);
      const failedCaptures = captures.filter(c => c.state === 'failed');
      const errors: Record<string, string> = {};

      for (const capture of failedCaptures) {
        const error = await queueService.getLastError(capture.id);
        if (error) {
          errors[capture.id] = error;
        }
      }

      setErrorMessages(errors);
    };

    fetchErrorMessages();
  }, [debugMode, captures]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCaptures().finally(() => {
      setRefreshing(false);
    });
  }, [loadCaptures]);

  const handleRetry = async (captureId: string) => {
    try {
      const queueService = container.resolve(TranscriptionQueueService);
      const result = await queueService.retryFailedByCaptureId(captureId);

      if (result.success) {
        toast.success(t('capture.alerts.retryStarted', 'Nouvelle tentative de transcription...'));
        // L'événement QueueItemStarted sera émis automatiquement
        // Le listener mettra à jour le store
      } else {
        // Show error message (e.g., "Trop de tentatives. Réessayez dans X minutes.")
        toast.error(result.message || t('capture.alerts.retryFailed', 'Échec de la nouvelle tentative'));
      }
    } catch (error) {
      console.error('[CapturesListScreen] Retry failed:', error);
      toast.error(t('capture.alerts.retryError', 'Erreur lors de la nouvelle tentative'));
    }
  };

  const handleTranscribe = async (capture: Capture) => {
    try {
      // Check which engine is selected
      const engineService = container.resolve(TranscriptionEngineService);
      const selectedEngine = await engineService.getSelectedEngineType();

      if (selectedEngine === 'whisper') {
        // Check if Whisper model is downloaded
        const modelService = new WhisperModelService();
        const bestModel = await modelService.getBestAvailableModel();

        if (!bestModel) {
          setShowModelDialog(true);
          return;
        }
      } else if (selectedEngine === 'native') {
        // Check if native file transcription is supported (Android 13+ only)
        const isNativeFileSupported =
          Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33;

        if (!isNativeFileSupported) {
          // Native file transcription not supported, will fallback to Whisper
          // Check if Whisper model is available for fallback
          const modelService = new WhisperModelService();
          const bestModel = await modelService.getBestAvailableModel();

          if (!bestModel) {
            setShowModelDialog(true);
            return;
          }
        } else {
          // Native file transcription supported on this device
          // Check if native transcription is available (permissions)
          const nativeEngine = container.resolve(NativeTranscriptionEngine);
          const isAvailable = await nativeEngine.isAvailable();

          if (!isAvailable) {
            setShowModelDialog(true);
            return;
          }
        }
      }

      // Enqueue for transcription
      const queueService = container.resolve(TranscriptionQueueService);
      await queueService.enqueue({
        captureId: capture.id,
        audioPath: capture.rawContent || '',
        audioDuration: capture.duration ?? undefined,
      });

      console.log(
        '[CapturesListScreen] Enqueued capture for transcription:',
        capture.id,
        `[${selectedEngine}]`
      );
      // L'événement QueueItemAdded sera émis automatiquement
      // Le listener mettra à jour le store
    } catch (error) {
      console.error('[CapturesListScreen] Failed to enqueue transcription:', error);
      toast.error(t('capture.alerts.error'));
    }
  };

  const handleCapturePress = (captureId: string) => {
    navigation.navigate('CaptureDetail', { captureId });
  };

  /**
   * Handle WAV playback (debug feature)
   * Note: File existence is already verified in loadCaptures(), so button only shows if file exists
   */
  const handlePlayWav = useCallback(
    (capture: Capture) => {
      console.log('[CapturesListScreen] handlePlayWav called', {
        captureId: capture.id,
        wavPath: capture.wavPath,
        currentAudioPath,
        playingWavCaptureId,
        playerStatus: { playing: playerStatus.playing, isLoaded: playerStatus.isLoaded }
      });

      if (!capture.wavPath) {
        console.log('[CapturesListScreen] No wavPath, showing error toast');
        toast.error(t('capture.alerts.noAudioFile'));
        return;
      }

      if (playingWavCaptureId === capture.id && currentAudioPath === capture.wavPath) {
        console.log('[CapturesListScreen] Same WAV already loaded, toggling play/pause');
        if (playerStatus.playing) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        console.log('[CapturesListScreen] Loading new WAV file:', capture.wavPath);

        // Stop any current playback first
        if (playingCaptureId || playingWavCaptureId) {
          console.log('[CapturesListScreen] Stopping current playback before loading WAV');
          player.pause();
        }

        setCurrentAudioPath(capture.wavPath);
        setPlayingCaptureId(null);
        setPlayingWavCaptureId(capture.id);
        setShouldAutoPlay(true);
      }
    },
    [playingWavCaptureId, playingCaptureId, currentAudioPath, playerStatus.playing, playerStatus.isLoaded, player, t, toast]
  );

  /**
   * Delete WAV file for a capture (debug cleanup)
   */
  const handleDeleteWav = useCallback(
    (capture: Capture) => {
      if (!capture.wavPath) return;
      setCaptureToDeleteWav(capture);
      setShowDeleteWavDialog(true);
    },
    []
  );

  /**
   * Confirm deletion of WAV file
   */
  const confirmDeleteWav = useCallback(async () => {
    if (!captureToDeleteWav?.wavPath) return;
    setShowDeleteWavDialog(false);

    try {
      await FileSystemLegacy.deleteAsync(captureToDeleteWav.wavPath, { idempotent: true });

      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      await repository.update(captureToDeleteWav.id, { wavPath: null });

      if (playingWavCaptureId === captureToDeleteWav.id) {
        player.pause();
        setPlayingWavCaptureId(null);
        setCurrentAudioPath(null);
      }

      // Trigger une mise à jour via le store
      useCapturesStore.getState().updateCapture(captureToDeleteWav.id);
      console.log('[CapturesListScreen] Deleted WAV for capture:', captureToDeleteWav.id);
    } catch (error) {
      console.error('[CapturesListScreen] Failed to delete WAV:', error);
      toast.error(t('errors.generic'));
    }
    setCaptureToDeleteWav(null);
  }, [captureToDeleteWav, playingWavCaptureId, player, t, toast]);

  const renderCaptureItem = ({ item }: { item: CaptureWithTranscription }) => {
    const isAudio = item.type === 'audio';
    const isProcessing = item.state === 'processing';
    const isReady = item.state === 'ready';
    const isFailed = item.state === 'failed';
    const isCaptured = item.state === 'captured';
    const isPlaying = playingCaptureId === item.id && playerStatus.playing;
    const isPlayingWav = playingWavCaptureId === item.id && playerStatus.playing;

    return (
      <TouchableOpacity onPress={() => handleCapturePress(item.id)} activeOpacity={0.7}>
        <Card variant="elevated" className="mb-3">
          {/* Header: Type + Duration + Date */}
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-row items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
                  isAudio ? 'bg-primary-subtle' : 'bg-secondary-subtle'
                }`}
              >
                <Feather
                  name={isAudio ? CaptureIcons.voice : CaptureIcons.text}
                  size={16}
                  color={isAudio ? colors.primary[500] : colors.secondary[500]}
                />
              </View>
              <Text className="text-sm font-semibold text-text-primary">
                {isAudio ? t('captures.types.audio') : t('captures.types.text')}
              </Text>
              {isAudio && item.duration && (
                <Text className="text-sm text-text-tertiary ml-1">
                  · {Math.floor(item.duration / 1000)}s
                </Text>
              )}
            </View>
            <Text className="text-xs text-text-tertiary">
              {item.createdAt.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Status Badge + Action Buttons */}
          {isAudio && (
            <View className="flex-row items-center justify-between mb-3">
              {/* Badge */}
              <View>
                {isCaptured && (
                  <Badge variant={item.isInQueue ? "processing" : "pending"}>
                    <View className="flex-row items-center">
                      {item.isInQueue ? (
                        <>
                          <ActivityIndicator size="small" color={colors.info[600]} />
                          <Text className="ml-2 text-xs font-medium text-info-700">
                            {t('capture.status.queued')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Feather name={StatusIcons.pending} size={12} color={colors.warning[700]} />
                          <Text className="ml-1 text-xs font-medium text-warning-700">
                            {autoTranscriptionEnabled
                              ? t('capture.status.pending')
                              : t('capture.status.manual')}
                          </Text>
                        </>
                      )}
                    </View>
                  </Badge>
                )}

                {isProcessing && (
                  <Badge variant="processing">
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color={colors.info[600]} />
                      <Text className="ml-2 text-xs font-medium text-info-700">
                        {t('capture.status.processing')}
                      </Text>
                    </View>
                  </Badge>
                )}

                {isReady && (
                  <Badge variant="ready">
                    <View className="flex-row items-center">
                      <Feather name={StatusIcons.success} size={12} color={colors.success[700]} />
                      <Text className="ml-1 text-xs font-medium text-success-700">
                        {t('capture.status.ready')}
                      </Text>
                    </View>
                  </Badge>
                )}

                {isFailed && (
                  <Badge variant="failed">
                    <View className="flex-row items-center">
                      <Feather name={StatusIcons.error} size={12} color={colors.error[700]} />
                      <Text className="ml-1 text-xs font-medium text-error-700">
                        {t('capture.status.failed')}
                      </Text>
                    </View>
                  </Badge>
                )}
              </View>

              {/* Action Buttons - anchored right */}
              <View className="flex-row items-center gap-2">
                {/* Stop button - only visible when playing */}
                {isPlaying && (
                  <TouchableOpacity
                    className="w-10 h-10 rounded-lg bg-error-500 items-center justify-center"
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleStop(item);
                    }}
                  >
                    <Feather name="square" size={22} color={colors.neutral[0]} />
                  </TouchableOpacity>
                )}

                {/* Play/Pause button */}
                <TouchableOpacity
                  className="w-10 h-10 rounded-lg bg-success-500 items-center justify-center"
                  activeOpacity={0.7}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePlayPause(item);
                  }}
                >
                  <Feather
                    name={isPlaying ? MediaIcons.pause : MediaIcons.play}
                    size={24}
                    color={colors.neutral[0]}
                    style={!isPlaying ? { marginLeft: 24 * 0.15 } : undefined}
                  />
                </TouchableOpacity>

                {/* Transcribe button (pending only) */}
                {isCaptured && (
                  <TouchableOpacity
                    className="w-10 h-10 rounded-lg bg-primary-500 items-center justify-center"
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleTranscribe(item);
                    }}
                  >
                    <Feather name="file-text" size={22} color={colors.neutral[0]} />
                  </TouchableOpacity>
                )}

                {/* Retry button (failed only) */}
                {isFailed && (
                  <TouchableOpacity
                    className="w-10 h-10 rounded-lg bg-error-500 items-center justify-center"
                    activeOpacity={0.7}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRetry(item.id);
                    }}
                  >
                    <Feather name="refresh-cw" size={22} color={colors.neutral[0]} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Content */}
          <View>
            {isAudio ? (
              <>
                {/* WAV debug buttons */}
                {debugMode && item.wavPath && (
                  <View className="flex-row items-center gap-2 mb-2">
                    <TouchableOpacity
                      className="flex-row items-center px-2 py-1.5 rounded-lg border"
                      style={{
                        backgroundColor: isDark ? colors.success[900] : colors.success[50],
                        borderColor: isDark ? colors.success[700] : colors.success[200],
                      }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePlayWav(item);
                      }}
                    >
                      <Feather
                        name={isPlayingWav ? MediaIcons.pause : MediaIcons.volume}
                        size={14}
                        color={isDark ? colors.success[400] : colors.success[700]}
                      />
                      <Text
                        className="ml-1 text-xs font-medium"
                        style={{ color: isDark ? colors.success[400] : colors.success[700] }}
                      >
                        WAV
                      </Text>
                    </TouchableOpacity>
                    <IconButton
                      icon={ActionIcons.delete}
                      size="sm"
                      variant="ghost"
                      color={isDark ? colors.error[400] : colors.error[600]}
                      className="border"
                      style={{
                        backgroundColor: isDark ? colors.error[900] : colors.error[50],
                        borderColor: isDark ? colors.error[700] : colors.error[200],
                      }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteWav(item);
                      }}
                    />
                  </View>
                )}

                {/* Transcription result */}
                {item.normalizedText ? (
                  <Text className="text-base text-text-primary leading-relaxed" numberOfLines={4}>
                    {item.normalizedText}
                  </Text>
                ) : isProcessing ? (
                  <Text className="text-sm text-text-tertiary italic">
                    {t('capture.status.processing')}...
                  </Text>
                ) : isCaptured ? (
                  <Text className="text-sm text-text-tertiary italic">
                    {autoTranscriptionEnabled
                      ? t('capture.status.pending')
                      : t('capture.status.manual')}
                  </Text>
                ) : isFailed ? (
                  <View>
                    <Text className="text-sm text-status-error italic">
                      {debugMode && errorMessages[item.id]
                        ? errorMessages[item.id]
                        : t('capture.status.failed', 'La transcription a échoué')}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              /* Text capture - show content directly */
              <Text className="text-base text-text-primary leading-relaxed" numberOfLines={4}>
                {item.rawContent || item.normalizedText || t('captures.empty')}
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <LoadingView fullScreen message={t('common.loading')} />;
  }

  if (captures.length === 0) {
    return (
      <View className="flex-1 bg-bg-screen">
        <EmptyState
          icon="inbox"
          title={t('captures.empty')}
          description={t('captures.emptyHint')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-screen">
      <FlatList
        data={captures}
        keyExtractor={(item) => item.id}
        renderItem={renderCaptureItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      />

      {/* Model not available dialog */}
      <AlertDialog
        visible={showModelDialog}
        onClose={() => setShowModelDialog(false)}
        title={t('settings.transcription.whisperModel')}
        message={t('capture.alerts.serviceNotInitialized')}
        icon="alert-triangle"
        variant="warning"
        confirmAction={{
          label: t('navigation.tabs.settings'),
          onPress: () => {
            setShowModelDialog(false);
            // @ts-ignore - Tab navigation
            navigation.getParent()?.navigate('Settings');
          },
        }}
        cancelAction={{
          label: t('common.cancel'),
          onPress: () => setShowModelDialog(false),
        }}
      />

      {/* Delete WAV confirmation dialog */}
      <AlertDialog
        visible={showDeleteWavDialog}
        onClose={() => {
          setShowDeleteWavDialog(false);
          setCaptureToDeleteWav(null);
        }}
        title={t('common.delete')}
        message={t('captures.deleteConfirm.message')}
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: t('common.delete'),
          onPress: confirmDeleteWav,
        }}
        cancelAction={{
          label: t('common.cancel'),
          onPress: () => {
            setShowDeleteWavDialog(false);
            setCaptureToDeleteWav(null);
          },
        }}
      />
    </View>
  );
}
