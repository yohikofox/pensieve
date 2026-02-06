/**
 * CapturesListScreen - Display all captures with transcription status
 *
 * Story 2.5 - Task 5.1: Show progress indicator on captures
 * Story 3.1: Liste Chronologique des Captures
 *
 * Features:
 * - List all captures (audio + text) in reverse chronological order (AC1)
 * - Show transcription status for audio captures
 * - Offline indicator banner (AC3)
 * - Empty state with "Jardin d'idées" metaphor (AC6)
 * - Skeleton loading with shimmer animation (AC7)
 * - Infinite scroll with FlatList optimizations (AC4)
 * - Pull-to-refresh (AC5)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  AccessibilityInfo,
  StyleSheet,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import LottieView from "lottie-react-native";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { useCapturesStore } from "../../stores/capturesStore";
import { useCapturesListener } from "../../hooks/useCapturesListener";
import { useCaptureAudioPlayer } from "../../hooks/useCaptureAudioPlayer";
import { useCaptureTranscription } from "../../hooks/useCaptureTranscription";
import { useDialogState } from "../../hooks/useDialogState";
import { useCaptureActions } from "../../hooks/useCaptureActions";
import { useSyncService } from "../../hooks/useServices";
import { useTheme } from "../../hooks/useTheme";
import { colors } from "../../design-system/tokens";
import { Button, AlertDialog } from "../../design-system/components";
import { SkeletonCaptureCard } from "../../components/skeletons/SkeletonCaptureCard";
import { AnimatedEmptyState } from "../../components/animations/AnimatedEmptyState";
import { CaptureListItem } from "../../components/captures/CaptureListItem";
import { ContextMenu } from "../../components/menus/ContextMenu";
import { OfflineBanner } from "../../components/common/OfflineBanner";
import { useNetworkStatus } from "../../contexts/NetworkContext";
import { FLATLIST_PERFORMANCE } from "../../constants/performance";
import {
  FlatListPerformanceMonitor,
  measureAsync,
} from "../../utils/performanceMonitor";
import { StandardLayout } from "../../components/layouts";

// Override with extended param list that includes startAnalysis
type CapturesStackParamListExtended = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
};

type CaptureWithQueue = Capture & {
  isInQueue?: boolean;
};

type NavigationProp = NativeStackNavigationProp<
  CapturesStackParamListExtended,
  "CapturesList"
>;

export function CapturesListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { isDark } = useTheme();
  const { isOffline } = useNetworkStatus();

  // Zustand stores
  const captures = useCapturesStore((state) => state.captures);
  const isLoading = useCapturesStore((state) => state.isLoading);
  const isLoadingMore = useCapturesStore((state) => state.isLoadingMore);
  const hasMoreCaptures = useCapturesStore((state) => state.hasMoreCaptures);
  const loadCaptures = useCapturesStore((state) => state.loadCaptures);
  const loadMoreCaptures = useCapturesStore((state) => state.loadMoreCaptures);

  // Custom hooks for feature separation
  const audioPlayer = useCaptureAudioPlayer();
  const transcription = useCaptureTranscription();
  const dialogs = useDialogState();
  const actions = useCaptureActions();
  const syncService = useSyncService();

  // Listen to capture events
  useCapturesListener();

  // Local state
  const [refreshing, setRefreshing] = useState(false);
  const [isReduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuCapture, setContextMenuCapture] = useState<Capture | null>(
    null,
  );
  const [hasLottieAnimations] = useState(true);

  // Performance monitoring
  const performanceMonitor = useRef(
    new FlatListPerformanceMonitor("CapturesListScreen", __DEV__),
  ).current;

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Check Reduce Motion preference
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );
    return () => subscription?.remove();
  }, []);

  // Load captures on mount
  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 300));

    await measureAsync("Pull to refresh", async () => {
      if (syncService && !isOffline) {
        await Promise.all([
          syncService.syncCaptures().catch(() => {}),
          loadCaptures(),
          minDelay,
        ]);
      } else {
        await Promise.all([loadCaptures(), minDelay]);
      }
    });

    setRefreshing(false);
  }, [syncService, loadCaptures, isOffline]);

  const handleCapturePress = useCallback(
    (captureId: string) => {
      LayoutAnimation.configureNext({
        duration: 300,
        update: { type: LayoutAnimation.Types.easeInEaseOut },
      });
      navigation.navigate("CaptureDetail", { captureId });
    },
    [navigation],
  );

  const confirmDeleteWav = useCallback(async () => {
    if (!dialogs.deleteWavDialog.capture) return;
    await actions.handleDeleteWav(
      dialogs.deleteWavDialog.capture,
      audioPlayer.stopWavPlayback,
    );
    dialogs.deleteWavDialog.close();
  }, [dialogs.deleteWavDialog, actions, audioPlayer]);

  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMoreCaptures) {
      loadMoreCaptures();
    }
  }, [isLoadingMore, hasMoreCaptures, loadMoreCaptures]);

  const handleLongPress = useCallback((capture: Capture) => {
    setContextMenuCapture(capture);
    setContextMenuVisible(true);
  }, []);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color={colors.primary[500]} />
        <Text className="text-sm text-text-tertiary mt-2">
          {t("common.loading")}
        </Text>
      </View>
    );
  }, [isLoadingMore, t]);

  const renderCaptureItem = useCallback(
    ({ item, index }: { item: CaptureWithTranscription; index: number }) => {
      const isPlaying =
        audioPlayer.playingCaptureId === item.id &&
        audioPlayer.playerStatus.playing;
      const isPlayingWav =
        audioPlayer.playingWavCaptureId === item.id &&
        audioPlayer.playerStatus.playing;

      return (
        <CaptureListItem
          item={item}
          index={index}
          isReduceMotionEnabled={isReduceMotionEnabled}
          playback={{
            isPlaying,
            isPlayingWav,
            hasModelAvailable: transcription.hasModelAvailable,
          }}
          handlers={{
            onPress: () => handleCapturePress(item.id),
            onStop: () => audioPlayer.handleStop(item),
            onPlayPause: () => audioPlayer.handlePlayPause(item),
            onTranscribe: () =>
              transcription.handleTranscribe(item, dialogs.modelDialog.open),
            onRetry: () => transcription.handleRetry(item),
            onPlayWav: () => audioPlayer.handlePlayWav(item),
            onDeleteWav: () => dialogs.deleteWavDialog.open(item),
            onLongPress: () => handleLongPress(item),
            onDelete: () => actions.handleDelete(item.id),
            onShare: () => actions.handleShare(item),
          }}
        />
      );
    },
    [
      isReduceMotionEnabled,
      audioPlayer,
      transcription,
      dialogs,
      actions,
      handleCapturePress,
      handleLongPress,
    ],
  );

  // Story 3.1 AC7: Skeleton loading cards (Liquid Glass design)
  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StandardLayout noPadding={false} style={{ padding: 16 }}>
          <SkeletonCaptureCard delay={0} />
          <SkeletonCaptureCard delay={100} />
          <SkeletonCaptureCard delay={200} />
          <SkeletonCaptureCard delay={300} />
          <SkeletonCaptureCard delay={400} />
        </StandardLayout>
      </GestureHandlerRootView>
    );
  }

  // Story 3.1 AC6: Enhanced empty state with "Jardin d'idées" metaphor
  // Story 3.4 AC8: Animated empty state with breathing animation + Lottie
  if (captures.length === 0) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StandardLayout>
          {/* Story 3.1 AC3: Offline indicator */}
          <OfflineBanner />

          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            {/* Zone avec animation breeze + breathing - uniquement icône */}
            <AnimatedEmptyState enabled={!isReduceMotionEnabled}>
              <View style={{ position: "relative", marginBottom: 24 }}>
                {/* Lottie Background Animation - Breeze (very subtle) - only on icon */}
                {hasLottieAnimations && !isReduceMotionEnabled && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LottieView
                      source={require("../../../assets/animations/breeze.json")}
                      autoPlay
                      loop
                      style={{ flex: 1 }}
                      speed={0.5}
                      {...{ opacity: 0.2 }}
                    />
                  </View>
                )}

                {/* Icon */}
                <View className="w-20 h-20 rounded-full bg-bg-subtle items-center justify-center">
                  <Feather
                    name="feather"
                    size={40}
                    color={isDark ? colors.success[400] : colors.success[300]}
                  />
                </View>
              </View>
            </AnimatedEmptyState>

            {/* Title - no animation */}
            <Text className="text-xl font-semibold text-text-primary text-center mb-2">
              {t(
                "captures.emptyTitle",
                "Votre jardin d'idées est prêt à germer",
              )}
            </Text>

            {/* Description - no animation */}
            <Text className="text-base text-text-tertiary text-center mb-6">
              {t("captures.emptyDescription", "Capturez votre première pensée")}
            </Text>

            {/* Button with butterfly positioned on top-right corner */}
            <View style={{ position: "relative" }}>
              <Button
                variant="primary"
                onPress={() => {
                  // Navigate to capture tab or trigger capture
                  // @ts-ignore - Tab navigation
                  navigation.getParent()?.navigate("Capture");
                }}
              >
                {t("captures.emptyAction", "Commencer")}
              </Button>

              {/* Lottie Foreground Animation - Butterfly on button top-right corner */}
              {hasLottieAnimations && !isReduceMotionEnabled && (
                <View style={{ position: "absolute", top: -35, right: -35 }}>
                  <LottieView
                    source={require("../../../assets/animations/butterfly.json")}
                    autoPlay
                    loop
                    style={{ width: 70, height: 70 }}
                    speed={0.8}
                  />
                </View>
              )}
            </View>
          </View>
        </StandardLayout>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StandardLayout>
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
          onEndReachedThreshold={FLATLIST_PERFORMANCE.END_REACHED_THRESHOLD}
          ListFooterComponent={renderFooter}
          // Story 3.1 AC4: FlatList performance optimizations for 60fps
          // Note: getItemLayout removed - cards have variable heights (debug mode, transcription)
          initialNumToRender={FLATLIST_PERFORMANCE.INITIAL_NUM_TO_RENDER}
          maxToRenderPerBatch={FLATLIST_PERFORMANCE.MAX_TO_RENDER_PER_BATCH}
          windowSize={FLATLIST_PERFORMANCE.WINDOW_SIZE}
          removeClippedSubviews={true}
          // Story 3.4 Task 7.5: Performance monitoring
          onScroll={performanceMonitor.onScroll}
          scrollEventThrottle={16}
        />

        {/* Model not available dialog */}
        <AlertDialog
          visible={dialogs.modelDialog.visible}
          onClose={dialogs.modelDialog.close}
          title={t("settings.transcription.whisperModel")}
          message={t("capture.alerts.serviceNotInitialized")}
          icon="alert-triangle"
          variant="warning"
          confirmAction={{
            label: t("navigation.tabs.settings"),
            onPress: () => {
              dialogs.modelDialog.close();
              // @ts-ignore - Tab navigation
              navigation.getParent()?.navigate("Settings");
            },
          }}
          cancelAction={{
            label: t("common.cancel"),
            onPress: dialogs.modelDialog.close,
          }}
        />

        {/* Delete WAV confirmation dialog */}
        <AlertDialog
          visible={dialogs.deleteWavDialog.visible}
          onClose={dialogs.deleteWavDialog.close}
          title={t("common.delete")}
          message={t("captures.deleteConfirm.message")}
          icon="trash-2"
          variant="danger"
          confirmAction={{
            label: t("common.delete"),
            onPress: confirmDeleteWav,
          }}
          cancelAction={{
            label: t("common.cancel"),
            onPress: dialogs.deleteWavDialog.close,
          }}
        />

        {/* Context menu (long-press) */}
        <ContextMenu
          visible={contextMenuVisible}
          onClose={() => {
            setContextMenuVisible(false);
            setContextMenuCapture(null);
          }}
          options={
            contextMenuCapture
              ? [
                  {
                    icon: "share-2",
                    label: t("captures.actions.share", "Partager"),
                    onPress: () => actions.handleShare(contextMenuCapture),
                  },
                  {
                    icon: "trash-2",
                    label: t("captures.actions.delete", "Supprimer"),
                    onPress: () => actions.handleDelete(contextMenuCapture.id),
                    variant: "danger" as const,
                  },
                  {
                    icon: "bookmark",
                    label: t("captures.actions.pin", "Épingler"),
                    onPress: () => actions.handlePin(contextMenuCapture),
                  },
                  {
                    icon: "heart",
                    label: t("captures.actions.favorite", "Favoris"),
                    onPress: () => actions.handleFavorite(contextMenuCapture),
                  },
                ]
              : []
          }
        />
      </StandardLayout>
    </GestureHandlerRootView>
  );
}
