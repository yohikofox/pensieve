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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  TranscriptionModelService,
  type WhisperModelSize,
  type DownloadProgress,
} from '../../contexts/Normalization/services/TranscriptionModelService';
import { colors } from '../../design-system/tokens';
import { AlertDialog, useToast } from '../../design-system/components';
import { useTheme } from '../../hooks/useTheme';

type ModelStatus = 'checking' | 'not_downloaded' | 'downloading' | 'ready';

// Theme-aware colors
const getThemeColors = (isDark: boolean) => ({
  cardBg: isDark ? colors.neutral[800] : '#FFFFFF',
  cardSelectedBg: isDark ? '#1A3A52' : '#F0F7FF',
  borderDefault: isDark ? colors.neutral[700] : 'transparent',
  borderSelected: isDark ? colors.primary[500] : '#007AFF',
  textPrimary: isDark ? colors.neutral[50] : '#000',
  textSecondary: isDark ? colors.neutral[400] : '#666',
  textTertiary: isDark ? colors.neutral[500] : '#8E8E93',
  iconPrimary: isDark ? colors.primary[400] : colors.primary[600],
  activeBadgeBg: isDark ? colors.primary[600] : '#007AFF',
  statusNotDownloadedBg: isDark ? colors.warning[900] : '#FFF3E0',
  statusDownloadingBg: isDark ? colors.info[900] : '#E3F2FD',
  statusReadyBg: isDark ? colors.success[900] : '#E8F5E9',
  statusBadgeText: isDark ? colors.neutral[200] : '#333',
  errorText: isDark ? colors.error[400] : '#D32F2F',
  progressBarBg: isDark ? colors.neutral[700] : '#E5E5EA',
  progressFillBg: isDark ? colors.primary[500] : '#007AFF',
  progressText: isDark ? colors.primary[400] : '#007AFF',
  warningText: isDark ? colors.warning[400] : '#FF9800',
  downloadButtonBg: isDark ? colors.neutral[700] : '#F2F2F7',
  downloadButtonText: isDark ? colors.primary[400] : '#007AFF',
  useButtonBg: isDark ? colors.success[700] : '#34C759',
  deleteButtonBg: isDark ? colors.neutral[700] : '#F2F2F7',
  deleteButtonText: isDark ? colors.error[400] : '#FF3B30',
});

interface WhisperModelCardProps {
  modelSize?: WhisperModelSize;
  isSelected?: boolean;
  onUseModel?: (modelSize: WhisperModelSize) => Promise<void>;
}

export function WhisperModelCard({
  modelSize = 'tiny',
  isSelected = false,
  onUseModel,
}: WhisperModelCardProps) {
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);
  const [status, setStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const toast = useToast();

  const modelService = new TranscriptionModelService();
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
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    try {
      await modelService.deleteModel(modelSize);
      setStatus('not_downloaded');
    } catch (err) {
      toast.error('Impossible de supprimer le modèle');
    }
  };

  const handleUseModel = async () => {
    if (!onUseModel) return;

    setIsSelecting(true);
    try {
      // If not downloaded, download first
      if (status === 'not_downloaded') {
        setStatus('downloading');
        setProgress(null);
        setError(null);
        setDownloadSpeed(0);

        await modelService.downloadModelWithRetry(modelSize, (prog) => {
          setProgress(prog);
        });
        setStatus('ready');
        setProgress(null);
      }

      // Then call the onUseModel callback
      await onUseModel(modelSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      if (status === 'downloading') {
        setStatus('not_downloaded');
      }
    } finally {
      setIsSelecting(false);
    }
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
        return 'Tiny (~75 MB)';
      case 'base':
        return 'Base (~142 MB)';
      case 'small':
        return 'Small (~466 MB)';
      case 'medium':
        return 'Medium (~1.5 GB)';
      case 'large-v3':
        return 'Large V3 (~3.1 GB)';
      default:
        return 'Whisper Model';
    }
  };

  const getModelAdvice = (): { icon: string; text: string; badge?: string } => {
    switch (modelSize) {
      case 'tiny':
        return {
          icon: 'zap',
          text: 'Le plus rapide. Idéal pour des notes courtes ou un téléphone avec peu d\'espace.',
          badge: 'Rapide',
        };
      case 'base':
        return {
          icon: 'star',
          text: 'Bon équilibre entre qualité et taille. Recommandé pour la plupart des utilisateurs.',
          badge: 'Recommandé',
        };
      case 'small':
        return {
          icon: 'target',
          text: 'Meilleure précision, notamment pour les accents et termes techniques. Nécessite plus d\'espace.',
        };
      case 'medium':
        return {
          icon: 'award',
          text: 'Qualité professionnelle. Réservé aux appareils récents avec beaucoup d\'espace libre.',
          badge: 'Pro',
        };
      case 'large-v3':
        return {
          icon: 'zap',
          text: 'Le meilleur modèle Whisper. Qualité maximale pour les transcriptions complexes. Nécessite beaucoup d\'espace et un appareil puissant.',
          badge: 'Ultimate',
        };
      default:
        return { icon: 'cpu', text: '' };
    }
  };

  const advice = getModelAdvice();

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: isSelected ? themeColors.cardSelectedBg : themeColors.cardBg,
        borderColor: isSelected ? themeColors.borderSelected : themeColors.borderDefault,
      }
    ]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Feather name={advice.icon as any} size={18} color={themeColors.iconPrimary} />
              <Text style={[styles.title, { color: themeColors.textPrimary }]}>{getModelLabel()}</Text>
            </View>
            {advice.badge && !isSelected && (
              <View style={[
                styles.adviceBadge,
                modelSize === 'base' && styles.adviceBadgeRecommended,
                modelSize === 'medium' && styles.adviceBadgePro,
                modelSize === 'large-v3' && styles.adviceBadgeUltimate,
              ]}>
                <Text style={styles.adviceBadgeText}>{advice.badge}</Text>
              </View>
            )}
          </View>
          {isSelected && (
            <View style={[styles.activeBadge, { backgroundColor: themeColors.activeBadgeBg }]}>
              <Text style={styles.activeBadgeText}>✓ Actif</Text>
            </View>
          )}
        </View>
        <Text style={[styles.adviceText, { color: themeColors.textSecondary }]}>{advice.text}</Text>
      </View>

      {/* Status: Checking */}
      {status === 'checking' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={themeColors.textTertiary} />
          <Text style={[styles.statusText, { color: themeColors.textTertiary }]}>Vérification...</Text>
        </View>
      )}

      {/* Status: Not Downloaded */}
      {status === 'not_downloaded' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: themeColors.statusNotDownloadedBg }]}>
              <Feather name="download" size={14} color={isDark ? colors.warning[400] : colors.neutral[600]} />
              <Text style={[styles.statusBadgeText, { color: themeColors.statusBadgeText }]}>Non téléchargé</Text>
            </View>
          </View>

          <Text style={[styles.description, { color: themeColors.textSecondary }]}>
            Taille: ~{formatBytes(expectedSize)}
          </Text>

          {error && <Text style={[styles.errorText, { color: themeColors.errorText }]}>{error}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.downloadButton, { backgroundColor: themeColors.downloadButtonBg }]} onPress={handleDownload}>
              <Text style={[styles.downloadButtonText, { color: themeColors.downloadButtonText }]}>Télécharger</Text>
            </TouchableOpacity>

            {onUseModel && (
              <TouchableOpacity
                style={[styles.useButton, { backgroundColor: themeColors.useButtonBg }, isSelecting && styles.useButtonDisabled]}
                onPress={handleUseModel}
                disabled={isSelecting}
              >
                {isSelecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.useButtonText}>Utiliser ce modèle</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Status: Downloading */}
      {status === 'downloading' && progress && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: themeColors.statusDownloadingBg }]}>
              <ActivityIndicator size="small" color={themeColors.progressFillBg} />
              <Text style={[styles.statusBadgeText, { marginLeft: 8, color: themeColors.statusBadgeText }]}>
                Téléchargement...
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: themeColors.progressBarBg }]}>
              <View
                style={[styles.progressFill, { backgroundColor: themeColors.progressFillBg, width: `${progress.progress * 100}%` }]}
              />
            </View>
            <Text style={[styles.progressText, { color: themeColors.progressText }]}>
              {Math.round(progress.progress * 100)}%
            </Text>
          </View>

          {/* Download Stats */}
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: themeColors.textTertiary }]}>
              {formatBytes(progress.totalBytesWritten)} / {formatBytes(progress.totalBytesExpectedToWrite)}
            </Text>
            <Text style={[styles.statsText, { color: themeColors.textTertiary }]}>{formatSpeed(downloadSpeed)}</Text>
          </View>

          <View style={styles.warningContainer}>
            <Feather name="alert-triangle" size={14} color={isDark ? colors.warning[400] : colors.warning[600]} />
            <Text style={[styles.warningText, { color: themeColors.warningText }]}>
              Gardez l'application ouverte pendant le téléchargement
            </Text>
          </View>
        </View>
      )}

      {/* Status: Downloading (initial, no progress yet) */}
      {status === 'downloading' && !progress && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color={themeColors.progressFillBg} />
            <Text style={[styles.statusText, { color: themeColors.textTertiary }]}>Démarrage du téléchargement...</Text>
          </View>
        </View>
      )}

      {/* Status: Ready */}
      {status === 'ready' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: themeColors.statusReadyBg }]}>
              <Feather name="check-circle" size={14} color={isDark ? colors.success[400] : colors.success[600]} />
              <Text style={[styles.statusBadgeText, { color: themeColors.statusBadgeText }]}>Téléchargé</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            {onUseModel && !isSelected && (
              <TouchableOpacity
                style={[styles.useButton, { backgroundColor: themeColors.useButtonBg }, isSelecting && styles.useButtonDisabled]}
                onPress={handleUseModel}
                disabled={isSelecting}
              >
                {isSelecting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.useButtonText}>Utiliser ce modèle</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.deleteButton, { backgroundColor: themeColors.deleteButtonBg }]} onPress={handleDelete}>
              <Text style={[styles.deleteButtonText, { color: themeColors.deleteButtonText }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AlertDialog
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        variant="danger"
        title="Supprimer le modèle"
        message="Le modèle Whisper sera supprimé. Vous devrez le retélécharger pour transcrire vos enregistrements."
        confirmAction={{
          label: 'Supprimer',
          onPress: confirmDelete,
        }}
      />
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F7FF',
  },
  header: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,

  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  adviceBadge: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adviceBadgeRecommended: {
    backgroundColor: '#34C759',
  },
  adviceBadgePro: {
    backgroundColor: '#AF52DE',
  },
  adviceBadgeUltimate: {
    backgroundColor: '#FF9500',
  },
  adviceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adviceText: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
    lineHeight: 18,
  },
  activeBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    marginLeft: 6,
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
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
  },
  buttonRow: {
    flexDirection: 'row',

    flexWrap: 'wrap',
  },
  downloadButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  useButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  useButtonDisabled: {
    opacity: 0.6,
  },
  useButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FF3B30',
  },
});
