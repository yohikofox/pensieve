/**
 * CaptureDevTools - Development component to inspect WatermelonDB Captures
 *
 * Usage: Add this component to any screen during development
 * to view all Captures stored in the local database
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import * as Network from 'expo-network';
import { CaptureRepository } from '../../contexts/capture/data/CaptureRepository';
import { CrashRecoveryService } from '../../contexts/capture/services/CrashRecoveryService';
import { OfflineSyncService } from '../../contexts/capture/services/OfflineSyncService';

export const CaptureDevTools = () => {
  const [captures, setCaptures] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState({ pending: 0, synced: 0, total: 0 });
  const [networkStatus, setNetworkStatus] = useState<{
    isConnected: boolean | null;
    type: Network.NetworkStateType | null;
  }>({ isConnected: null, type: null });

  const repository = new CaptureRepository();
  const crashRecoveryService = new CrashRecoveryService(repository);
  const offlineSyncService = new OfflineSyncService(repository);

  const loadCaptures = async () => {
    try {
      setError(null);
      const allCaptures = await repository.findAll();
      setCaptures(allCaptures);

      // Load sync stats
      const stats = await offlineSyncService.getSyncStats();
      setSyncStats({
        pending: stats.pendingCount,
        synced: stats.syncedCount,
        total: stats.totalCount,
      });
    } catch (err) {
      console.error('Failed to load captures:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const simulateCrash = async () => {
    try {
      // Create a capture in "recording" state to simulate a crash
      await repository.create({
        type: 'audio',
        state: 'recording',
        rawContent: '/temp/crash_test.m4a',
        syncStatus: 'pending',
      });

      Alert.alert(
        '💥 Crash simulé',
        'Une capture en cours d\'enregistrement a été créée.\n\nRedémarrez l\'app ou tapez "Récupération crash" pour la récupérer.',
        [{ text: 'OK' }]
      );

      await loadCaptures();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de simuler le crash');
    }
  };

  const runCrashRecovery = async () => {
    try {
      const recovered = await crashRecoveryService.recoverIncompleteRecordings();

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

      await loadCaptures();
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la récupération');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCaptures();
    setRefreshing(false);
  };

  useEffect(() => {
    loadCaptures();
  }, []);

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>🔍 Capture DevTools</Text>
          <View style={[styles.networkBadge, { backgroundColor: networkDisplay.color }]}>
            <Text style={styles.networkBadgeText}>
              {networkDisplay.icon} {networkDisplay.text}
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
                  <View style={[styles.stateBadge, getStateColor(capture._raw.state)]}>
                    <Text style={styles.badgeText}>{capture._raw.state}</Text>
                  </View>
                  <View style={[styles.syncBadge, getSyncColor(capture._raw.sync_status)]}>
                    <Text style={styles.badgeText}>{capture._raw.sync_status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>ID:</Text>
                <Text style={styles.value}>{capture.id.substring(0, 16)}...</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{capture._raw.type}</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>État:</Text>
                <Text style={styles.value}>{capture._raw.state}</Text>
              </View>

              <View style={styles.captureRow}>
                <Text style={styles.label}>Sync:</Text>
                <Text style={styles.value}>{capture._raw.sync_status}</Text>
              </View>

              {capture._raw.raw_content && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Fichier:</Text>
                  <Text style={styles.valueSmall} numberOfLines={2}>
                    {capture._raw.raw_content}
                  </Text>
                </View>
              )}

              <View style={styles.captureRow}>
                <Text style={styles.label}>Créé:</Text>
                <Text style={styles.valueSmall}>
                  {new Date(capture._raw.created_at).toLocaleString('fr-FR')}
                </Text>
              </View>

              {capture._raw.normalized_text && (
                <View style={styles.captureRow}>
                  <Text style={styles.label}>Transcription:</Text>
                  <Text style={styles.valueSmall} numberOfLines={3}>
                    {capture._raw.normalized_text}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
    gap: 8,
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
    gap: 12,
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
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#007AFF',
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
