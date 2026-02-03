/**
 * CaptureDevTools - Development component to inspect Captures
 *
 * Architecture (Event-Driven):
 * - Uses Zustand store (captureDebugStore) for reactive state
 * - CaptureDebugStoreSync syncs EventBus events → Store
 * - NO polling for captures, pure observer pattern
 * - Network status still polled (no events available)
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { EventBus } from '../../contexts/shared/events/EventBus';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { ICrashRecoveryService } from '../../contexts/capture/domain/ICrashRecoveryService';
import type { IOfflineSyncService } from '../../contexts/capture/domain/IOfflineSyncService';
import type { IPermissionService } from '../../contexts/capture/domain/IPermissionService';
import { useCaptureDebugStore } from './stores/captureDebugStore';
import { CaptureDebugStoreSync } from './stores/CaptureDebugStoreSync';

export const CaptureDevTools = () => {
  // Zustand store - reactive state
  const { captures, syncStats, error } = useCaptureDebugStore();

  // Local UI state (not persisted)
  const [refreshing, setRefreshing] = React.useState(false);
  const [networkStatus, setNetworkStatus] = React.useState<{
    isConnected: boolean | null;
    type: Network.NetworkStateType | null;
  }>({ isConnected: null, type: null });
  const [micPermission, setMicPermission] = React.useState<boolean | null>(null);

  // Services refs (for actions)
  const repositoryRef = useRef<ICaptureRepository | null>(null);
  const crashRecoveryServiceRef = useRef<ICrashRecoveryService | null>(null);
  const offlineSyncServiceRef = useRef<IOfflineSyncService | null>(null);
  const permissionServiceRef = useRef<IPermissionService | null>(null);
  const syncRef = useRef<CaptureDebugStoreSync | null>(null);

  // Initialize services and store sync
  useEffect(() => {
    const eventBus = container.resolve<EventBus>('EventBus');
    repositoryRef.current = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
    crashRecoveryServiceRef.current = container.resolve<ICrashRecoveryService>(TOKENS.ICrashRecoveryService);
    offlineSyncServiceRef.current = container.resolve<IOfflineSyncService>(TOKENS.IOfflineSyncService);
    permissionServiceRef.current = container.resolve<IPermissionService>(TOKENS.IPermissionService);

    // Start store sync
    syncRef.current = new CaptureDebugStoreSync(
      eventBus,
      repositoryRef.current,
      offlineSyncServiceRef.current
    );
    syncRef.current.start();

    // Check mic permission on mount
    checkMicPermission();

    return () => {
      // Cleanup sync on unmount
      if (syncRef.current) {
        syncRef.current.stop();
        syncRef.current = null;
      }
    };
  }, []);

  const simulateCrash = async () => {
    if (!repositoryRef.current) return;

    try {
      // Create a capture in "recording" state to simulate a crash
      // Use a fake but valid-looking file path
      await repositoryRef.current.create({
        type: 'audio',
        state: 'recording',
        rawContent: 'file:///data/user/0/com.pensine.app/cache/Audio/crash_test_fake.m4a',
      });

      Alert.alert(
        '💥 Crash simulé',
        'Une capture en cours d\'enregistrement a été créée avec un fichier inexistant.\n\nRedémarrez l\'app ou tapez "Récupération crash" pour voir le recovery en action.',
        [{ text: 'OK' }]
      );
      // Store auto-updates via CaptureRecorded event
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de simuler le crash');
    }
  };

  const runCrashRecovery = async () => {
    if (!crashRecoveryServiceRef.current) return;

    try {
      const recovered = await crashRecoveryServiceRef.current.recoverIncompleteRecordings();

      if (recovered.length === 0) {
        Alert.alert(
          '✅ Aucune récupération nécessaire',
          'Aucun enregistrement interrompu trouvé.',
          [{ text: 'OK' }]
        );
      } else {
        const recoveredCount = recovered.filter((r) => r.state === 'recovered').length;
        const failedCount = recovered.filter((r) => r.state === 'failed').length;

        Alert.alert(
          '🔄 Récupération terminée',
          `Récupéré: ${recoveredCount}\nÉchoué: ${failedCount}`,
          [{ text: 'OK' }]
        );
      }
      // Store auto-updates via events
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la récupération');
    }
  };

  const deleteAllCaptures = async () => {
    if (!repositoryRef.current) return;

    Alert.alert(
      '⚠️ Supprimer toutes les captures',
      'Êtes-vous sûr de vouloir supprimer TOUTES les captures de la base de données?\n\nCette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer tout',
          style: 'destructive',
          onPress: async () => {
            if (!repositoryRef.current) return;

            try {
              const allCaptures = await repositoryRef.current.findAll();
              let deletedCount = 0;

              for (const capture of allCaptures) {
                const deleteResult = await repositoryRef.current.delete(capture.id);
                if (deleteResult.type === 'success') {
                  deletedCount++;
                }
              }

              Alert.alert('✅ Succès', `${deletedCount} capture(s) supprimée(s)`);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer les captures');
            }
          },
        },
      ]
    );
  };

  const deleteFailedCaptures = async () => {
    if (!crashRecoveryServiceRef.current) return;

    try {
      const deletedCount = await crashRecoveryServiceRef.current.clearFailedCaptures();
      Alert.alert('✅ Succès', `${deletedCount} capture(s) échouée(s) supprimée(s)`);
      // Store auto-updates via CaptureDeleted events
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de supprimer les captures échouées');
    }
  };

  const purgeAudioFiles = async () => {
    Alert.alert(
      '🧹 Purger les fichiers audio',
      'Supprimer tous les fichiers audio (cache expo-audio + stockage permanent)?\n\nLes entrées en base de données seront conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Purger',
          style: 'destructive',
          onPress: async () => {
            try {
              let deletedCount = 0;

              // Purge cache expo-audio
              const cacheAudioDir = `${FileSystem.cacheDirectory}Audio/`;
              const cacheInfo = await FileSystem.getInfoAsync(cacheAudioDir);

              if (cacheInfo.exists) {
                const cacheFiles = await FileSystem.readDirectoryAsync(cacheAudioDir);
                for (const file of cacheFiles) {
                  await FileSystem.deleteAsync(`${cacheAudioDir}${file}`, { idempotent: true });
                  deletedCount++;
                }
              }

              // Purge stockage permanent
              const audioDir = `${FileSystem.documentDirectory}audio/`;
              const audioInfo = await FileSystem.getInfoAsync(audioDir);

              if (audioInfo.exists) {
                const audioFiles = await FileSystem.readDirectoryAsync(audioDir);
                for (const file of audioFiles) {
                  await FileSystem.deleteAsync(`${audioDir}${file}`, { idempotent: true });
                  deletedCount++;
                }
              }

              Alert.alert('✅ Succès', `${deletedCount} fichier(s) audio supprimé(s)`);
            } catch (error) {
              console.error('[DevTools] Purge audio files error:', error);
              Alert.alert('Erreur', 'Impossible de purger les fichiers audio');
            }
          },
        },
      ]
    );
  };

  const openAppSettings = async () => {
    if (!permissionServiceRef.current) {
      Alert.alert('Erreur', 'Service de permissions non initialisé');
      return;
    }

    const hasPermission = await permissionServiceRef.current.hasMicrophonePermission();

    Alert.alert(
      '⚙️ Paramètres de l\'app',
      `Permission microphone: ${hasPermission ? '✅ Accordée' : '❌ Refusée'}\n\nPour modifier la permission microphone:\n1. Ouvrir les paramètres de l'app\n2. Aller dans Autorisations\n3. Activer/Désactiver Microphone`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Ouvrir Paramètres',
          onPress: async () => {
            try {
              await Linking.openSettings();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'ouvrir les paramètres');
            }
          },
        },
      ]
    );
  };

  const checkMicPermission = async () => {
    if (!permissionServiceRef.current) {
      console.warn('[DevTools] PermissionService not initialized yet');
      return;
    }

    const hasPermission = await permissionServiceRef.current.hasMicrophonePermission();
    setMicPermission(hasPermission);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Reload store from repository
    if (syncRef.current) {
      await syncRef.current.loadInitialState();
    }
    await checkMicPermission();
    setRefreshing(false);
  };

  // Monitor network status changes
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        setNetworkStatus({
          isConnected: networkState.isConnected ?? false,
          type: networkState.type,
        });
      } catch (error) {
        console.error('[DevTools] Failed to get network status:', error);
        setNetworkStatus({ isConnected: null, type: null });
      }
    };

    // Check initial status
    checkNetworkStatus();

    // Poll every 3 seconds for network changes
    const interval = setInterval(checkNetworkStatus, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'recording':
        return { backgroundColor: '#FF3B30' }; // Red
      case 'captured':
        return { backgroundColor: '#34C759' }; // Green
      case 'ready':
        return { backgroundColor: '#007AFF' }; // Blue
      case 'failed':
        return { backgroundColor: '#FF9500' }; // Orange
      case 'processing':
        return { backgroundColor: '#FFD60A' }; // Yellow
      default:
        return { backgroundColor: '#8E8E93' }; // Gray
    }
  };

  const getSyncColor = (syncStatus: string) => {
    switch (syncStatus) {
      case 'pending':
        return { backgroundColor: '#FFD60A' }; // Yellow
      case 'synced':
        return { backgroundColor: '#34C759' }; // Green
      default:
        return { backgroundColor: '#8E8E93' }; // Gray
    }
  };

  const getNetworkStatusDisplay = () => {
    if (networkStatus.isConnected === null) {
      return { icon: '⏳', text: 'Checking...', color: '#8E8E93' };
    }
    if (networkStatus.isConnected) {
      // expo-network types: WIFI, CELLULAR, etc.
      const typeEmoji = networkStatus.type === Network.NetworkStateType.WIFI ? '📶' : '📱';
      return { icon: typeEmoji, text: 'Online', color: '#34C759' };
    }
    return { icon: '✈️', text: 'Offline', color: '#FF3B30' };
  };

  const networkDisplay = getNetworkStatusDisplay();

  const getMicPermissionDisplay = () => {
    if (micPermission === null) {
      return { icon: '⏳', text: 'Checking...', color: '#8E8E93' };
    }
    if (micPermission) {
      return { icon: '🎤', text: 'Microphone OK', color: '#34C759' };
    }
    return { icon: '🔇', text: 'Micro refusé', color: '#FF3B30' };
  };

  const micDisplay = getMicPermissionDisplay();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Capture DevTools</Text>
        <View style={styles.badgesRow}>
          <View style={[styles.networkBadge, { backgroundColor: networkDisplay.color }]}>
            <Text style={styles.networkBadgeText}>
              {networkDisplay.icon} {networkDisplay.text}
            </Text>
          </View>
          <View style={[styles.networkBadge, { backgroundColor: micDisplay.color }]}>
            <Text style={styles.networkBadgeText}>
              {micDisplay.icon} {micDisplay.text}
            </Text>
          </View>
        </View>
        <Text style={styles.count}>
          {captures.length} capture{captures.length !== 1 ? 's' : ''} en base
        </Text>
      </View>

      {/* Sync Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>En attente</Text>
          <Text style={styles.statValue}>{syncStats.pending}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Synchronisé</Text>
          <Text style={styles.statValue}>{syncStats.synced}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{syncStats.total}</Text>
        </View>
      </View>

      {/* Test Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={simulateCrash}>
          <Text style={styles.actionButtonText}>💥 Simuler crash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={runCrashRecovery}>
          <Text style={styles.actionButtonText}>🔄 Récupération crash</Text>
        </TouchableOpacity>
      </View>

      {/* Cleanup Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity style={[styles.actionButton, styles.warningButton]} onPress={deleteFailedCaptures}>
          <Text style={styles.actionButtonText}>🗑️ Supprimer failed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={deleteAllCaptures}>
          <Text style={styles.actionButtonText}>💣 Tout supprimer</Text>
        </TouchableOpacity>
      </View>

      {/* File Cleanup Button */}
      <View style={styles.settingsButtonContainer}>
        <TouchableOpacity style={[styles.fullWidthButton, styles.warningButton]} onPress={purgeAudioFiles}>
          <Text style={styles.actionButtonText}>🧹 Purger fichiers audio</Text>
        </TouchableOpacity>
      </View>

      {/* Permission Settings Button */}
      <View style={styles.settingsButtonContainer}>
        <TouchableOpacity style={[styles.fullWidthButton, styles.settingsButton]} onPress={openAppSettings}>
          <Text style={styles.actionButtonText}>⚙️ Ouvrir Paramètres</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Erreur: {error}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {captures.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Aucune capture en base.{'\n'}
              Enregistrez une capture pour la voir apparaître ici.
            </Text>
          </View>
        ) : (
          captures.map((capture, index) => (
            <View key={capture.id} style={styles.captureCard}>
              <View style={styles.captureHeader}>
                <Text style={styles.captureIndex}>#{index + 1}</Text>
                <View style={styles.badgesContainer}>
                  <View style={[styles.stateBadge, getStateColor(capture.state)]}>
                    <Text style={styles.badgeText}>{capture.state}</Text>
                  </View>
                  <View style={[styles.syncBadge, getSyncColor(capture.syncStatus)]}>
                    <Text style={styles.badgeText}>{capture.syncStatus}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>ID:</Text>
                <Text style={styles.value}>{capture.id.substring(0, 16)}...</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{capture.type}</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>État:</Text>
                <Text style={styles.value}>{capture.state}</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>Sync:</Text>
                <Text style={styles.value}>{capture.syncStatus}</Text>
              </View>

              {capture.rawContent && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Fichier:</Text>
                  <Text style={styles.valueSmall} numberOfLines={2}>
                    {capture.rawContent}
                  </Text>
                </View>
              )}

              {capture.duration && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Durée:</Text>
                  <Text style={styles.valueSmall}>
                    {Math.floor(capture.duration / 1000)}s
                  </Text>
                </View>
              )}

              {capture.fileSize && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Taille:</Text>
                  <Text style={styles.valueSmall}>
                    {(capture.fileSize / 1024).toFixed(1)} KB
                  </Text>
                </View>
              )}

              <View style={styles.captureRow}>
                <Text style={styles.label}>Créé:</Text>
                <Text style={styles.valueSmall}>
                  {capture.createdAt.toLocaleString('fr-FR')}
                </Text>
              </View>

              {capture.normalizedText && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Transcription:</Text>
                  <Text style={styles.valueSmall} numberOfLines={3}>
                    {capture.normalizedText}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>🔄 Rafraîchir</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  header: {
    backgroundColor: '#2D2D2D',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',

    marginBottom: 8,
  },
  networkBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  networkBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  count: {
    fontSize: 14,
    color: '#888888',
  },
  errorContainer: {
    backgroundColor: '#5C1A1A',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF4444',
  },
  errorText: {
    color: '#FF8888',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  captureCard: {
    backgroundColor: '#2D2D2D',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  captureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  captureIndex: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stateBadge: {
    backgroundColor: '#404040',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgesContainer: {
    flexDirection: 'row',

  },
  syncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,

    backgroundColor: '#2D2D2D',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#404040',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,

    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fullWidthButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#007AFF',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  dangerButton: {
    backgroundColor: '#8E1A1A',
  },
  settingsButtonContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  settingsButton: {
    backgroundColor: '#8E8E93',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  stateText: {
    color: '#00CC66',
    fontSize: 12,
    fontWeight: 'bold',
  },
  captureRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    color: '#888888',
    fontSize: 14,
    width: 100,
    fontWeight: '600',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  valueSmall: {
    color: '#CCCCCC',
    fontSize: 12,
    flex: 1,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
