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

import React, { useEffect, useState, useCallback } from 'react';
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
  const [captures, setCaptures] = useState<CaptureWithTranscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingCaptureId, setPlayingCaptureId] = useState<string | null>(null);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playingWavCaptureId, setPlayingWavCaptureId] = useState<string | null>(null);

  // Debug mode from settings store
  const debugMode = useSettingsStore((state) => state.debugMode);
  const toast = useToast();

  // Dialog states
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [showDeleteWavDialog, setShowDeleteWavDialog] = useState(false);
  const [captureToDeleteWav, setCaptureToDeleteWav] = useState<Capture | null>(null);

  // Audio player - source changes when user taps play on different capture
  const player = useAudioPlayer(currentAudioPath);
  const playerStatus = useAudioPlayerStatus(player);

  // Auto-play when source is loaded and shouldAutoPlay is true
  useEffect(() => {
    if (shouldAutoPlay && playerStatus.isLoaded && !playerStatus.playing) {
      player.play();
      setShouldAutoPlay(false);
    }
  }, [shouldAutoPlay, playerStatus.isLoaded, playerStatus.playing, player]);

  // Reset playing state and seek to beginning when audio finishes
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

  const loadCaptures = useCallback(async () => {
    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const allCaptures = await repository.findAll();

      // Sort by createdAt descending (newest first)
      const sorted = allCaptures.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setCaptures(sorted);
    } catch (error) {
      console.error('[CapturesListScreen] Failed to load captures:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCaptures();

    // Refresh every 2 seconds to see transcription progress
    const interval = setInterval(loadCaptures, 2000);
    return () => clearInterval(interval);
  }, [loadCaptures]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCaptures();
  }, [loadCaptures]);

  const handleRetry = async (captureId: string) => {
    try {
      const queueService = container.resolve(TranscriptionQueueService);
      const success = await queueService.retryFailedByCaptureId(captureId);
      if (success) {
        loadCaptures();
      }
    } catch (error) {
      console.error('[CapturesListScreen] Retry failed:', error);
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
        // Check if native transcription is available
        const nativeEngine = container.resolve(NativeTranscriptionEngine);
        const isAvailable = await nativeEngine.isAvailable();

        if (!isAvailable) {
          setShowModelDialog(true);
          return;
        }

        // Check if native file transcription is supported (Android 13+ only)
        const isNativeFileSupported =
          Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 33;

        if (!isNativeFileSupported) {
          const modelService = new WhisperModelService();
          const bestModel = await modelService.getBestAvailableModel();

          if (!bestModel) {
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
      loadCaptures();
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
   */
  const handlePlayWav = useCallback(
    (capture: Capture) => {
      if (!capture.wavPath) {
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
        setCurrentAudioPath(capture.wavPath);
        setPlayingCaptureId(null);
        setPlayingWavCaptureId(capture.id);
        setShouldAutoPlay(true);
      }
    },
    [playingWavCaptureId, currentAudioPath, playerStatus.playing, player, t]
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

      loadCaptures();
      console.log('[CapturesListScreen] Deleted WAV for capture:', captureToDeleteWav.id);
    } catch (error) {
      console.error('[CapturesListScreen] Failed to delete WAV:', error);
      toast.error(t('errors.generic'));
    }
    setCaptureToDeleteWav(null);
  }, [captureToDeleteWav, playingWavCaptureId, player, loadCaptures, t, toast]);

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
                className="w-8 h-8 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: isAudio ? colors.primary[100] : colors.secondary[100] }}
              >
                <Feather
                  name={isAudio ? CaptureIcons.voice : CaptureIcons.text}
                  size={16}
                  color={isAudio ? colors.primary[600] : colors.secondary[600]}
                />
              </View>
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {isAudio ? t('captures.types.audio') : t('captures.types.text')}
              </Text>
              {isAudio && item.duration && (
                <Text className="text-sm text-neutral-400 dark:text-neutral-500 ml-1">
                  · {Math.floor(item.duration / 1000)}s
                </Text>
              )}
            </View>
            <Text className="text-xs text-neutral-400 dark:text-neutral-500">
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
                  <Badge variant="pending">
                    <View className="flex-row items-center">
                      <Feather name={StatusIcons.pending} size={12} color={colors.warning[700]} />
                      <Text className="ml-1 text-xs font-medium text-warning-700">
                        {t('capture.status.pending')}
                      </Text>
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
                    <Feather name={ActionIcons.edit} size={22} color={colors.neutral[0]} />
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
                      className="flex-row items-center px-2 py-1.5 bg-success-50 rounded-lg border border-success-200"
                      onPress={(e) => {
                        e.stopPropagation();
                        handlePlayWav(item);
                      }}
                    >
                      <Feather
                        name={isPlayingWav ? MediaIcons.pause : MediaIcons.volume}
                        size={14}
                        color={colors.success[700]}
                      />
                      <Text className="ml-1 text-xs font-medium text-success-700">WAV</Text>
                    </TouchableOpacity>
                    <IconButton
                      icon={ActionIcons.delete}
                      size="sm"
                      variant="ghost"
                      color={colors.error[600]}
                      className="bg-error-50 border border-error-200"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteWav(item);
                      }}
                    />
                  </View>
                )}

                {/* Transcription result */}
                {item.normalizedText ? (
                  <Text className="text-base text-neutral-900 dark:text-neutral-50 leading-relaxed" numberOfLines={4}>
                    {item.normalizedText}
                  </Text>
                ) : isProcessing ? (
                  <Text className="text-sm text-neutral-400 dark:text-neutral-500 italic">
                    {t('capture.status.processing')}...
                  </Text>
                ) : isCaptured ? (
                  <Text className="text-sm text-neutral-400 dark:text-neutral-500 italic">
                    {t('capture.status.pending')}
                  </Text>
                ) : isFailed ? (
                  <Text className="text-sm text-error-500 dark:text-error-400 italic">{t('capture.status.failed')}</Text>
                ) : null}
              </>
            ) : (
              /* Text capture - show content directly */
              <Text className="text-base text-neutral-900 dark:text-neutral-50 leading-relaxed" numberOfLines={4}>
                {item.rawContent || item.normalizedText || t('captures.empty')}
              </Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingView fullScreen message={t('common.loading')} />;
  }

  if (captures.length === 0) {
    return (
      <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
        <EmptyState
          icon="inbox"
          title={t('captures.empty')}
          description={t('captures.emptyHint')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-900">
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
