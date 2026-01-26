/**
 * LLMModelCard - UI for LLM model download management
 *
 * Pattern: Follows WhisperModelCard architecture
 *
 * Features:
 * - Show model download status (not downloaded / downloading / ready)
 * - Progress bar during download with size and speed
 * - Download button to start download
 * - Delete button to remove downloaded model
 * - Use button to select model for post-processing
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
  LLMModelService,
  type LLMModelId,
  type LLMModelConfig,
  type DownloadProgress,
} from '../../contexts/Normalization/services/LLMModelService';
import { NPUDetectionService } from '../../contexts/Normalization/services/NPUDetectionService';
import { colors } from '../../design-system/tokens';
import { AlertDialog, useToast } from '../../design-system/components';

type ModelStatus = 'checking' | 'not_downloaded' | 'downloading' | 'ready' | 'auth_required';

interface LLMModelCardProps {
  modelId: LLMModelId;
  isSelected?: boolean;
  showTpuBadge?: boolean;
  onUseModel?: (modelId: LLMModelId) => Promise<void>;
}

export function LLMModelCard({
  modelId,
  isSelected = false,
  showTpuBadge = false,
  onUseModel,
}: LLMModelCardProps) {
  const [status, setStatus] = useState<ModelStatus>('checking');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [config, setConfig] = useState<LLMModelConfig | null>(null);
  const [canDownload, setCanDownload] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const toast = useToast();

  const npuDetection = new NPUDetectionService();
  const modelService = new LLMModelService(npuDetection);

  // Load model config
  useEffect(() => {
    try {
      const modelConfig = modelService.getModelConfig(modelId);
      setConfig(modelConfig);
    } catch (err) {
      console.error('Failed to get model config:', err);
    }
  }, [modelId]);

  // Check if model is already downloaded
  const checkModelStatus = useCallback(async () => {
    setStatus('checking');
    try {
      // Initialize auth service
      await modelService.initialize();

      const isDownloaded = await modelService.isModelDownloaded(modelId);
      const canDl = modelService.canDownloadModel(modelId);
      setCanDownload(canDl);

      if (isDownloaded) {
        setStatus('ready');
      } else if (!canDl && modelService.modelRequiresAuth(modelId)) {
        setStatus('auth_required');
      } else {
        setStatus('not_downloaded');
      }
    } catch (err) {
      setStatus('not_downloaded');
    }
  }, [modelId]);

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
        const timeDiff = (now - lastTime) / 1000;
        const bytesDiff = progress.totalBytesWritten - lastBytes;
        const speed = bytesDiff / timeDiff;
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
      await modelService.downloadModelWithRetry(modelId, (prog) => {
        setProgress(prog);
      });
      setStatus('ready');
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de téléchargement');
      setStatus('not_downloaded');
    }
  };

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    try {
      await modelService.deleteModel(modelId);
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

        await modelService.downloadModelWithRetry(modelId, (prog) => {
          setProgress(prog);
        });
        setStatus('ready');
        setProgress(null);
      }

      await onUseModel(modelId);
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
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const getSizeLabel = (): string => {
    if (!config) return '';
    const sizeInMB = config.expectedSize / (1024 * 1024);
    if (sizeInMB >= 1000) {
      return `~${(sizeInMB / 1024).toFixed(1)} GB`;
    }
    return `~${Math.round(sizeInMB)} MB`;
  };

  if (!config) {
    return null;
  }

  const isTpuModel = config.backend === 'mediapipe';

  return (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.titleWithIcon}>
              <Feather name={isTpuModel ? 'zap' : 'cpu'} size={18} color={isTpuModel ? colors.warning[500] : colors.primary[600]} />
              <Text style={styles.title}>
                {config.name} ({getSizeLabel()})
              </Text>
            </View>
            {config.recommended && !isSelected && (
              <View style={[styles.badge, isTpuModel ? styles.badgeTpu : styles.badgeRecommended]}>
                <Text style={styles.badgeText}>
                  {isTpuModel ? 'TPU' : 'Recommandé'}
                </Text>
              </View>
            )}
            {showTpuBadge && isTpuModel && (
              <View style={[styles.badge, styles.badgeTpu]}>
                <Text style={styles.badgeText}>TPU</Text>
              </View>
            )}
          </View>
          {isSelected && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>✓ Actif</Text>
            </View>
          )}
        </View>
        <Text style={styles.description}>{config.description}</Text>
      </View>

      {/* Status: Checking */}
      {status === 'checking' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={styles.statusText}>Vérification...</Text>
        </View>
      )}

      {/* Status: Auth Required */}
      {status === 'auth_required' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.statusAuthRequired]}>
              <Feather name="lock" size={14} color={colors.warning[700]} />
              <Text style={styles.statusBadgeText}>Connexion requise</Text>
            </View>
          </View>

          <Text style={styles.authRequiredText}>
            Ce modèle nécessite une connexion HuggingFace pour accepter la licence Gemma.
            Connectez-vous dans la section ci-dessus.
          </Text>
        </View>
      )}

      {/* Status: Not Downloaded */}
      {status === 'not_downloaded' && (
        <View style={styles.content}>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, styles.statusNotDownloaded]}>
              <Feather name="download" size={14} color={colors.neutral[600]} />
              <Text style={styles.statusBadgeText}>Non téléchargé</Text>
            </View>
            {config?.requiresAuth && (
              <View style={[styles.statusBadge, styles.statusAuthOk]}>
                <Feather name="unlock" size={14} color={colors.success[600]} />
                <Text style={styles.statusBadgeText}>Autorisé</Text>
              </View>
            )}
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Text style={styles.downloadButtonText}>Télécharger</Text>
            </TouchableOpacity>

            {onUseModel && (
              <TouchableOpacity
                style={[styles.useButton, isSelecting && styles.useButtonDisabled]}
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
            <View style={[styles.statusBadge, styles.statusDownloading]}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={[styles.statusBadgeText, { marginLeft: 8 }]}>
                Téléchargement...
              </Text>
            </View>
          </View>

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

          <View style={styles.statsRow}>
            <Text style={styles.statsText}>
              {formatBytes(progress.totalBytesWritten)} / {formatBytes(progress.totalBytesExpectedToWrite)}
            </Text>
            <Text style={styles.statsText}>{formatSpeed(downloadSpeed)}</Text>
          </View>

          <View style={styles.warningContainer}>
            <Feather name="alert-triangle" size={14} color={colors.warning[600]} />
            <Text style={styles.warningText}>
              Gardez l'application ouverte pendant le téléchargement
            </Text>
          </View>
        </View>
      )}

      {/* Status: Downloading (initial) */}
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
              <Feather name="check-circle" size={14} color={colors.success[600]} />
              <Text style={styles.statusBadgeText}>Téléchargé</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            {onUseModel && !isSelected && (
              <TouchableOpacity
                style={[styles.useButton, isSelecting && styles.useButtonDisabled]}
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

            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <AlertDialog
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        variant="danger"
        title="Supprimer le modèle"
        message="Le modèle LLM sera supprimé. Vous devrez le retélécharger pour utiliser l'amélioration IA."
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
    gap: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeRecommended: {
    backgroundColor: '#34C759',
  },
  badgeTpu: {
    backgroundColor: '#AF52DE',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  description: {
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
  statusAuthRequired: {
    backgroundColor: '#FFEBEE',
  },
  statusAuthOk: {
    backgroundColor: '#E8F5E9',
    marginLeft: 8,
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
  errorText: {
    fontSize: 13,
    color: '#D32F2F',
    marginBottom: 12,
  },
  authRequiredText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginTop: 4,
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
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9800',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
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
