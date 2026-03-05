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
  AppState,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import { colors } from '../../design-system/tokens';
import { AlertDialog, useToast } from '../../design-system/components';
import { LLMModelCard } from '../../components/llm/LLMModelCard';
import type {
  ILLMModelService,
  LLMModelId,
  LLMModelConfig,
  LLMTask,
} from '../../contexts/Normalization/domain/ILLMModelService';
import { NPUDetectionService, type NPUInfo } from '../../contexts/Normalization/services/NPUDetectionService';
import { PostProcessingService } from '../../contexts/Normalization/services/PostProcessingService';
import { type HuggingFaceUser } from '../../contexts/Normalization/services/HuggingFaceAuthService';
import { debugPromptManager } from '../../contexts/Normalization/services/postprocessing/IPostProcessingBackend';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLLMSettingsScreenStore, hasDownloadedModels } from '../../stores/llmSettingsScreenStore';
import { useTheme } from '../../hooks/useTheme';
import { StandardLayout } from '../../components/layouts';
import type { IModelUsageTrackingService, UnusedModel } from '../../contexts/Normalization/domain/IModelUsageTrackingService';
import { MODEL_INACTIVITY_THRESHOLD_DAYS } from '../../contexts/Normalization/services/ModelUsageTrackingService';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';
import { useModelUpdateCheck } from '../../hooks/useModelUpdateCheck';
import type { IModelUpdateCheckService } from '../../contexts/Normalization/domain/IModelUpdateCheckService';
import type { IModelDownloadNotificationService } from '../../contexts/Normalization/domain/IModelDownloadNotificationService';

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

  // Global LLM settings (from settingsStore)
  const isEnabled = useSettingsStore((state) => state.llm.isEnabled);
  const isAutoPostProcess = useSettingsStore((state) => state.llm.isAutoPostProcess);
  const isAutoAnalysis = useSettingsStore((state) => state.llm.isAutoAnalysis);
  const selectedPostProcessingModel = useSettingsStore((state) => state.llm.selectedPostProcessingModel);
  const selectedAnalysisModel = useSettingsStore((state) => state.llm.selectedAnalysisModel);
  const { setLLMEnabled, setLLMAutoPostProcess, setLLMAutoAnalysis, setLLMModelForTask } = useSettingsStore();

  // Screen-specific UI state (from llmSettingsScreenStore)
  const tpuModels = useLLMSettingsScreenStore((state) => state.tpuModels);
  const standardModels = useLLMSettingsScreenStore((state) => state.standardModels);
  const isHfAuthenticated = useLLMSettingsScreenStore((state) => state.isHfAuthenticated);
  const hfUser = useLLMSettingsScreenStore((state) => state.hfUser);
  const npuInfo = useLLMSettingsScreenStore((state) => state.npuInfo);
  const { setModels, setHfAuth, setNpuInfo } = useLLMSettingsScreenStore();

  // Local UI state (dialogs, loading)
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

  // Unused models (Story 8.8 — AC4)
  const [unusedLLMModels, setUnusedLLMModels] = useState<UnusedModel[]>([]);
  const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);
  const [pendingDeleteModelId, setPendingDeleteModelId] = useState<LLMModelId | null>(null);

  // Story 8.9 — Modèles téléchargés pour la vérification de mises à jour (AC1, AC2)
  const [downloadedModelsForCheck, setDownloadedModelsForCheck] = useState<
    Array<{ modelId: string; modelName: string; downloadUrl: string }>
  >([]);
  const { updateInfoMap, isChecking, checkAll } = useModelUpdateCheck(downloadedModelsForCheck, 'llm');

  // Get services from DI container (singleton instances)
  const modelService = useMemo(() => container.resolve<ILLMModelService>(TOKENS.ILLMModelService), []);
  const npuDetection = useMemo(() => container.resolve(NPUDetectionService), []);
  const authService = modelService.getAuthService();
  const usageTrackingService = useMemo(() => container.resolve<IModelUsageTrackingService>(TOKENS.IModelUsageTrackingService), []);

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

  // Update settings when models change
  useEffect(() => {
    const checkDownloadedModels = async () => {
      const downloaded = await modelService.getDownloadedModels();
      const hasModels = downloaded.length > 0;

      // Auto-disable post-processing if no models are available
      if (!hasModels && isEnabled) {
        console.log('[LLMSettings] No models available, disabling post-processing');
        setLLMEnabled(false);
        await modelService.setPostProcessingEnabled(false);
      }

      // Clear selected models if they are no longer downloaded
      const downloadedIds = downloaded.map(m => m.id);

      if (selectedPostProcessingModel && !downloadedIds.includes(selectedPostProcessingModel)) {
        console.log('[LLMSettings] Post-processing model deleted, clearing selection');
        setLLMModelForTask('postProcessing', null);
        await modelService.setModelForTask('postProcessing', null);
      }

      if (selectedAnalysisModel && !downloadedIds.includes(selectedAnalysisModel)) {
        console.log('[LLMSettings] Analysis model deleted, clearing selection');
        setLLMModelForTask('analysis', null);
        await modelService.setModelForTask('analysis', null);
      }
    };
    checkDownloadedModels();
  }, [tpuModels, standardModels, modelService, isEnabled, selectedPostProcessingModel, selectedAnalysisModel, setLLMEnabled, setLLMModelForTask]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Initialize auth service
      await authService.initialize();
      setHfAuth(authService.isAuthenticated(), authService.getUser());

      // Settings are already loaded by useLLMSettingsListener
      // We just need to load screen-specific state

      // Detect NPU capabilities
      const info = await npuDetection.detectNPU();
      setNpuInfo(info);

      // Load models by category, filtered for current device
      // Only show MediaPipe/LiteRT-LM models on Google Pixel devices
      const tpuMediapipe = info.type === 'tensor-tpu'
        ? await modelService.getModelsForBackendAndDevice('mediapipe')
        : [];
      const tpuLitert = info.type === 'tensor-tpu'
        ? await modelService.getModelsForBackendAndDevice('litert-lm')
        : [];
      const tpu = [...tpuMediapipe, ...tpuLitert];
      // Get llamarn models filtered for current device (Apple->Llama, Google->Gemma, Others->generic)
      const standard = await modelService.getModelsForBackendAndDevice('llamarn');
      setModels(tpu, standard);

      // Story 8.9 — Charger la liste des modèles téléchargés pour la vérification de mises à jour (AC1)
      const downloaded = await modelService.getDownloadedModels();
      setDownloadedModelsForCheck(
        downloaded.map((m) => ({ modelId: m.id, modelName: m.name, downloadUrl: m.downloadUrl }))
      );
    };

    loadSettings();
  }, [authService, modelService, npuDetection, setHfAuth, setNpuInfo, setModels]);

  /**
   * Refresh models list (e.g., after HuggingFace auth changes or model deletion)
   */
  const refreshModels = useCallback(async () => {
    if (!npuInfo) return;

    // Reload models by category, filtered for current device
    const tpuMediapipe = npuInfo.type === 'tensor-tpu'
      ? await modelService.getModelsForBackendAndDevice('mediapipe')
      : [];
    const tpuLitert = npuInfo.type === 'tensor-tpu'
      ? await modelService.getModelsForBackendAndDevice('litert-lm')
      : [];
    const tpu = [...tpuMediapipe, ...tpuLitert];
    const standard = await modelService.getModelsForBackendAndDevice('llamarn');
    setModels(tpu, standard);

    // Story 8.9 — Rafraîchir la liste des modèles téléchargés pour le check de mises à jour
    const downloaded = await modelService.getDownloadedModels();
    setDownloadedModelsForCheck(
      downloaded.map((m) => ({ modelId: m.id, modelName: m.name, downloadUrl: m.downloadUrl }))
    );
  }, [npuInfo, modelService, setModels]);

  /**
   * Story 8.8 — Vérifier les modèles LLM inutilisés (AC4)
   * Passe les chemins de fichiers pour le fallback FileSystem.getInfoAsync (AC3)
   */
  const checkUnusedModels = useCallback(async () => {
    const downloadedIds = await modelService.getDownloadedModelIds();
    // Construire la map paths pour le fallback FileSystem (AC3 — modèles sans lastUsed)
    const paths = new Map<string, string>();
    for (const id of downloadedIds) {
      paths.set(id, modelService.getModelPath(id as LLMModelId));
    }
    const result = await usageTrackingService.getUnusedModels(downloadedIds, [], MODEL_INACTIVITY_THRESHOLD_DAYS, paths);
    if (result.type === RepositoryResultType.SUCCESS && result.data) {
      setUnusedLLMModels(result.data);
    } else if (result.type !== RepositoryResultType.SUCCESS) {
      console.warn('[LLMSettings] checkUnusedModels failed:', result);
    }
  }, [modelService, usageTrackingService]);

  // Vérifier les modèles inutilisés au montage (Story 8.8 — Subtask 6.1)
  useEffect(() => {
    checkUnusedModels();
  }, [checkUnusedModels]);

  // Re-sync HuggingFace auth state when app comes back to foreground.
  // Handles the case where openAuthSessionAsync returns 'dismiss' (iOS production)
  // and useDeepLinkAuth has already stored the token via handleDeepLinkToken,
  // but llmSettingsScreenStore was never notified.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const isAuth = authService.isAuthenticated();
        setHfAuth(isAuth, authService.getUser());
        await refreshModels();
        await checkUnusedModels();
      }
    });
    return () => subscription.remove();
  }, [authService, setHfAuth, refreshModels, checkUnusedModels]);

  /**
   * Handle model deletion - refresh list and check if we need to disable post-processing
   */
  const handleModelDeleted = useCallback(async (modelId: LLMModelId) => {
    console.log('[LLMSettings] Model deleted:', modelId);
    // Refresh models list to update UI
    await refreshModels();
    await checkUnusedModels();
  }, [refreshModels, checkUnusedModels]);

  /**
   * Story 8.8 — Afficher la confirmation de suppression depuis l'alerte d'inactivité (AC6)
   */
  const handleDeleteUnused = useCallback((modelId: LLMModelId) => {
    setPendingDeleteModelId(modelId);
    setShowDeleteUnusedDialog(true);
  }, []);

  /**
   * Story 8.8 — Confirmer la suppression du modèle inutilisé (AC6)
   */
  const confirmDeleteUnused = useCallback(async () => {
    if (!pendingDeleteModelId) return;
    setShowDeleteUnusedDialog(false);
    try {
      await modelService.deleteModel(pendingDeleteModelId);
      await refreshModels();
      await checkUnusedModels();
      toast.success('Modèle supprimé');
    } catch (error) {
      toast.error('Impossible de supprimer le modèle');
    } finally {
      setPendingDeleteModelId(null);
    }
  }, [pendingDeleteModelId, modelService, refreshModels, checkUnusedModels, toast]);

  /**
   * Story 8.8 — Ignorer l'alerte d'inactivité pour un modèle (AC7)
   */
  const handleDismissUnused = useCallback(async (modelId: LLMModelId) => {
    await usageTrackingService.dismissSuggestion(modelId, 'llm');
    setUnusedLLMModels(prev => prev.filter(m => m.modelId !== modelId));
  }, [usageTrackingService]);

  /**
   * Story 8.9 — Déclencher la mise à jour d'un modèle LLM (AC5, AC6)
   * Télécharge le modèle puis enregistre la mise à jour via recordUpdate()
   */
  const handleUpdate = useCallback(async (modelId: LLMModelId) => {
    try {
      const config = modelService.getModelConfig(modelId);
      await modelService.downloadModelWithRetry(modelId);
      // Enregistrer la mise à jour (updateDate + nouvel ETag)
      const getLLMUpdateCheckService = () =>
        container.resolve<IModelUpdateCheckService>(TOKENS.IModelUpdateCheckService);
      await getLLMUpdateCheckService().recordUpdate(modelId, 'llm', config.downloadUrl);
      // AC6 : notification "Modèle mis à jour" (note : le service envoie aussi "Modèle téléchargé"
      // depuis son handler .done() — correction définitive requiert flag isUpdate dans downloadModelWithRetry)
      const getNotifSvc = () =>
        container.resolve<IModelDownloadNotificationService>(TOKENS.IModelDownloadNotificationService);
      await getNotifSvc().notifyUpdateSuccess(modelId, config.name, 'llm').catch(() => {});
      // Rafraîchir l'état UI + liste des modèles téléchargés
      await refreshModels();
      await checkAll();
      toast.success(`${config.name} mis à jour`);
    } catch (error) {
      toast.error('Impossible de mettre à jour le modèle');
    }
  }, [modelService, checkAll, refreshModels, toast]);

  /**
   * Handle HuggingFace login
   */
  const handleHfLogin = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const success = await authService.login();
      if (success) {
        setHfAuth(true, authService.getUser());
        toast.success(`Bienvenue ${authService.getUser()?.name || 'utilisateur'} !`);

        // Refresh models to update gated models availability
        await refreshModels();
      }
    } catch (error) {
      toast.error(`Connexion HuggingFace échouée: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsAuthLoading(false);
    }
  }, [authService, toast, refreshModels, setHfAuth]);

  /**
   * Handle HuggingFace logout
   */
  const handleHfLogout = useCallback(() => {
    setShowDisconnectDialog(true);
  }, []);

  const confirmHfLogout = useCallback(async () => {
    setShowDisconnectDialog(false);
    await authService.logout();
    setHfAuth(false, null);

    // Refresh models to update gated models availability
    await refreshModels();
  }, [authService, refreshModels, setHfAuth]);

  /**
   * Toggle post-processing enabled state
   */
  const handleToggleEnabled = async (value: boolean) => {
    setLLMEnabled(value);
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
    setLLMAutoPostProcess(value);
    await modelService.setAutoPostProcessEnabled(value);
  };

  /**
   * Toggle automatic analyses after processing
   */
  const handleToggleAutoAnalysis = (value: boolean) => {
    setLLMAutoAnalysis(value);
  };

  /**
   * Handle model selection for a specific task
   */
  const handleUseModelForTask = useCallback(async (modelId: LLMModelId, task: LLMTask) => {
    try {
      // Update both store and service
      setLLMModelForTask(task, modelId);
      await modelService.setModelForTask(task, modelId);

      if (task === 'postProcessing') {
        // Force reload of PostProcessingService to apply new model
        const postProcessingService = container.resolve(PostProcessingService);
        await postProcessingService.reloadModel();
        console.log('[LLMSettings] ✓ PostProcessing model reloaded:', modelId);
      }

      // Enable post-processing if not already
      if (!isEnabled) {
        setLLMEnabled(true);
        await modelService.setPostProcessingEnabled(true);
      }

      // Refresh models to update downloaded status and enable toggle
      await refreshModels();

      const taskLabel = TASK_LABELS[task];
      toast.success(`${modelService.getModelConfig(modelId).name} sera utilisé pour ${taskLabel.name.toLowerCase()}.`);
    } catch (error) {
      console.error('[LLMSettings] Failed to set model:', error);
      toast.error('Erreur lors de la configuration du modèle');
    }
  }, [isEnabled, modelService, toast, setLLMModelForTask, setLLMEnabled, refreshModels]);

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
    <StandardLayout useSafeArea={false}>
      <ScrollView style={[styles.container, { backgroundColor: themeColors.screenBg }]}>
        {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: themeColors.textTertiary }]}>Amélioration IA</Text>
        <Text style={[styles.headerDescription, { color: themeColors.textSecondary }]}>
          Utilisez un modèle d'intelligence artificielle local pour améliorer automatiquement
          la qualité des transcriptions (ponctuation, grammaire, capitalisation).
        </Text>
        {/* Story 8.9 — Bouton vérification manuelle des mises à jour (AC2) */}
        {downloadedModelsForCheck.length > 0 && (
          <TouchableOpacity
            style={[styles.checkUpdateButton, { backgroundColor: themeColors.cardBg, borderColor: themeColors.borderDefault }]}
            onPress={checkAll}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={themeColors.iconPrimary} />
            ) : (
              <Feather name="refresh-cw" size={14} color={themeColors.iconPrimary} />
            )}
            <Text style={[styles.checkUpdateButtonText, { color: themeColors.iconPrimary }]}>
              {isChecking ? 'Vérification...' : 'Vérifier les mises à jour'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Enable Toggle */}
      <View style={[styles.toggleSection, { backgroundColor: themeColors.cardBg }]}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleLabel, { color: hasDownloadedModels() ? themeColors.textPrimary : themeColors.textTertiary }]}>
              Activer l'amélioration IA
            </Text>
            <Text style={[styles.toggleDescription, { color: themeColors.textTertiary }]}>
              {hasDownloadedModels()
                ? 'Active les fonctionnalités IA (analyses, résumés)'
                : 'Téléchargez d\'abord un modèle LLM ci-dessous'}
            </Text>
          </View>
          <Switch
            value={isEnabled && hasDownloadedModels()}
            onValueChange={handleToggleEnabled}
            disabled={!hasDownloadedModels()}
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

        {/* Auto analysis toggle - only show when IA is enabled */}
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
              <Text style={[styles.toggleLabel, { color: themeColors.textPrimary }]}>Analyses automatiques</Text>
              <Text style={[styles.toggleDescription, { color: themeColors.textTertiary }]}>
                Lancer automatiquement les analyses IA (résumé, points clés, tâches, idées) après le traitement.
              </Text>
            </View>
            <Switch
              value={isAutoAnalysis}
              onValueChange={handleToggleAutoAnalysis}
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
              isHfAuthenticated={isHfAuthenticated}
              onModelDeleted={handleModelDeleted}
              unusedDays={unusedLLMModels.find(m => m.modelId === model.id)?.daysSinceLastUse}
              onDeleteUnused={() => handleDeleteUnused(model.id)}
              onDismissUnused={() => handleDismissUnused(model.id)}
              updateInfo={updateInfoMap[model.id]}
              onUpdate={handleUpdate}
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
            isHfAuthenticated={isHfAuthenticated}
            onModelDeleted={handleModelDeleted}
            unusedDays={unusedLLMModels.find(m => m.modelId === model.id)?.daysSinceLastUse}
            onDeleteUnused={() => handleDeleteUnused(model.id)}
            onDismissUnused={() => handleDismissUnused(model.id)}
            updateInfo={updateInfoMap[model.id]}
            onUpdate={handleUpdate}
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

      {/* Story 8.8 — Confirmation suppression modèle inutilisé (AC6) */}
      <AlertDialog
        visible={showDeleteUnusedDialog}
        onClose={() => {
          setShowDeleteUnusedDialog(false);
          setPendingDeleteModelId(null);
        }}
        title="Supprimer le modèle ?"
        message={
          pendingDeleteModelId
            ? `Supprimer ${modelService.getModelConfig(pendingDeleteModelId).name} et libérer l'espace disque ?`
            : ''
        }
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: 'Supprimer',
          onPress: confirmDeleteUnused,
        }}
        cancelAction={{
          label: 'Annuler',
          onPress: () => {
            setShowDeleteUnusedDialog(false);
            setPendingDeleteModelId(null);
          },
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
    </StandardLayout>
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
  checkUpdateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    gap: 6,
  },
  checkUpdateButtonText: {
    fontSize: 13,
    fontWeight: '500',
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

  },
  debugButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  debugButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',

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

  },
  taskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,

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
