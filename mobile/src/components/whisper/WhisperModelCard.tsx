/**
 * WhisperModelCard - UI for Whisper model download management
 *
 * Story 2.5 - Task 5.2: Show Whisper model download progress
 *
 * Features:
 * - Show model download status (not downloaded / downloading / ready)
 * - Progress bar during download with size and speed
 * - Download button to start download
 * - Delete button to remove downloaded model
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  WhisperModelService,
  type WhisperModelSize,
  type DownloadProgress,
} from '../../contexts/Normalization/services/WhisperModelService';

type ModelStatus = 'checking' | 'not_downloaded' | 'downloading' | 'ready';

interface WhisperModelCardProps {
  modelSize?: WhisperModelSize;
}

export function WhisperModelCard({ modelSize = 'tiny' }: WhisperModelCardProps) {
  const [status, setStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const modelService = new WhisperModelService();
  const expectedSize = modelService.getExpectedSize(modelSize);

  // Check if model is already downloaded
  const checkModelStatus = useCallback(async () => {
    setStatus('checking');
    try {
      const isDownloaded = await modelService.isModelDownloaded(modelSize);
      setStatus(isDownloaded ? 'ready' : 'not_downloaded');
    } catch (err) {
      setStatus('not_downloaded');
    }
  }, [modelSize]);

  useEffect(() => {
    checkModelStatus();
  }, [checkModelStatus]);

  // Track download speed
  useEffect(() => {
    if (!progress) return;

    let lastBytes = progress.totalBytesWritten;
    let lastTime = Date.now();

    const interval = setInterval(() => {
      if (progress) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000; // seconds
        const bytesDiff = progress.totalBytesWritten - lastBytes;
        const speed = bytesDiff / timeDiff; // bytes per second
        setDownloadSpeed(speed);
        lastBytes = progress.totalBytesWritten;
        lastTime = now;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [progress?.totalBytesWritten]);

  const handleDownload = async () => {
    setStatus('downloading');
    setProgress(null);
    setError(null);
    setDownloadSpeed(0);

    try {
      await modelService.downloadModelWithRetry(modelSize, (prog) => {
        setProgress(prog);
      });
      setStatus('ready');
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      setStatus('not_downloaded');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer le modèle',
      'Le modèle Whisper sera supprimé. Vous devrez le retélécharger pour transcrire vos enregistrements.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await modelService.deleteModel(modelSize);
              setStatus('not_downloaded');
            } catch (err) {
              Alert.alert('Erreur', 'Impossible de supprimer le modèle');
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const getModelLabel = (): string => {
    switch (modelSize) {
      case 'tiny':
        return 'Whisper Tiny (~75 MB)';
      case 'base':
        return 'Whisper Base (~142 MB)';
      default:
        return 'Whisper Model';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🎙️ Modèle de transcription</Text>
        <Text style={styles.modelName}>{getModelLabel()}</Text>
      </View>

      {/* Status: Checking */}
      {status === 'checking' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={styles.statusText}>Vérification...</Text>
        </View>
      )}

      {/* Status: Not Downloaded */}
      {status === 'not_downloaded' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.statusNotDownloaded]}>
              <Text style={styles.statusBadgeText}>⬇️ Non téléchargé</Text>
            </View>
          </View>

          <Text style={styles.description}>
            Le modèle de transcription doit être téléchargé pour convertir vos
            enregistrements audio en texte. Taille: ~{formatBytes(expectedSize)}
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
            <Text style={styles.downloadButtonText}>Télécharger le modèle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Status: Downloading */}
      {status === 'downloading' && progress && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.statusDownloading]}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.statusBadgeText, { marginLeft: 8 }]}>
                Téléchargement...
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${progress.progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(progress.progress * 100)}%
            </Text>
          </View>

          {/* Download Stats */}
          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              {formatBytes(progress.totalBytesWritten)} / {formatBytes(progress.totalBytesExpectedToWrite)}
            </Text>
            <Text style={styles.statsText}>{formatSpeed(downloadSpeed)}</Text>
          </View>

          <Text style={styles.warningText}>
            ⚠️ Gardez l'application ouverte pendant le téléchargement
          </Text>
        </View>
      )}

      {/* Status: Downloading (initial, no progress yet) */}
      {status === 'downloading' && !progress && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.statusText}>Démarrage du téléchargement...</Text>
          </View>
        </View>
      )}

      {/* Status: Ready */}
      {status === 'ready' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.statusReady]}>
              <Text style={styles.statusBadgeText}>✅ Prêt</Text>
            </View>
          </View>

          <Text style={styles.description}>
            Le modèle est téléchargé et prêt à l'emploi. Vos enregistrements
            audio seront automatiquement transcrits en texte.
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Supprimer le modèle</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  modelName: {
    fontSize: 13,
    color: '#8E8E93',
  },
  content: {
    marginTop: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusNotDownloaded: {
    backgroundColor: '#FFF3E0',
  },
  statusDownloading: {
    backgroundColor: '#E3F2FD',
  },
  statusReady: {
    backgroundColor: '#E8F5E9',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  statusText: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#D32F2F',
    marginBottom: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    width: 45,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
  },
});
