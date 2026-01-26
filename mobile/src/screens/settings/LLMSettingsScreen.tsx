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

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { container } from 'tsyringe';
import { colors } from '../../design-system/tokens';
import { AlertDialog, useToast } from '../../design-system/components';
import { LLMModelCard } from '../../components/llm/LLMModelCard';
import {
  LLMModelService,
  type LLMModelId,
  type LLMModelConfig,
  type LLMTask,
} from '../../contexts/Normalization/services/LLMModelService';
import { NPUDetectionService, type NPUInfo } from '../../contexts/Normalization/services/NPUDetectionService';
import { type HuggingFaceUser } from '../../contexts/Normalization/services/HuggingFaceAuthService';
import { debugPromptManager } from '../../contexts/Normalization/services/postprocessing/IPostProcessingBackend';
import { useSettingsStore } from '../../stores/settingsStore';

/** Task labels for display */
const TASK_LABELS: Record<LLMTask, { name: string; icon: string; description: string }> = {
  postProcessing: {
    name: 'Post-traitement',
    icon: 'edit-3',
    description: 'Correction et amélioration des transcriptions',
  },
  analysis: {
    name: 'Analyse',
    icon: 'search',
    description: 'Résumés, points clés et actions',
  },
};

export function LLMSettingsScreen() {
  // Task-specific model selections
  const [selectedPostProcessingModel, setSelectedPostProcessingModel] = useState<LLMModelId | null>(null);
  const [selectedAnalysisModel, setSelectedAnalysisModel] = useState<LLMModelId | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isAutoPostProcess, setIsAutoPostProcess] = useState(false);
  const [npuInfo, setNpuInfo] = useState<NPUInfo | null>(null);
  const [tpuModels, setTpuModels] = useState<LLMModelConfig[]>([]);
  const [standardModels, setStandardModels] = useState<LLMModelConfig[]>([]);

  // HuggingFace auth state
  const [isHfAuthenticated, setIsHfAuthenticated] = useState(false);
  const [hfUser, setHfUser] = useState<HuggingFaceUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Debug mode state
  const debugMode = useSettingsStore((state) => state.debugMode);
  const [customPrompt, setCustomPrompt] = useState(debugPromptManager.getPrompt());
  const [isPromptModified, setIsPromptModified] = useState(debugPromptManager.hasCustomPrompt());

  // AlertDialog state
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const toast = useToast();

  // Get services from DI container (singleton instances)
  const modelService = useMemo(() => container.resolve(LLMModelService), []);
  const npuDetection = useMemo(() => container.resolve(NPUDetectionService), []);
  const authService = modelService.getAuthService();

  /**
   * Get NPU title for display
   */
  const getNPUTitle = (info: NPUInfo): { icon: string; text: string } => {
    switch (info.type) {
      case 'neural-engine':
        return { icon: 'cpu', text: 'Apple Neural Engine détecté' };
      case 'tensor-tpu':
        return { icon: 'zap', text: 'Google Tensor TPU détecté' };
      case 'samsung-npu':
        return { icon: 'smartphone', text: 'Samsung NPU détecté' };
      case 'snapdragon-npu':
        return { icon: 'zap', text: 'Qualcomm NPU détecté' };
      default:
        return { icon: 'monitor', text: 'Mode standard (GPU/CPU)' };
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
      // Initialize auth service
      await authService.initialize();
      setIsHfAuthenticated(authService.isAuthenticated());
      setHfUser(authService.getUser());

      // Load enabled state
      const enabled = await modelService.isPostProcessingEnabled();
      setIsEnabled(enabled);

      // Load auto post-process setting
      const autoPostProcess = await modelService.isAutoPostProcessEnabled();
      setIsAutoPostProcess(autoPostProcess);

      // Load task-specific model selections
      const postProcessingModel = await modelService.getModelForTask('postProcessing');
      const analysisModel = await modelService.getModelForTask('analysis');
      setSelectedPostProcessingModel(postProcessingModel);
      setSelectedAnalysisModel(analysisModel);

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
   * Handle HuggingFace login
   */
  const handleHfLogin = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const success = await authService.login();
      if (success) {
        setIsHfAuthenticated(true);
        setHfUser(authService.getUser());
        toast.success(`Bienvenue ${authService.getUser()?.name || 'utilisateur'} !`);
      }
    } catch (error) {
      toast.error(`Connexion HuggingFace échouée: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsAuthLoading(false);
    }
  }, [authService, toast]);

  /**
   * Handle HuggingFace logout
   */
  const handleHfLogout = useCallback(() => {
    setShowDisconnectDialog(true);
  }, []);

  const confirmHfLogout = useCallback(async () => {
    setShowDisconnectDialog(false);
    await authService.logout();
    setIsHfAuthenticated(false);
    setHfUser(null);
  }, [authService]);

  /**
   * Toggle post-processing enabled state
   */
  const handleToggleEnabled = async (value: boolean) => {
    setIsEnabled(value);
    await modelService.setPostProcessingEnabled(value);

    if (value && !selectedPostProcessingModel) {
      // Prompt to select a model
      const downloaded = await modelService.getDownloadedModels();
      if (downloaded.length === 0) {
        toast.warning('Téléchargez d\'abord un modèle pour activer l\'amélioration IA.');
      }
    }
  };

  /**
   * Toggle automatic post-processing after transcription
   */
  const handleToggleAutoPostProcess = async (value: boolean) => {
    setIsAutoPostProcess(value);
    await modelService.setAutoPostProcessEnabled(value);
  };

  /**
   * Handle model selection for a specific task
   */
  const handleUseModelForTask = useCallback(async (modelId: LLMModelId, task: LLMTask) => {
    await modelService.setModelForTask(task, modelId);

    if (task === 'postProcessing') {
      setSelectedPostProcessingModel(modelId);
    } else {
      setSelectedAnalysisModel(modelId);
    }

    // Enable post-processing if not already
    if (!isEnabled) {
      setIsEnabled(true);
      await modelService.setPostProcessingEnabled(true);
    }

    const taskLabel = TASK_LABELS[task];
    toast.success(`${modelService.getModelConfig(modelId).name} sera utilisé pour ${taskLabel.name.toLowerCase()}.`);
  }, [isEnabled, modelService, toast]);

  /**
   * Show task selection menu for a model
   */
  const handleSelectTask = useCallback((modelId: LLMModelId) => {
    const modelConfig = modelService.getModelConfig(modelId);

    Alert.alert(
      `Utiliser ${modelConfig.name}`,
      'Pour quelle tâche voulez-vous utiliser ce modèle ?',
      [
        {
          text: 'Post-traitement',
          onPress: () => handleUseModelForTask(modelId, 'postProcessing'),
        },
        {
          text: 'Analyse',
          onPress: () => handleUseModelForTask(modelId, 'analysis'),
        },
        {
          text: 'Les deux',
          onPress: async () => {
            await handleUseModelForTask(modelId, 'postProcessing');
            await handleUseModelForTask(modelId, 'analysis');
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }, [handleUseModelForTask, modelService]);

  /**
   * Legacy handler for LLMModelCard compatibility
   */
  const handleUseModel = useCallback(async (modelId: LLMModelId) => {
    handleSelectTask(modelId);
  }, [handleSelectTask]);

  /**
   * Apply custom prompt (debug mode only)
   */
  const handleApplyPrompt = useCallback(() => {
    debugPromptManager.setCustomPrompt(customPrompt);
    setIsPromptModified(true);
    toast.success('Prompt personnalisé appliqué');
  }, [customPrompt, toast]);

  /**
   * Reset to default prompt (debug mode only)
   */
  const handleResetPrompt = useCallback(() => {
    debugPromptManager.resetToDefault();
    setCustomPrompt(debugPromptManager.getDefaultPrompt());
    setIsPromptModified(false);
    toast.info('Prompt par défaut restauré');
  }, [toast]);

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
              Active les fonctionnalités IA (analyses, résumés)
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Auto post-process toggle - only show when IA is enabled */}
        {isEnabled && (
          <View style={[styles.toggleRow, styles.toggleRowIndented]}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleLabel}>Post-traitement automatique</Text>
              <Text style={styles.toggleDescription}>
                Améliorer automatiquement les transcriptions après Whisper.
                Désactivé = transcription brute, modèles déchargés plus vite.
              </Text>
            </View>
            <Switch
              value={isAutoPostProcess}
              onValueChange={handleToggleAutoPostProcess}
              trackColor={{ false: '#E5E5EA', true: '#34C759' }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}
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
            <View style={styles.tpuTitleRow}>
              <Feather name={getNPUTitle(npuInfo).icon as any} size={20} color={colors.primary[600]} />
              <Text style={styles.tpuTitle}>{getNPUTitle(npuInfo).text}</Text>
            </View>
            <Text style={styles.tpuDescription}>
              {getNPUDescription(npuInfo)}
            </Text>
            {npuInfo.isRecommendedForLLM && (
              <View style={styles.tpuRecommendationRow}>
                <Feather name="zap" size={14} color={colors.success[600]} />
                <Text style={styles.tpuRecommendation}>
                  Accélération matérielle optimisée pour l'IA
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* HuggingFace Authentication (for gated models) */}
      {tpuModels.length > 0 && (
        <View style={styles.authSection}>
          <Text style={styles.sectionTitle}>Compte HuggingFace</Text>
          <Text style={styles.sectionDescription}>
            Certains modèles optimisés (Gemma MediaPipe) nécessitent une connexion HuggingFace
            pour accepter la licence d'utilisation.
          </Text>
          <View style={styles.authCard}>
            {isHfAuthenticated ? (
              <>
                <View style={styles.authUserInfo}>
                  <Feather name="check-circle" size={24} color={colors.success[500]} style={styles.authConnectedIcon} />
                  <View style={styles.authUserDetails}>
                    <Text style={styles.authUserName}>
                      {hfUser?.fullname || hfUser?.name || 'Utilisateur'}
                    </Text>
                    <Text style={styles.authUserHandle}>@{hfUser?.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.authLogoutButton}
                  onPress={handleHfLogout}
                >
                  <Text style={styles.authLogoutText}>Déconnecter</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.authNotConnected}>
                  <Feather name="lock" size={20} color={colors.neutral[500]} style={styles.authNotConnectedIcon} />
                  <Text style={styles.authNotConnectedText}>
                    Non connecté - Connectez-vous pour télécharger les modèles Gemma optimisés TPU
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.authLoginButton, isAuthLoading && styles.authButtonDisabled]}
                  onPress={handleHfLogin}
                  disabled={isAuthLoading}
                >
                  {isAuthLoading ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.authLoginText}>🤗 Se connecter à HuggingFace</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      )}

      {/* Task Assignments Summary */}
      {isEnabled && (selectedPostProcessingModel || selectedAnalysisModel) && (
        <View style={styles.taskAssignmentsSection}>
          <Text style={styles.sectionTitle}>Configuration par tâche</Text>
          <View style={styles.taskAssignmentsCard}>
            {/* Post-processing task */}
            <View style={styles.taskAssignmentRow}>
              <View style={styles.taskInfo}>
                <Feather name={TASK_LABELS.postProcessing.icon as any} size={20} color={colors.primary[600]} style={styles.taskIcon} />
                <View style={styles.taskDetails}>
                  <Text style={styles.taskName}>{TASK_LABELS.postProcessing.name}</Text>
                  <Text style={styles.taskDescription}>{TASK_LABELS.postProcessing.description}</Text>
                </View>
              </View>
              <Text style={styles.taskModel}>
                {selectedPostProcessingModel
                  ? modelService.getModelConfig(selectedPostProcessingModel).name
                  : 'Non défini'}
              </Text>
            </View>
            <View style={styles.taskDivider} />
            {/* Analysis task */}
            <View style={styles.taskAssignmentRow}>
              <View style={styles.taskInfo}>
                <Feather name={TASK_LABELS.analysis.icon as any} size={20} color={colors.primary[600]} style={styles.taskIcon} />
                <View style={styles.taskDetails}>
                  <Text style={styles.taskName}>{TASK_LABELS.analysis.name}</Text>
                  <Text style={styles.taskDescription}>{TASK_LABELS.analysis.description}</Text>
                </View>
              </View>
              <Text style={styles.taskModel}>
                {selectedAnalysisModel
                  ? modelService.getModelConfig(selectedAnalysisModel).name
                  : 'Non défini'}
              </Text>
            </View>
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
              isSelected={selectedPostProcessingModel === model.id || selectedAnalysisModel === model.id}
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
            isSelected={selectedPostProcessingModel === model.id || selectedAnalysisModel === model.id}
            onUseModel={handleUseModel}
          />
        ))}
      </View>

      {/* Debug: Custom Prompt Editor (only in debug mode) */}
      {debugMode && (
        <View style={styles.debugSection}>
          <View style={styles.debugHeader}>
            <View style={styles.debugTitleRow}>
              <Feather name="tool" size={16} color={colors.warning[600]} />
              <Text style={styles.debugTitle}>Debug: Prompt Système</Text>
            </View>
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
              <View style={styles.debugButtonContent}>
                <Feather name="rotate-ccw" size={14} color={colors.warning[700]} />
                <Text style={styles.debugButtonSecondaryText}>Restaurer</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonPrimary]}
              onPress={handleApplyPrompt}
            >
              <View style={styles.debugButtonContent}>
                <Feather name="check" size={14} color={colors.neutral[0]} />
                <Text style={styles.debugButtonPrimaryText}>Appliquer</Text>
              </View>
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

      <AlertDialog
        visible={showDisconnectDialog}
        onClose={() => setShowDisconnectDialog(false)}
        variant="warning"
        title="Déconnexion HuggingFace"
        message="Voulez-vous vous déconnecter de HuggingFace ? Vous ne pourrez plus télécharger les modèles protégés."
        confirmAction={{
          label: 'Déconnecter',
          variant: 'danger',
          onPress: confirmHfLogout,
        }}
      />
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
  toggleRowIndented: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingLeft: 24,
    backgroundColor: '#FAFAFA',
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
  tpuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tpuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tpuDescription: {
    fontSize: 14,
    color: '#666',
  },
  tpuRecommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  tpuRecommendation: {
    fontSize: 13,
    color: '#7B1FA2',
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
  // Task assignments styles
  taskAssignmentsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  taskAssignmentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  taskAssignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  taskIcon: {
    marginRight: 12,
  },
  taskDetails: {
    flex: 1,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  taskDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  taskModel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
    textAlign: 'right',
    maxWidth: 120,
  },
  taskDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 8,
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
  debugTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  debugButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  // HuggingFace Auth styles
  authSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  authCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  authUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authConnectedIcon: {
    marginRight: 12,
  },
  authUserDetails: {
    flex: 1,
  },
  authUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  authUserHandle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  authLogoutButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  authLogoutText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '500',
  },
  authNotConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authNotConnectedIcon: {
    marginRight: 12,
  },
  authNotConnectedText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  authLoginButton: {
    backgroundColor: '#FF9D00',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  authLoginText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  authButtonDisabled: {
    opacity: 0.6,
  },
});
