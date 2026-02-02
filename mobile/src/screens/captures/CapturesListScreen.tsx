/**
 * CapturesListScreen - Display all captures with transcription status
 *
 * Story 2.5 - Task 5.1: Show progress indicator on captures
 * Story 3.1: Liste Chronologique des Captures
 *
 * Features:
 * - List all captures (audio + text) in reverse chronological order (AC1)
 * - Show transcription status for audio captures
 * - Spinner for "processing" state
 * - Display transcribed text for "ready" state
 * - Retry button for "failed" state
 * - Offline indicator banner (AC3)
 * - Empty state with "Jardin d'idées" metaphor (AC6)
 * - Skeleton loading with shimmer animation (AC7)
 * - Infinite scroll with FlatList optimizations (AC4)
 * - Pull-to-refresh (AC5)
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
  Share,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { TranscriptionModelService } from '../../contexts/Normalization/services/TranscriptionModelService';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';
import { NativeTranscriptionEngine } from '../../contexts/Normalization/services/NativeTranscriptionEngine';
import { RetryLimitService } from '../../contexts/Normalization/services/RetryLimitService';
import { useSettingsStore } from '../../stores/settingsStore';
import { useCapturesStore } from '../../stores/capturesStore';
import { useCapturesListener } from '../../hooks/useCapturesListener';
import { useTheme } from '../../hooks/useTheme';
import { colors, shadows } from '../../design-system/tokens';
import { Card, Badge, Button, IconButton, LoadingView, EmptyState, AlertDialog, useToast } from '../../design-system/components';
import { CaptureIcons, StatusIcons, MediaIcons, ActionIcons } from '../../design-system/icons';
import { SkeletonCaptureCard } from '../../components/skeletons/SkeletonCaptureCard';
import { PulsingBadge } from '../../components/animations/PulsingBadge';
import { GerminationBadge } from '../../components/animations/GerminationBadge';
import { SwipeableCard } from '../../components/cards/SwipeableCard';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { useNetworkStatus } from '../../contexts/NetworkContext';

// Override with extended param list that includes startAnalysis
type CapturesStackParamListExtended = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
};

type NavigationProp = NativeStackNavigationProp<CapturesStackParamListExtended, 'CapturesList'>;

// Story 3.1 AC4: FlatList performance constants
const ITEM_HEIGHT = 169; // Fixed height for getItemLayout
const INITIAL_NUM_TO_RENDER = 10;
const MAX_TO_RENDER_PER_BATCH = 10;
const WINDOW_SIZE = 5;

export function CapturesListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isDark } = useTheme();

  // Story 3.1 AC3: Network status for offline indicator
  const { isOffline } = useNetworkStatus();

  // Zustand store pour les captures (remplace useState)
  const captures = useCapturesStore(state => state.captures);
  const isLoading = useCapturesStore(state => state.isLoading);
  const isLoadingMore = useCapturesStore(state => state.isLoadingMore);
  const hasMoreCaptures = useCapturesStore(state => state.hasMoreCaptures);
  const loadCaptures = useCapturesStore(state => state.loadCaptures);
  const loadMoreCaptures = useCapturesStore(state => state.loadMoreCaptures);

  // Active l'écoute des événements
  useCapturesListener();

  const [refreshing, setRefreshing] = useState(false);
  const [playingCaptureId, setPlayingCaptureId] = useState<string | null>(null);
  const [currentAudioPath, setCurrentAudioPath] = useState<string | null>(null);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playingWavCaptureId, setPlayingWavCaptureId] = useState<string | null>(null);

  // Debug mode from settings store (Story 2.8 - Task 8)
  const debugMode = useSettingsStore((state) => state.debugMode);
  const autoTranscriptionEnabled = useSettingsStore((state) => state.autoTranscriptionEnabled);
  const toast = useToast();

  // AC7: Model availability state (Story 2.7)
  const [hasModelAvailable, setHasModelAvailable] = useState<boolean | null>(null);

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

  // AC7: Check model availability on mount (Story 2.7)
  useEffect(() => {
    const checkModelAvailability = async () => {
      try {
        const modelService = container.resolve(TranscriptionModelService);
        const bestModel = await modelService.getBestAvailableModel();
        setHasModelAvailable(bestModel !== null);
      } catch (error) {
        console.error('[CapturesListScreen] Failed to check model availability:', error);
        setHasModelAvailable(null); // Unknown state
      }
    };
    checkModelAvailability();
  }, []);

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


  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCaptures().finally(() => {
      setRefreshing(false);
    });
  }, [loadCaptures]);

  const handleRetry = async (captureId: string) => {
    try {
      // Find the capture to check retry limit
      const capture = captures.find((c) => c.id === captureId);
      if (!capture) {
        toast.error('Capture introuvable');
        return;
      }

      // Check retry rate limit (Story 2.8 - Task 3)
      const retryService = new RetryLimitService();
      const retryCheck = retryService.canRetry(capture);

      if (!retryCheck.allowed) {
        // Retry limit reached - show countdown message
        const message = retryService.getRetryStatusMessage(capture);
        toast.error(message);
        return;
      }

      // Proceed with retry
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
        const modelService = new TranscriptionModelService();
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
          const modelService = new TranscriptionModelService();
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

  // Handler pour infinite scroll (Story 3.1 AC4)
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMoreCaptures) {
      console.log('[CapturesListScreen] End reached, loading more captures...');
      loadMoreCaptures();
    }
  }, [isLoadingMore, hasMoreCaptures, loadMoreCaptures]);

  // Story 3.1 AC4: getItemLayout for fixed-height cards (60fps scrolling)
  // IMPORTANT: Must be defined here, BEFORE any early returns, to maintain hooks order
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  // Story 3.4: Swipe action handlers
  const handleDeleteCapture = useCallback(async (captureId: string) => {
    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      await repository.delete(captureId);
      toast.success(t('captures.deleteSuccess', 'Capture supprimée'));
      await loadCaptures(); // Reload list
    } catch (error) {
      console.error('[CapturesListScreen] Delete failed:', error);
      toast.error(t('errors.deleteFailed', 'Impossible de supprimer'));
    }
  }, [loadCaptures, toast, t]);

  const handleShareCapture = useCallback(async (capture: Capture) => {
    try {
      const content = capture.normalizedText || capture.rawContent || '';
      const title = capture.type === 'audio' ? 'Capture audio Pensieve' : 'Capture texte Pensieve';

      await Share.share({
        message: content,
        title: title,
      });
    } catch (error) {
      console.error('[CapturesListScreen] Share failed:', error);
      toast.error(t('errors.shareFailed', 'Impossible de partager'));
    }
  }, [toast, t]);

  // Footer component pour pagination loading
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={colors.primary[500]} />
        <Text className="text-sm text-text-tertiary mt-2">{t('common.loading')}</Text>
      </View>
    );
  }, [isLoadingMore, t]);

  const renderCaptureItem = ({ item }: { item: CaptureWithTranscription }) => {
    const isAudio = item.type === 'audio';
    const isProcessing = item.state === 'processing';
    const isReady = item.state === 'ready';
    const isFailed = item.state === 'failed';
    const isCaptured = item.state === 'captured';
    const isPlaying = playingCaptureId === item.id && playerStatus.playing;
    const isPlayingWav = playingWavCaptureId === item.id && playerStatus.playing;

    // Check retry rate limit (Story 2.8 - Task 4)
    const retryService = new RetryLimitService();
    const retryCheck = retryService.canRetry(item);
    const canRetry = retryCheck.allowed;
    const retryMessage = retryService.getRetryStatusMessage(item);

    return (
      <SwipeableCard
        onDelete={() => handleDeleteCapture(item.id)}
        onShare={() => handleShareCapture(item)}
      >
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
                {/* AC7: Show "Pending model" badge when no model available (Story 2.7) */}
                {isCaptured && hasModelAvailable === false && !item.normalizedText && (
                  <Badge variant="failed">
                    <View className="flex-row items-center">
                      <Feather name="alert-circle" size={12} color={colors.error[700]} />
                      <Text className="ml-1 text-xs font-medium text-error-700">
                        {t('capture.status.pendingModel', 'Modèle requis')}
                      </Text>
                    </View>
                  </Badge>
                )}
                {/* Show normal status badges when model is available or unknown */}
                {isCaptured && (hasModelAvailable === true || hasModelAvailable === null || item.normalizedText) && (
                  <PulsingBadge enabled={item.isInQueue}>
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
                  </PulsingBadge>
                )}

                {isProcessing && (
                  <PulsingBadge enabled={true}>
                    <Badge variant="processing">
                      <View className="flex-row items-center">
                        <ActivityIndicator size="small" color={colors.info[600]} />
                        <Text className="ml-2 text-xs font-medium text-info-700">
                          {t('capture.status.processing')}
                        </Text>
                      </View>
                    </Badge>
                  </PulsingBadge>
                )}

                {isReady && (
                  <GerminationBadge enabled={true}>
                    <Badge variant="ready">
                      <View className="flex-row items-center">
                        <Feather name={StatusIcons.success} size={12} color={colors.success[700]} />
                        <Text className="ml-1 text-xs font-medium text-success-700">
                          {t('capture.status.ready')}
                        </Text>
                      </View>
                    </Badge>
                  </GerminationBadge>
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

                {/* Retry button (failed only) - Story 2.8 */}
                {isFailed && (
                  <View>
                    <TouchableOpacity
                      className={`w-10 h-10 rounded-lg items-center justify-center ${
                        canRetry ? 'bg-warning-500' : 'bg-neutral-300'
                      }`}
                      activeOpacity={canRetry ? 0.7 : 1}
                      disabled={!canRetry}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (canRetry) {
                          handleRetry(item.id);
                        }
                      }}
                    >
                      <Feather
                        name="refresh-cw"
                        size={22}
                        color={canRetry ? colors.neutral[0] : colors.neutral[500]}
                      />
                    </TouchableOpacity>
                    {/* Countdown message when disabled (AC3) */}
                    {!canRetry && retryCheck.remainingTime && (
                      <Text
                        className="text-xs text-error-600 mt-1 text-center"
                        style={{ maxWidth: 120 }}
                      >
                        {`Limite atteinte. ${retryCheck.remainingTime} min`}
                      </Text>
                    )}
                  </View>
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
                      {debugMode && item.transcriptionError
                        ? item.transcriptionError
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
    </SwipeableCard>
  );
  };

  // Story 3.1 AC7: Skeleton loading cards (Liquid Glass design)
  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-bg-screen" style={{ padding: 16 }}>
          <SkeletonCaptureCard delay={0} />
          <SkeletonCaptureCard delay={100} />
          <SkeletonCaptureCard delay={200} />
          <SkeletonCaptureCard delay={300} />
          <SkeletonCaptureCard delay={400} />
        </View>
      </GestureHandlerRootView>
    );
  }

  // Story 3.1 AC6: Enhanced empty state with "Jardin d'idées" metaphor
  if (captures.length === 0) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-bg-screen">
          {/* Story 3.1 AC3: Offline indicator */}
          <OfflineBanner />
          <EmptyState
            icon="feather"
            title={t('captures.emptyTitle', 'Votre jardin d\'idées est prêt à germer')}
            description={t('captures.emptyDescription', 'Capturez votre première pensée')}
            actionLabel={t('captures.emptyAction', 'Commencer')}
            onAction={() => {
              // Navigate to capture tab or trigger capture
              // @ts-ignore - Tab navigation
              navigation.getParent()?.navigate('Capture');
            }}
          />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-bg-screen">
        {/* Story 3.1 AC3: Offline indicator */}
        <OfflineBanner />

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
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          // Story 3.1 AC4: FlatList performance optimizations for 60fps
          getItemLayout={getItemLayout}
          initialNumToRender={INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
          windowSize={WINDOW_SIZE}
          removeClippedSubviews={true}
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
    </GestureHandlerRootView>
  );
}
