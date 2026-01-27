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
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
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
import { useTheme } from '../../hooks/useTheme';

// Theme-aware colors
const getThemeColors = (isDark: boolean) => ({
  screenBg: isDark ? colors.neutral[900] : '#F2F2F7',
  cardBg: isDark ? colors.neutral[800] : '#FFFFFF',
  textPrimary: isDark ? colors.neutral[50] : '#000',
  textSecondary: isDark ? colors.neutral[400] : '#666',
  textTertiary: isDark ? colors.neutral[500] : '#8E8E93',
  borderDefault: isDark ? colors.neutral[700] : '#E5E5EA',
  iconPrimary: isDark ? colors.primary[400] : colors.primary[600],
  toggleRowIndentedBg: isDark ? colors.neutral[850] : '#FAFAFA',
  // TPU Card colors
  tpuCardActiveBg: isDark ? '#2D1B3C' : '#F3E5F5',
  tpuCardActiveBorder: isDark ? '#7B1FA2' : '#CE93D8',
  tpuCardInactiveBg: isDark ? '#0D2847' : '#E3F2FD',
  tpuCardInactiveBorder: isDark ? '#1976D2' : '#90CAF9',
  tpuCardAppleBg: isDark ? colors.neutral[850] : '#F5F5F5',
  tpuCardAppleBorder: isDark ? colors.neutral[600] : '#A1A1A6',
  tpuCardSamsungBg: isDark ? '#0D2847' : '#E8F0FE',
  tpuCardSamsungBorder: isDark ? '#1976D2' : '#1A73E8',
  tpuTitle: isDark ? colors.neutral[50] : '#333',
  tpuDescription: isDark ? colors.neutral[400] : '#666',
  tpuRecommendation: isDark ? colors.primary[300] : '#7B1FA2',
  // HuggingFace Auth
  authNotConnectedText: isDark ? colors.neutral[400] : '#666',
  authUserName: isDark ? colors.neutral[50] : '#000',
  authUserHandle: isDark ? colors.neutral[500] : '#8E8E93',
  authLogoutButtonBg: isDark ? colors.neutral[700] : '#F2F2F7',
  authLogoutText: isDark ? colors.error[400] : '#FF3B30',
  authLoginButtonBg: isDark ? '#D68400' : '#FF9D00',
  // Task assignments
  taskName: isDark ? colors.neutral[50] : '#000',
  taskDescription: isDark ? colors.neutral[500] : '#8E8E93',
  taskModel: isDark ? colors.primary[400] : '#007AFF',
  taskDivider: isDark ? colors.neutral[700] : '#E5E5EA',
  // Debug section
  debugSectionBg: isDark ? colors.warning[900] : '#FFF3E0',
  debugSectionBorder: isDark ? colors.warning[700] : '#FFB74D',
  debugTitle: isDark ? colors.warning[300] : '#E65100',
  debugDescription: isDark ? colors.warning[200] : '#795548',
  debugInputBg: isDark ? colors.neutral[800] : '#FFF',
  debugInputBorder: isDark ? colors.warning[700] : '#FFCC80',
  debugInputText: isDark ? colors.neutral[50] : '#333',
  debugButtonPrimaryBg: isDark ? colors.warning[700] : '#FF9800',
  debugButtonSecondaryBg: isDark ? colors.neutral[800] : '#FFF',
  debugButtonSecondaryBorder: isDark ? colors.warning[700] : '#FFB74D',
  debugButtonSecondaryText: isDark ? colors.warning[300] : '#E65100',
});

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
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);

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
  const [showTaskSelectionDialog, setShowTaskSelectionDialog] = useState(false);
  const [selectedModelForTask, setSelectedModelForTask] = useState<LLMModelId | null>(null);
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
    setSelectedModelForTask(modelId);
    setShowTaskSelectionDialog(true);
  }, []);

  /**
   * Handle task selection from dialog
   */
  const handleTaskSelection = useCallback(async (task: LLMTask | 'both') => {
    setShowTaskSelectionDialog(false);
    if (!selectedModelForTask) return;

    if (task === 'both') {
      await handleUseModelForTask(selectedModelForTask, 'postProcessing');
      await handleUseModelForTask(selectedModelForTask, 'analysis');
    } else {
      await handleUseModelForTask(selectedModelForTask, task);
    }
    setSelectedModelForTask(null);
  }, [selectedModelForTask, handleUseModelForTask]);

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
    <ScrollView style={[styles.container, { backgroundColor: themeColors.screenBg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: themeColors.textTertiary }]}>Amélioration IA</Text>
        <Text style={[styles.headerDescription, { color: themeColors.textSecondary }]}>
          Utilisez un modèle d'intelligence artificielle local pour améliorer automatiquement
          la qualité des transcriptions (ponctuation, grammaire, capitalisation).
        </Text>
      </View>

      {/* Enable Toggle */}
      <View style={[styles.toggleSection, { backgroundColor: themeColors.cardBg }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleLabel, { color: themeColors.textPrimary }]}>Activer l'amélioration IA</Text>
            <Text style={[styles.toggleDescription, { color: themeColors.textTertiary }]}>
              Active les fonctionnalités IA (analyses, résumés)
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleEnabled}
            trackColor={{ false: isDark ? colors.neutral[700] : '#E5E5EA', true: '#34C759' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Auto post-process toggle - only show when IA is enabled */}
        {isEnabled && (
          <View style={[
            styles.toggleRow,
            styles.toggleRowIndented,
            {
              borderTopColor: themeColors.borderDefault,
              backgroundColor: themeColors.toggleRowIndentedBg,
            }
          ]}>
            <View style={styles.toggleContent}>
              <Text style={[styles.toggleLabel, { color: themeColors.textPrimary }]}>Post-traitement automatique</Text>
              <Text style={[styles.toggleDescription, { color: themeColors.textTertiary }]}>
                Améliorer automatiquement les transcriptions après Whisper.
                Désactivé = transcription brute, modèles déchargés plus vite.
              </Text>
            </View>
            <Switch
              value={isAutoPostProcess}
              onValueChange={handleToggleAutoPostProcess}
              trackColor={{ false: isDark ? colors.neutral[700] : '#E5E5EA', true: '#34C759' }}
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
            {
              backgroundColor: npuInfo.hasNPU
                ? (npuInfo.type === 'neural-engine' ? themeColors.tpuCardAppleBg : npuInfo.type === 'samsung-npu' ? themeColors.tpuCardSamsungBg : themeColors.tpuCardActiveBg)
                : themeColors.tpuCardInactiveBg,
              borderColor: npuInfo.hasNPU
                ? (npuInfo.type === 'neural-engine' ? themeColors.tpuCardAppleBorder : npuInfo.type === 'samsung-npu' ? themeColors.tpuCardSamsungBorder : themeColors.tpuCardActiveBorder)
                : themeColors.tpuCardInactiveBorder,
            }
          ]}>
            <View style={styles.tpuTitleRow}>
              <Feather name={getNPUTitle(npuInfo).icon as any} size={20} color={themeColors.iconPrimary} />
              <Text style={[styles.tpuTitle, { color: themeColors.tpuTitle }]}>{getNPUTitle(npuInfo).text}</Text>
            </View>
            <Text style={[styles.tpuDescription, { color: themeColors.tpuDescription }]}>
              {getNPUDescription(npuInfo)}
            </Text>
            {npuInfo.isRecommendedForLLM && (
              <View style={styles.tpuRecommendationRow}>
                <Feather name="zap" size={14} color={isDark ? colors.success[400] : colors.success[600]} />
                <Text style={[styles.tpuRecommendation, { color: themeColors.tpuRecommendation }]}>
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
          <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Compte HuggingFace</Text>
          <Text style={[styles.sectionDescription, { color: themeColors.textSecondary }]}>
            Certains modèles optimisés (Gemma MediaPipe) nécessitent une connexion HuggingFace
            pour accepter la licence d'utilisation.
          </Text>
          <View style={[styles.authCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.borderDefault }]}>
            {isHfAuthenticated ? (
              <>
                <View style={styles.authUserInfo}>
                  <Feather name="check-circle" size={24} color={isDark ? colors.success[400] : colors.success[500]} style={styles.authConnectedIcon} />
                  <View style={styles.authUserDetails}>
                    <Text style={[styles.authUserName, { color: themeColors.authUserName }]}>
                      {hfUser?.fullname || hfUser?.name || 'Utilisateur'}
                    </Text>
                    <Text style={[styles.authUserHandle, { color: themeColors.authUserHandle }]}>@{hfUser?.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.authLogoutButton, { backgroundColor: themeColors.authLogoutButtonBg }]}
                  onPress={handleHfLogout}
                >
                  <Text style={[styles.authLogoutText, { color: themeColors.authLogoutText }]}>Déconnecter</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.authNotConnected}>
                  <Feather name="lock" size={20} color={themeColors.textTertiary} style={styles.authNotConnectedIcon} />
                  <Text style={[styles.authNotConnectedText, { color: themeColors.authNotConnectedText }]}>
                    Non connecté - Connectez-vous pour télécharger les modèles Gemma optimisés TPU
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.authLoginButton, { backgroundColor: themeColors.authLoginButtonBg }, isAuthLoading && styles.authButtonDisabled]}
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
          <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Configuration par tâche</Text>
          <View style={[styles.taskAssignmentsCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.borderDefault }]}>
            {/* Post-processing task */}
            <View style={styles.taskAssignmentRow}>
              <View style={styles.taskInfo}>
                <Feather name={TASK_LABELS.postProcessing.icon as any} size={20} color={themeColors.iconPrimary} style={styles.taskIcon} />
                <View style={styles.taskDetails}>
                  <Text style={[styles.taskName, { color: themeColors.taskName }]}>{TASK_LABELS.postProcessing.name}</Text>
                  <Text style={[styles.taskDescription, { color: themeColors.taskDescription }]}>{TASK_LABELS.postProcessing.description}</Text>
                </View>
              </View>
              <Text style={[styles.taskModel, { color: themeColors.taskModel }]}>
                {selectedPostProcessingModel
                  ? modelService.getModelConfig(selectedPostProcessingModel).name
                  : 'Non défini'}
              </Text>
            </View>
            <View style={[styles.taskDivider, { backgroundColor: themeColors.taskDivider }]} />
            {/* Analysis task */}
            <View style={styles.taskAssignmentRow}>
              <View style={styles.taskInfo}>
                <Feather name={TASK_LABELS.analysis.icon as any} size={20} color={themeColors.iconPrimary} style={styles.taskIcon} />
                <View style={styles.taskDetails}>
                  <Text style={[styles.taskName, { color: themeColors.taskName }]}>{TASK_LABELS.analysis.name}</Text>
                  <Text style={[styles.taskDescription, { color: themeColors.taskDescription }]}>{TASK_LABELS.analysis.description}</Text>
                </View>
              </View>
              <Text style={[styles.taskModel, { color: themeColors.taskModel }]}>
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
          <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Modèles optimisés TPU</Text>
          <Text style={[styles.sectionDescription, { color: themeColors.textSecondary }]}>
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
        <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Modèles standards</Text>
        <Text style={[styles.sectionDescription, { color: themeColors.textSecondary }]}>
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
        <View style={[styles.debugSection, {
          backgroundColor: themeColors.debugSectionBg,
          borderColor: themeColors.debugSectionBorder,
        }]}>
          <View style={styles.debugHeader}>
            <View style={styles.debugTitleRow}>
              <Feather name="tool" size={16} color={isDark ? colors.warning[400] : colors.warning[600]} />
              <Text style={[styles.debugTitle, { color: themeColors.debugTitle }]}>Debug: Prompt Système</Text>
            </View>
            {isPromptModified && (
              <View style={styles.debugBadge}>
                <Text style={styles.debugBadgeText}>Modifié</Text>
              </View>
            )}
          </View>
          <Text style={[styles.debugDescription, { color: themeColors.debugDescription }]}>
            Modifiez le prompt système pour tester différentes instructions.
            Ce changement est temporaire (perdu au redémarrage).
          </Text>
          <TextInput
            style={[styles.debugPromptInput, {
              backgroundColor: themeColors.debugInputBg,
              borderColor: themeColors.debugInputBorder,
              color: themeColors.debugInputText,
            }]}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
            placeholder="Entrez le prompt système..."
            placeholderTextColor={isDark ? colors.neutral[500] : '#999'}
          />
          <View style={styles.debugButtonRow}>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonSecondary, {
                backgroundColor: themeColors.debugButtonSecondaryBg,
                borderColor: themeColors.debugButtonSecondaryBorder,
              }]}
              onPress={handleResetPrompt}
            >
              <View style={styles.debugButtonContent}>
                <Feather name="rotate-ccw" size={14} color={isDark ? colors.warning[400] : colors.warning[700]} />
                <Text style={[styles.debugButtonSecondaryText, { color: themeColors.debugButtonSecondaryText }]}>Restaurer</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonPrimary, {
                backgroundColor: themeColors.debugButtonPrimaryBg,
              }]}
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
        <Text style={[styles.footerText, { color: themeColors.textTertiary }]}>
          Les modèles sont exécutés 100% localement sur votre appareil.
          Vos données ne quittent jamais votre téléphone.
        </Text>
        <Text style={[styles.footerText, { color: themeColors.textTertiary }]}>
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

      {/* Task Selection Modal */}
      <Modal
        visible={showTaskSelectionDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTaskSelectionDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {selectedModelForTask && `Utiliser ${modelService.getModelConfig(selectedModelForTask).name}`}
            </Text>
            <Text style={[styles.modalMessage, { color: themeColors.textSecondary }]}>
              Pour quelle tâche voulez-vous utiliser ce modèle ?
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.taskButton, { backgroundColor: isDark ? colors.primary[700] : colors.primary[50], borderColor: isDark ? colors.primary[600] : colors.primary[200] }]}
                onPress={() => handleTaskSelection('postProcessing')}
              >
                <Feather name="edit-3" size={20} color={isDark ? colors.primary[300] : colors.primary[600]} />
                <Text style={[styles.taskButtonText, { color: isDark ? colors.primary[300] : colors.primary[600] }]}>
                  Post-traitement
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.taskButton, { backgroundColor: isDark ? colors.success[900] : colors.success[50], borderColor: isDark ? colors.success[700] : colors.success[200] }]}
                onPress={() => handleTaskSelection('analysis')}
              >
                <Feather name="search" size={20} color={isDark ? colors.success[400] : colors.success[600]} />
                <Text style={[styles.taskButtonText, { color: isDark ? colors.success[400] : colors.success[600] }]}>
                  Analyse
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.taskButton, { backgroundColor: isDark ? colors.warning[900] : colors.warning[50], borderColor: isDark ? colors.warning[700] : colors.warning[200] }]}
                onPress={() => handleTaskSelection('both')}
              >
                <Feather name="layers" size={20} color={isDark ? colors.warning[400] : colors.warning[600]} />
                <Text style={[styles.taskButtonText, { color: isDark ? colors.warning[400] : colors.warning[600] }]}>
                  Les deux
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.taskButtonCancel, { backgroundColor: themeColors.borderDefault }]}
                onPress={() => {
                  setShowTaskSelectionDialog(false);
                  setSelectedModelForTask(null);
                }}
              >
                <Text style={[styles.taskButtonCancelText, { color: themeColors.textSecondary }]}>
                  Annuler
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    gap: 12,
  },
  taskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  taskButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  taskButtonCancel: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  taskButtonCancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
