/**
 * LLMSettingsScreen - Settings for LLM post-processing configuration
 *
 * Pattern: Follows WhisperSettingsScreen architecture
 *
 * Features:
 * - Toggle to enable/disable post-processing
 * - TPU detection status
 * - Display available LLM models with download/select options
 * - Different sections for TPU and standard models
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { LLMModelCard } from '../../components/llm/LLMModelCard';
import {
  LLMModelService,
  type LLMModelId,
  type LLMModelConfig,
} from '../../contexts/Normalization/services/LLMModelService';
import { NPUDetectionService, type NPUInfo } from '../../contexts/Normalization/services/NPUDetectionService';
import { debugPromptManager } from '../../contexts/Normalization/services/postprocessing/IPostProcessingBackend';
import { useSettingsStore } from '../../stores/settingsStore';

export function LLMSettingsScreen() {
  const [selectedModel, setSelectedModel] = useState<LLMModelId | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [npuInfo, setNpuInfo] = useState<NPUInfo | null>(null);
  const [tpuModels, setTpuModels] = useState<LLMModelConfig[]>([]);
  const [standardModels, setStandardModels] = useState<LLMModelConfig[]>([]);

  // Debug mode state
  const debugMode = useSettingsStore((state) => state.debugMode);
  const [customPrompt, setCustomPrompt] = useState(debugPromptManager.getPrompt());
  const [isPromptModified, setIsPromptModified] = useState(debugPromptManager.hasCustomPrompt());

  // Note: Using direct instantiation for UI - NPUDetectionService is injected in LLMModelService
  const npuDetection = new NPUDetectionService();
  // LLMModelService needs NPUDetectionService for device filtering
  const modelService = new LLMModelService(npuDetection);

  /**
   * Get NPU title for display
   */
  const getNPUTitle = (info: NPUInfo): string => {
    switch (info.type) {
      case 'neural-engine':
        return '🍎 Apple Neural Engine détecté';
      case 'tensor-tpu':
        return '🚀 Google Tensor TPU détecté';
      case 'samsung-npu':
        return '📱 Samsung NPU détecté';
      case 'snapdragon-npu':
        return '⚡ Qualcomm NPU détecté';
      default:
        return '💻 Mode standard (GPU/CPU)';
    }
  };

  /**
   * Get NPU description for display
   */
  const getNPUDescription = (info: NPUInfo): string => {
    if (!info.hasNPU) {
      return 'Votre appareil utilisera le GPU/CPU pour l\'IA';
    }

    switch (info.type) {
      case 'neural-engine':
        return `${info.deviceModel} - ${info.generation}`;
      case 'tensor-tpu':
        return `${info.deviceModel} - ${info.generation}`;
      case 'samsung-npu':
        return `${info.deviceModel} - ${info.generation}`;
      case 'snapdragon-npu':
        return `${info.deviceModel} - Accélération NPU`;
      default:
        return info.deviceModel;
    }
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Load enabled state
      const enabled = await modelService.isPostProcessingEnabled();
      setIsEnabled(enabled);

      // Load selected model
      const selected = await modelService.getSelectedModel();
      setSelectedModel(selected);

      // Detect NPU capabilities
      const info = await npuDetection.detectNPU();
      setNpuInfo(info);

      // Load models by category, filtered for current device
      // Only show MediaPipe models on Google Pixel devices
      const tpu = info.type === 'tensor-tpu'
        ? await modelService.getModelsForBackendAndDevice('mediapipe')
        : [];
      // Get llamarn models filtered for current device (Apple->Llama, Google->Gemma, Others->generic)
      const standard = await modelService.getModelsForBackendAndDevice('llamarn');
      setTpuModels(tpu);
      setStandardModels(standard);
    };

    loadSettings();
  }, []);

  /**
   * Toggle post-processing enabled state
   */
  const handleToggleEnabled = async (value: boolean) => {
    setIsEnabled(value);
    await modelService.setPostProcessingEnabled(value);

    if (value && !selectedModel) {
      // Prompt to select a model
      const downloaded = await modelService.getDownloadedModels();
      if (downloaded.length === 0) {
        Alert.alert(
          'Aucun modèle',
          'Téléchargez d\'abord un modèle pour activer l\'amélioration IA.'
        );
      }
    }
  };

  /**
   * Handle model selection
   */
  const handleUseModel = useCallback(async (modelId: LLMModelId) => {
    await modelService.setSelectedModel(modelId);
    setSelectedModel(modelId);

    // Enable post-processing if not already
    if (!isEnabled) {
      setIsEnabled(true);
      await modelService.setPostProcessingEnabled(true);
    }

    // Offer to delete other models
    const allModels = modelService.getAllModels();
    const otherModels = allModels.filter((m) => m.id !== modelId);
    const downloadedOthers: LLMModelConfig[] = [];

    for (const model of otherModels) {
      if (await modelService.isModelDownloaded(model.id)) {
        downloadedOthers.push(model);
      }
    }

    if (downloadedOthers.length > 0) {
      const totalSize = downloadedOthers.reduce(
        (acc, m) => acc + m.expectedSize,
        0
      );
      const sizeInMB = totalSize / (1024 * 1024);
      const sizeLabel = sizeInMB >= 1000
        ? `${(sizeInMB / 1024).toFixed(1)} GB`
        : `${Math.round(sizeInMB)} MB`;

      Alert.alert(
        'Supprimer les autres modèles ?',
        `${downloadedOthers.length > 1 ? 'Les modèles suivants sont' : 'Le modèle suivant est'} toujours téléchargé${downloadedOthers.length > 1 ? 's' : ''} :\n${downloadedOthers.map((m) => m.name).join(', ')}\n\nVoulez-vous ${downloadedOthers.length > 1 ? 'les' : 'le'} supprimer pour libérer ~${sizeLabel} ?`,
        [
          { text: 'Garder', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              for (const model of downloadedOthers) {
                await modelService.deleteModel(model.id);
              }
              Alert.alert(
                'Modèles supprimés',
                `${downloadedOthers.length > 1 ? 'Les modèles ont été supprimés' : 'Le modèle a été supprimé'}.`
              );
            },
          },
        ]
      );
    }
  }, [isEnabled]);

  /**
   * Apply custom prompt (debug mode only)
   */
  const handleApplyPrompt = useCallback(() => {
    debugPromptManager.setCustomPrompt(customPrompt);
    setIsPromptModified(true);
    Alert.alert(
      'Prompt appliqué',
      'Le prompt personnalisé sera utilisé pour les prochaines transcriptions.\n\n⚠️ Ce changement est temporaire et sera perdu au redémarrage de l\'app.'
    );
  }, [customPrompt]);

  /**
   * Reset to default prompt (debug mode only)
   */
  const handleResetPrompt = useCallback(() => {
    debugPromptManager.resetToDefault();
    setCustomPrompt(debugPromptManager.getDefaultPrompt());
    setIsPromptModified(false);
    Alert.alert('Prompt réinitialisé', 'Le prompt par défaut a été restauré.');
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Amélioration IA</Text>
        <Text style={styles.headerDescription}>
          Utilisez un modèle d'intelligence artificielle local pour améliorer automatiquement
          la qualité des transcriptions (ponctuation, grammaire, capitalisation).
        </Text>
      </View>

      {/* Enable Toggle */}
      <View style={styles.toggleSection}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={styles.toggleLabel}>Activer l'amélioration IA</Text>
            <Text style={styles.toggleDescription}>
              Améliore automatiquement les transcriptions après Whisper
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* NPU Detection */}
      {npuInfo && (
        <View style={styles.tpuSection}>
          <View style={[
            styles.tpuCard,
            npuInfo.hasNPU ? styles.tpuCardActive : styles.tpuCardInactive,
            npuInfo.type === 'neural-engine' && styles.tpuCardApple,
            npuInfo.type === 'samsung-npu' && styles.tpuCardSamsung,
          ]}>
            <Text style={styles.tpuTitle}>
              {getNPUTitle(npuInfo)}
            </Text>
            <Text style={styles.tpuDescription}>
              {getNPUDescription(npuInfo)}
            </Text>
            {npuInfo.isRecommendedForLLM && (
              <Text style={styles.tpuRecommendation}>
                ✨ Accélération matérielle optimisée pour l'IA
              </Text>
            )}
          </View>
        </View>
      )}

      {/* TPU Models (only show on Google Pixel devices) */}
      {npuInfo?.type === 'tensor-tpu' && tpuModels.length > 0 && (
        <View style={styles.modelsSection}>
          <Text style={styles.sectionTitle}>Modèles optimisés TPU</Text>
          <Text style={styles.sectionDescription}>
            Ces modèles sont optimisés pour la puce Tensor de votre Pixel.
          </Text>
          {tpuModels.map((model) => (
            <LLMModelCard
              key={model.id}
              modelId={model.id}
              isSelected={selectedModel === model.id}
              showTpuBadge
              onUseModel={handleUseModel}
            />
          ))}
        </View>
      )}

      {/* Standard Models */}
      <View style={styles.modelsSection}>
        <Text style={styles.sectionTitle}>Modèles standards</Text>
        <Text style={styles.sectionDescription}>
          {npuInfo?.type === 'tensor-tpu'
            ? 'Modèles compatibles avec tous les appareils.'
            : 'Choisissez un modèle selon votre espace de stockage et vos besoins.'}
        </Text>
        {standardModels.map((model) => (
          <LLMModelCard
            key={model.id}
            modelId={model.id}
            isSelected={selectedModel === model.id}
            onUseModel={handleUseModel}
          />
        ))}
      </View>

      {/* Debug: Custom Prompt Editor (only in debug mode) */}
      {debugMode && (
        <View style={styles.debugSection}>
          <View style={styles.debugHeader}>
            <Text style={styles.debugTitle}>🛠️ Debug: Prompt Système</Text>
            {isPromptModified && (
              <View style={styles.debugBadge}>
                <Text style={styles.debugBadgeText}>Modifié</Text>
              </View>
            )}
          </View>
          <Text style={styles.debugDescription}>
            Modifiez le prompt système pour tester différentes instructions.
            Ce changement est temporaire (perdu au redémarrage).
          </Text>
          <TextInput
            style={styles.debugPromptInput}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            placeholder="Entrez le prompt système..."
            placeholderTextColor="#999"
          />
          <View style={styles.debugButtonRow}>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonSecondary]}
              onPress={handleResetPrompt}
            >
              <Text style={styles.debugButtonSecondaryText}>↩️ Restaurer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonPrimary]}
              onPress={handleApplyPrompt}
            >
              <Text style={styles.debugButtonPrimaryText}>✅ Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Les modèles sont exécutés 100% localement sur votre appareil.
          Vos données ne quittent jamais votre téléphone.
        </Text>
        <Text style={styles.footerText}>
          Temps de traitement estimé : 1-5 secondes par transcription selon le modèle.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  toggleSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toggleContent: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#000',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  tpuSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  tpuCard: {
    borderRadius: 12,
    padding: 16,
  },
  tpuCardActive: {
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#CE93D8',
  },
  tpuCardInactive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  tpuCardApple: {
    backgroundColor: '#F5F5F5',
    borderColor: '#A1A1A6',
  },
  tpuCardSamsung: {
    backgroundColor: '#E8F0FE',
    borderColor: '#1A73E8',
  },
  tpuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  tpuDescription: {
    fontSize: 14,
    color: '#666',
  },
  tpuRecommendation: {
    fontSize: 13,
    color: '#7B1FA2',
    marginTop: 8,
    fontWeight: '500',
  },
  modelsSection: {
    marginTop: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  footer: {
    padding: 16,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  // Debug styles
  debugSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  debugTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E65100',
  },
  debugBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  debugBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  debugDescription: {
    fontSize: 13,
    color: '#795548',
    lineHeight: 18,
    marginBottom: 12,
  },
  debugPromptInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCC80',
    padding: 12,
    fontSize: 13,
    color: '#333',
    minHeight: 200,
    fontFamily: 'monospace',
  },
  debugButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  debugButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  debugButtonPrimary: {
    backgroundColor: '#FF9800',
  },
  debugButtonPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  debugButtonSecondary: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  debugButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E65100',
  },
});
