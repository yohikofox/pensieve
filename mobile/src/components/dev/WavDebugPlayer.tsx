/**
 * WavDebugPlayer - Debug component to play and manage converted WAV files
 *
 * Only visible when debug mode is enabled in settings.
 * Allows developers to:
 * - Listen to the last converted WAV file to verify audio quality
 * - Delete the WAV file to free up space
 *
 * Story: 2.5 - Transcription on-device with Whisper
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { container } from 'tsyringe';
import { AudioConversionService } from '../../contexts/Normalization/services/AudioConversionService';
import { useSettingsStore } from '../../stores/settingsStore';

export function WavDebugPlayer() {
  const [wavPath, setWavPath] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get debug mode from settings store
  const debugMode = useSettingsStore((state) => state.debugMode);

  // Get AudioConversionService from DI container
  const audioConversionService = container.resolve(AudioConversionService);

  // Audio player for WAV file
  const player = useAudioPlayer(wavPath);
  const status = useAudioPlayerStatus(player);

  // Refresh WAV path
  const refreshWavPath = useCallback(() => {
    const path = audioConversionService.getLastConvertedWavPath();
    setWavPath(path);
  }, [audioConversionService]);

  // Load WAV path on mount and periodically
  useEffect(() => {
    if (!debugMode) return;

    refreshWavPath();

    // Refresh every 2 seconds to catch new conversions
    const interval = setInterval(refreshWavPath, 2000);
    return () => clearInterval(interval);
  }, [refreshWavPath, debugMode]);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (!wavPath) {
      Alert.alert('Pas de WAV', 'Aucun fichier WAV converti disponible.');
      return;
    }

    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, status.playing, wavPath]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!wavPath) {
      Alert.alert('Pas de WAV', 'Aucun fichier WAV à supprimer.');
      return;
    }

    Alert.alert(
      'Supprimer le WAV ?',
      'Voulez-vous supprimer le fichier WAV de debug ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              // Stop playback first
              player.pause();
              await audioConversionService.deleteLastConvertedWav();
              setWavPath(null);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le fichier WAV.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  }, [wavPath, player, audioConversionService]);

  // Don't render if debug mode is disabled
  if (!debugMode) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug WAV</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>DEBUG</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Écoutez le fichier WAV converti pour vérifier la qualité de l'encodage 16kHz mono.
      </Text>

      {wavPath ? (
        <View style={styles.fileInfo}>
          <Text style={styles.filePathLabel}>Fichier :</Text>
          <Text style={styles.filePath} numberOfLines={2} ellipsizeMode="middle">
            {wavPath.split('/').pop()}
          </Text>
        </View>
      ) : (
        <Text style={styles.noFile}>
          Aucun fichier WAV disponible. Effectuez une transcription d'abord.
        </Text>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.playButton, !wavPath && styles.buttonDisabled]}
          onPress={handlePlayPause}
          disabled={!wavPath}
        >
          <Text style={styles.buttonText}>
            {status.playing ? '⏸ Pause' : '▶️ Écouter'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.deleteButton, (!wavPath || isDeleting) && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={!wavPath || isDeleting}
        >
          <Text style={styles.buttonText}>
            {isDeleting ? '...' : '🗑️ Supprimer'}
          </Text>
        </TouchableOpacity>
      </View>

      {status.playing && (
        <View style={styles.playingIndicator}>
          <Text style={styles.playingText}>
            Lecture en cours... {Math.round((status.currentTime || 0) * 10) / 10}s
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FFECB5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#664D03',
  },
  badge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: '#664D03',
    lineHeight: 18,
    marginBottom: 12,
  },
  fileInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  filePathLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  filePath: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  noFile: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#DC3545',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  playingIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  playingText: {
    fontSize: 12,
    color: '#664D03',
  },
});
