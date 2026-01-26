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

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { container } from "tsyringe";
import { TOKENS } from "../../infrastructure/di/tokens";
import type { ICaptureRepository } from "../../contexts/capture/domain/ICaptureRepository";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import { TranscriptionQueueService } from "../../contexts/Normalization/services/TranscriptionQueueService";
import { WhisperModelService } from "../../contexts/Normalization/services/WhisperModelService";
import { TranscriptionEngineService } from "../../contexts/Normalization/services/TranscriptionEngineService";
import { NativeTranscriptionEngine } from "../../contexts/Normalization/services/NativeTranscriptionEngine";
import { useSettingsStore } from "../../stores/settingsStore";
// Override with extended param list that includes startAnalysis
type CapturesStackParamListExtended = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type CaptureWithTranscription = Capture & {
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
};

type NavigationProp = NativeStackNavigationProp<
  CapturesStackParamListExtended,
  "CapturesList"
>;

export function CapturesListScreen() {
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

  // Reset playing state when audio finishes
  useEffect(() => {
    if (playerStatus.didJustFinish) {
      setPlayingCaptureId(null);
    }
  }, [playerStatus.didJustFinish]);

  const handlePlayPause = useCallback(
    (capture: Capture) => {
      const audioPath = capture.rawContent;
      if (!audioPath) {
        Alert.alert("Erreur", "Fichier audio introuvable");
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
    [playingCaptureId, currentAudioPath, playerStatus.playing, player],
  );

  const loadCaptures = useCallback(async () => {
    try {
      const repository = container.resolve<ICaptureRepository>(
        TOKENS.ICaptureRepository,
      );
      const allCaptures = await repository.findAll();

      // Sort by createdAt descending (newest first)
      const sorted = allCaptures.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      setCaptures(sorted);
    } catch (error) {
      console.error("[CapturesListScreen] Failed to load captures:", error);
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
      console.error("[CapturesListScreen] Retry failed:", error);
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
          Alert.alert(
            "Modèle requis",
            "Aucun modèle Whisper n'est téléchargé. Veuillez en télécharger un dans les Paramètres.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Aller aux Paramètres",
                onPress: () => {
                  // Navigate to Settings tab
                  // @ts-ignore - Tab navigation
                  navigation.getParent()?.navigate("Settings");
                },
              },
            ],
          );
          return;
        }
      } else if (selectedEngine === 'native') {
        // Check if native transcription is available
        const nativeEngine = container.resolve(NativeTranscriptionEngine);
        const isAvailable = await nativeEngine.isAvailable();

        if (!isAvailable) {
          Alert.alert(
            "Transcription native indisponible",
            "La transcription native n'est pas disponible sur cet appareil. Veuillez activer Whisper dans les Paramètres.",
            [
              { text: "Annuler", style: "cancel" },
              {
                text: "Aller aux Paramètres",
                onPress: () => {
                  // @ts-ignore - Tab navigation
                  navigation.getParent()?.navigate("Settings");
                },
              },
            ],
          );
          return;
        }

        // Check if native file transcription is supported (Android 13+ only)
        // If not, it will fall back to Whisper, so we need Whisper model
        const isNativeFileSupported = Platform.OS === 'android' &&
          typeof Platform.Version === 'number' &&
          Platform.Version >= 33;

        if (!isNativeFileSupported) {
          // Will fall back to Whisper - check if model is available
          const modelService = new WhisperModelService();
          const bestModel = await modelService.getBestAvailableModel();

          if (!bestModel) {
            Alert.alert(
              "Modèle Whisper requis",
              "La transcription native de fichiers audio n'est pas supportée sur cet appareil (Android 13+ requis). " +
              "Un modèle Whisper est nécessaire comme alternative.",
              [
                { text: "Annuler", style: "cancel" },
                {
                  text: "Aller aux Paramètres",
                  onPress: () => {
                    // @ts-ignore - Tab navigation
                    navigation.getParent()?.navigate("Settings");
                  },
                },
              ],
            );
            return;
          }
        }
      }

      // Enqueue for transcription
      const queueService = container.resolve(TranscriptionQueueService);
      await queueService.enqueue({
        captureId: capture.id,
        audioPath: capture.rawContent || "",
        audioDuration: capture.duration ?? undefined,
      });

      console.log(
        "[CapturesListScreen] 📝 Enqueued capture for transcription:",
        capture.id,
        `[${selectedEngine}]`,
      );
      loadCaptures();
    } catch (error) {
      console.error(
        "[CapturesListScreen] Failed to enqueue transcription:",
        error,
      );
      Alert.alert("Erreur", "Impossible de lancer la transcription");
    }
  };

  const handleCapturePress = (captureId: string) => {
    navigation.navigate("CaptureDetail", { captureId });
  };

  /**
   * Handle WAV playback (debug feature)
   */
  const handlePlayWav = useCallback(
    (capture: Capture) => {
      if (!capture.wavPath) {
        Alert.alert("Erreur", "Fichier WAV introuvable");
        return;
      }

      // If same capture, toggle play/pause
      if (playingWavCaptureId === capture.id && currentAudioPath === capture.wavPath) {
        if (playerStatus.playing) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Different capture or different file - switch to WAV
        setCurrentAudioPath(capture.wavPath);
        setPlayingCaptureId(null); // Not playing original audio
        setPlayingWavCaptureId(capture.id);
        setShouldAutoPlay(true);
      }
    },
    [playingWavCaptureId, currentAudioPath, playerStatus.playing, player],
  );

  /**
   * Delete WAV file for a capture (debug cleanup)
   */
  const handleDeleteWav = useCallback(
    async (capture: Capture) => {
      if (!capture.wavPath) return;

      Alert.alert(
        "Supprimer le WAV ?",
        "Le fichier WAV de debug sera supprimé définitivement.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Supprimer",
            style: "destructive",
            onPress: async () => {
              try {
                // Delete the file
                await FileSystemLegacy.deleteAsync(capture.wavPath!, { idempotent: true });

                // Update capture to clear wavPath
                const repository = container.resolve<ICaptureRepository>(
                  TOKENS.ICaptureRepository,
                );
                await repository.update(capture.id, { wavPath: null });

                // Stop playback if this WAV was playing
                if (playingWavCaptureId === capture.id) {
                  player.pause();
                  setPlayingWavCaptureId(null);
                  setCurrentAudioPath(null);
                }

                // Refresh list
                loadCaptures();
                console.log("[CapturesListScreen] 🗑️ Deleted WAV for capture:", capture.id);
              } catch (error) {
                console.error("[CapturesListScreen] Failed to delete WAV:", error);
                Alert.alert("Erreur", "Impossible de supprimer le fichier WAV");
              }
            },
          },
        ],
      );
    },
    [playingWavCaptureId, player, loadCaptures],
  );

  const renderCaptureItem = ({ item }: { item: CaptureWithTranscription }) => {
    const isAudio = item.type === "audio";
    const isProcessing = item.state === "processing";
    const isReady = item.state === "ready";
    const isFailed = item.state === "failed";
    const isCaptured = item.state === "captured";

    return (
      <TouchableOpacity
        style={styles.captureCard}
        onPress={() => handleCapturePress(item.id)}
        activeOpacity={0.7}
      >
        {/* Header: Type + Time */}
        <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <Text style={styles.typeIcon}>{isAudio ? "🎙️" : "✏️"}</Text>
            <Text style={styles.typeLabel}>{isAudio ? "Audio" : "Texte"}</Text>
          </View>
          <Text style={styles.timestamp}>
            {item.createdAt.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          {isAudio && isCaptured && (
            <View style={styles.pendingRow}>
              <View style={[styles.statusBadge, styles.statusPending]}>
                <Text style={styles.statusText}>⏳ En attente</Text>
              </View>
              <TouchableOpacity
                style={styles.transcribeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleTranscribe(item);
                }}
              >
                <Text style={styles.transcribeButtonText}>🎯 Transcrire</Text>
              </TouchableOpacity>
            </View>
          )}
          {isAudio && isProcessing && (
            <View style={[styles.statusBadge, styles.statusProcessing]}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.statusText, { marginLeft: 8 }]}>
                Transcription...
              </Text>
            </View>
          )}
          {isAudio && isReady && (
            <View style={styles.readyRow}>
              <View style={[styles.statusBadge, styles.statusReady]}>
                <Text style={styles.statusText}>✅ Prêt</Text>
              </View>
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  console.log('[CapturesListScreen] Analyze button pressed for capture:', item.id);
                  navigation.navigate('CaptureDetail', { captureId: item.id, startAnalysis: true });
                }}
              >
                <Text style={styles.analyzeButtonText}>📊 Analyser</Text>
              </TouchableOpacity>
            </View>
          )}
          {isAudio && isFailed && (
            <View style={[styles.statusBadge, styles.statusFailed]}>
              <Text style={styles.statusText}>❌ Échec</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => handleRetry(item.id)}
              >
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {isAudio ? (
            <>
              {/* Audio controls: Duration + Play button */}
              <View style={styles.audioControlsRow}>
                {item.duration && (
                  <Text style={styles.duration}>
                    Durée: {Math.floor(item.duration / 1000)}s
                  </Text>
                )}
                <View style={styles.audioButtonsGroup}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handlePlayPause(item);
                    }}
                  >
                    <Text style={styles.playButtonText}>
                      {playingCaptureId === item.id && playerStatus.playing
                        ? "⏸️ Pause"
                        : "▶️ Écouter"}
                    </Text>
                  </TouchableOpacity>

                  {/* WAV debug buttons - only show if debug mode AND wavPath exists */}
                  {debugMode && item.wavPath && (
                    <>
                      <TouchableOpacity
                        style={[styles.playButton, styles.wavButton]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handlePlayWav(item);
                        }}
                      >
                        <Text style={styles.playButtonText}>
                          {playingWavCaptureId === item.id && playerStatus.playing
                            ? "⏸️ WAV"
                            : "🔊 WAV"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.playButton, styles.deleteWavButton]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteWav(item);
                        }}
                      >
                        <Text style={styles.deleteWavButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
              {/* Transcription result */}
              {item.normalizedText ? (
                <Text style={styles.transcriptionText} numberOfLines={4}>
                  {item.normalizedText}
                </Text>
              ) : isProcessing ? (
                <Text style={styles.placeholderText}>
                  Transcription en cours...
                </Text>
              ) : isCaptured ? (
                <Text style={styles.placeholderText}>
                  En attente de transcription
                </Text>
              ) : isFailed ? (
                <Text style={styles.errorText}>La transcription a échoué</Text>
              ) : null}
            </>
          ) : (
            /* Text capture - show content directly */
            <Text style={styles.textContent} numberOfLines={4}>
              {item.rawContent || item.normalizedText || "(Contenu vide)"}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {captures.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>Aucune capture</Text>
          <Text style={styles.emptySubtitle}>
            Utilisez l'onglet "Capturer" pour enregistrer vos pensées
          </Text>
        </View>
      ) : (
        <FlatList
          data={captures}
          keyExtractor={(item) => item.id}
          renderItem={renderCaptureItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#8E8E93",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  captureCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  timestamp: {
    fontSize: 12,
    color: "#8E8E93",
  },
  statusContainer: {
    marginBottom: 12,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  analyzeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#9C27B0",
    borderRadius: 8,
  },
  analyzeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusPending: {
    backgroundColor: "#FFF3E0",
  },
  transcribeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  transcribeButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statusProcessing: {
    backgroundColor: "#E3F2FD",
  },
  statusReady: {
    backgroundColor: "#E8F5E9",
  },
  statusFailed: {
    backgroundColor: "#FFEBEE",
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  retryButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#FF5722",
    borderRadius: 4,
  },
  retryText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  contentContainer: {
    marginTop: 4,
  },
  audioControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  duration: {
    fontSize: 12,
    color: "#8E8E93",
  },
  audioButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F0F0F5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0E0E5",
  },
  wavButton: {
    backgroundColor: "#E8F5E9",
    borderColor: "#81C784",
  },
  deleteWavButton: {
    backgroundColor: "#FFEBEE",
    borderColor: "#EF9A9A",
    paddingHorizontal: 8,
  },
  deleteWavButtonText: {
    fontSize: 14,
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  transcriptionText: {
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
  },
  placeholderText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 14,
    color: "#D32F2F",
    fontStyle: "italic",
  },
  textContent: {
    fontSize: 15,
    color: "#000",
    lineHeight: 22,
  },
});
