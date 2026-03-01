/**
 * WhisperSettingsScreen - Dedicated screen for Whisper model configuration
 *
 * Features:
 * - Display all available Whisper models (tiny, base, small, medium)
 * - Show download status and progress for each model
 * - Allow user to select active model for transcription
 * - Offer to delete unused models to save space
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Switch,
  AppState,
} from 'react-native';
import { container } from 'tsyringe';
import { WhisperModelCard } from '../../components/whisper/WhisperModelCard';
import type { WhisperModelSize } from '../../contexts/Normalization/services/TranscriptionModelService';
import { useTranscriptionModel } from '../../hooks/useServices';
import type { IModelUsageTrackingService, UnusedModel } from '../../contexts/Normalization/domain/IModelUsageTrackingService';
import { MODEL_INACTIVITY_THRESHOLD_DAYS } from '../../contexts/Normalization/services/ModelUsageTrackingService';
import { RepositoryResultType } from '../../contexts/shared/domain/Result';
import { TOKENS } from '../../infrastructure/di/tokens';
import {
  CorrectionLearningService,
  type CorrectionEntry,
} from '../../contexts/Normalization/services/CorrectionLearningService';
import { AlertDialog, useToast } from '../../design-system/components';
import { useTheme } from '../../hooks/useTheme';
import { StandardLayout } from '../../components/layouts';
import { colors } from '../../design-system/tokens';
import { useSettingsStore } from '../../stores/settingsStore';

// Theme-aware colors
const getThemeColors = (isDark: boolean) => ({
  screenBg: isDark ? colors.neutral[900] : '#F2F2F7',
  textPrimary: isDark ? colors.neutral[50] : '#000',
  textSecondary: isDark ? colors.neutral[400] : '#666',
  textTertiary: isDark ? colors.neutral[500] : '#8E8E93',
  suggestionBg: isDark ? colors.warning[900] : '#FFF8E1',
  suggestionBorder: isDark ? colors.warning[700] : '#FFE082',
  suggestionText: isDark ? colors.warning[200] : '#5D4037',
  suggestionDetailText: isDark ? colors.warning[300] : '#8D6E63',
  addButtonBg: isDark ? colors.success[700] : '#4CAF50',
  dismissButtonBg: isDark ? colors.neutral[700] : '#EFEBE9',
  dismissButtonText: isDark ? colors.neutral[300] : '#8D6E63',
  inputBg: isDark ? colors.neutral[800] : '#FFFFFF',
  inputBorder: isDark ? colors.neutral[700] : '#E5E5EA',
  inputText: isDark ? colors.neutral[50] : '#000',
  saveButtonBg: isDark ? colors.success[700] : '#34C759',
  saveButtonDisabledBg: isDark ? colors.neutral[700] : '#A8A8A8',
});

export function WhisperSettingsScreen() {
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);
  const audioTrimEnabled = useSettingsStore((state) => state.audioTrimEnabled);
  const setAudioTrimEnabled = useSettingsStore((state) => state.setAudioTrimEnabled);
  const [selectedModel, setSelectedModel] = useState<WhisperModelSize | null>(null);
  const [vocabularyText, setVocabularyText] = useState<string>('');
  const [isSavingVocabulary, setIsSavingVocabulary] = useState(false);
  const [suggestions, setSuggestions] = useState<CorrectionEntry[]>([]);
  const [showDeleteOthersDialog, setShowDeleteOthersDialog] = useState(false);
  const [pendingDeleteModels, setPendingDeleteModels] = useState<WhisperModelSize[]>([]);
  const [deleteDialogMessage, setDeleteDialogMessage] = useState('');
  const toast = useToast();

  // Unused models (Story 8.8 — AC5)
  const [unusedWhisperModels, setUnusedWhisperModels] = useState<UnusedModel[]>([]);
  const [showDeleteUnusedDialog, setShowDeleteUnusedDialog] = useState(false);
  const [pendingDeleteSize, setPendingDeleteSize] = useState<WhisperModelSize | null>(null);

  const modelService = useTranscriptionModel();
  const usageTrackingService = useMemo(() => container.resolve<IModelUsageTrackingService>(TOKENS.IModelUsageTrackingService), []);

  /**
   * Story 8.8 — Vérifier les modèles Whisper inutilisés (AC5 — Subtask 6.5)
   */
  const checkUnusedWhisperModels = useCallback(async () => {
    const downloadedSizes = await modelService.getDownloadedModelSizes();
    const result = await usageTrackingService.getUnusedModels([], downloadedSizes, MODEL_INACTIVITY_THRESHOLD_DAYS);
    if (result.type === RepositoryResultType.SUCCESS && result.data) {
      setUnusedWhisperModels(result.data);
    }
  }, [modelService, usageTrackingService]);

  // Vérifier les modèles inutilisés au montage (Story 8.8 — Subtask 6.5)
  useEffect(() => {
    checkUnusedWhisperModels();
  }, [checkUnusedWhisperModels]);

  // Refresh selected model when app comes back to foreground (Story 8.7)
  // Handles the case where a background Whisper download completed
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        const selected = await modelService.getSelectedModel();
        setSelectedModel(selected);
        await checkUnusedWhisperModels();
      }
    });
    return () => subscription.remove();
  }, [checkUnusedWhisperModels]);

  // Load selected model, vocabulary, and suggestions on mount
  useEffect(() => {
    const loadSettings = async () => {
      const selected = await modelService.getSelectedModel();
      setSelectedModel(selected);

      const vocabulary = await modelService.getCustomVocabulary();
      setVocabularyText(vocabulary.join(', '));

      // Load vocabulary suggestions from correction learning
      const correctionSuggestions = await CorrectionLearningService.getSuggestions();
      setSuggestions(correctionSuggestions);
    };
    loadSettings();
  }, []);

  /**
   * Story 8.8 — Libellés des modèles Whisper pour la dialog de suppression (AC6)
   */
  const whisperModelLabels: Record<WhisperModelSize, string> = {
    tiny: 'Tiny (~75 MB)',
    base: 'Base (~142 MB)',
    small: 'Small (~466 MB)',
    medium: 'Medium (~1.5 GB)',
    'large-v3': 'Large V3 (~3.1 GB)',
  };

  /**
   * Story 8.8 — Afficher la confirmation de suppression depuis l'alerte d'inactivité (AC6)
   */
  const handleDeleteUnused = useCallback((modelSize: WhisperModelSize) => {
    setPendingDeleteSize(modelSize);
    setShowDeleteUnusedDialog(true);
  }, []);

  /**
   * Story 8.8 — Confirmer la suppression du modèle Whisper inutilisé (AC6)
   */
  const confirmDeleteUnused = useCallback(async () => {
    if (!pendingDeleteSize) return;
    setShowDeleteUnusedDialog(false);
    try {
      await modelService.deleteModel(pendingDeleteSize);
      await checkUnusedWhisperModels();
      toast.success('Modèle supprimé');
    } catch (error) {
      toast.error('Impossible de supprimer le modèle');
    } finally {
      setPendingDeleteSize(null);
    }
  }, [pendingDeleteSize, modelService, checkUnusedWhisperModels, toast]);

  /**
   * Story 8.8 — Ignorer l'alerte d'inactivité pour un modèle Whisper (AC7)
   */
  const handleDismissUnused = useCallback(async (modelSize: WhisperModelSize) => {
    await usageTrackingService.dismissSuggestion(modelSize, 'whisper');
    setUnusedWhisperModels(prev => prev.filter(m => m.modelId !== modelSize));
  }, [usageTrackingService]);

  /**
   * Handle model selection
   * - Set the model as selected
   * - Offer to delete other downloaded models
   */
  const handleUseModel = useCallback(async (modelSize: WhisperModelSize) => {
    // Set as selected model
    await modelService.setSelectedModel(modelSize);
    setSelectedModel(modelSize);

    // Check if other models are downloaded
    const allModels: WhisperModelSize[] = ['tiny', 'base', 'small', 'medium', 'large-v3'];
    const otherModels = allModels.filter(m => m !== modelSize);

    const downloadedOthers: WhisperModelSize[] = [];
    for (const model of otherModels) {
      if (await modelService.isModelDownloaded(model)) {
        downloadedOthers.push(model);
      }
    }

    if (downloadedOthers.length > 0) {
      const modelLabels: Record<WhisperModelSize, string> = {
        tiny: 'Tiny (~75 MB)',
        base: 'Base (~142 MB)',
        small: 'Small (~466 MB)',
        medium: 'Medium (~1.5 GB)',
        'large-v3': 'Large V3 (~3.1 GB)',
      };

      const otherLabels = downloadedOthers.map(m => modelLabels[m]).join(', ');
      const totalSize = downloadedOthers.reduce((acc, m) => {
        const sizes: Record<WhisperModelSize, number> = { tiny: 75, base: 142, small: 466, medium: 1500, 'large-v3': 3100 };
        return acc + sizes[m];
      }, 0);

      const message = `${downloadedOthers.length > 1 ? 'Les modèles suivants sont' : 'Le modèle suivant est'} toujours téléchargé${downloadedOthers.length > 1 ? 's' : ''} :\n${otherLabels}\n\nVoulez-vous ${downloadedOthers.length > 1 ? 'les' : 'le'} supprimer pour libérer ~${totalSize >= 1000 ? (totalSize / 1000).toFixed(1) + ' GB' : totalSize + ' MB'} ?`;
      setDeleteDialogMessage(message);
      setPendingDeleteModels(downloadedOthers);
      setShowDeleteOthersDialog(true);
    }
  }, []);

  /**
   * Confirm deletion of other models
   */
  const confirmDeleteOthers = useCallback(async () => {
    setShowDeleteOthersDialog(false);
    try {
      for (const model of pendingDeleteModels) {
        await modelService.deleteModel(model);
      }
      toast.success(pendingDeleteModels.length > 1 ? 'Les modèles ont été supprimés' : 'Le modèle a été supprimé');
    } catch (error) {
      toast.error('Impossible de supprimer certains modèles');
    }
    setPendingDeleteModels([]);
  }, [pendingDeleteModels, toast]);

  /**
   * Parse vocabulary text into array of words
   * Supports comma, newline, and semicolon separators
   */
  const parseVocabularyText = (text: string): string[] => {
    return text
      .split(/[,;\n]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);
  };

  /**
   * Handle saving the custom vocabulary
   */
  const handleSaveVocabulary = useCallback(async () => {
    setIsSavingVocabulary(true);
    try {
      const words = parseVocabularyText(vocabularyText);
      await modelService.setCustomVocabulary(words);
      const message = words.length > 0
        ? `${words.length} mot${words.length > 1 ? 's' : ''} enregistré${words.length > 1 ? 's' : ''}`
        : 'Le vocabulaire a été vidé';
      toast.success(message);
    } catch (error) {
      toast.error('Impossible d\'enregistrer le vocabulaire');
    } finally {
      setIsSavingVocabulary(false);
    }
  }, [vocabularyText, toast]);

  /**
   * Add a suggestion to vocabulary
   */
  const handleAddSuggestion = useCallback(async (suggestion: CorrectionEntry) => {
    // Add to vocabulary text
    const currentWords = parseVocabularyText(vocabularyText);
    if (!currentWords.some(w => w.toLowerCase() === suggestion.suggestedPhrase.toLowerCase())) {
      const newVocabulary = [...currentWords, suggestion.suggestedPhrase];
      const newText = newVocabulary.join(', ');
      setVocabularyText(newText);

      // Save immediately
      await modelService.setCustomVocabulary(newVocabulary);
    }

    // Remove from suggestions
    await CorrectionLearningService.dismissSuggestion(suggestion.id);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

    toast.success(`"${suggestion.suggestedPhrase}" ajouté au vocabulaire`);
  }, [vocabularyText, toast]);

  /**
   * Dismiss a suggestion without adding
   */
  const handleDismissSuggestion = useCallback(async (suggestion: CorrectionEntry) => {
    await CorrectionLearningService.dismissSuggestion(suggestion.id);
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  return (
    <StandardLayout useSafeArea={false}>
      <ScrollView style={[styles.container, { backgroundColor: themeColors.screenBg }]}>
        <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: themeColors.textTertiary }]}>Modèle de transcription</Text>
        <Text style={[styles.headerDescription, { color: themeColors.textSecondary }]}>
          Choisissez le modèle Whisper pour convertir vos enregistrements audio en texte.
          Un modèle plus gros offre une meilleure qualité mais nécessite plus d'espace de stockage.
        </Text>
      </View>

      <WhisperModelCard
        modelSize="tiny"
        isSelected={selectedModel === 'tiny'}
        onUseModel={handleUseModel}
        unusedDays={unusedWhisperModels.find(m => m.modelId === 'tiny')?.daysSinceLastUse}
        onDeleteUnused={() => handleDeleteUnused('tiny')}
        onDismissUnused={() => handleDismissUnused('tiny')}
      />
      <WhisperModelCard
        modelSize="base"
        isSelected={selectedModel === 'base'}
        onUseModel={handleUseModel}
        unusedDays={unusedWhisperModels.find(m => m.modelId === 'base')?.daysSinceLastUse}
        onDeleteUnused={() => handleDeleteUnused('base')}
        onDismissUnused={() => handleDismissUnused('base')}
      />
      <WhisperModelCard
        modelSize="small"
        isSelected={selectedModel === 'small'}
        onUseModel={handleUseModel}
        unusedDays={unusedWhisperModels.find(m => m.modelId === 'small')?.daysSinceLastUse}
        onDeleteUnused={() => handleDeleteUnused('small')}
        onDismissUnused={() => handleDismissUnused('small')}
      />
      <WhisperModelCard
        modelSize="medium"
        isSelected={selectedModel === 'medium'}
        onUseModel={handleUseModel}
        unusedDays={unusedWhisperModels.find(m => m.modelId === 'medium')?.daysSinceLastUse}
        onDeleteUnused={() => handleDeleteUnused('medium')}
        onDismissUnused={() => handleDismissUnused('medium')}
      />
      <WhisperModelCard
        modelSize="large-v3"
        isSelected={selectedModel === 'large-v3'}
        onUseModel={handleUseModel}
        unusedDays={unusedWhisperModels.find(m => m.modelId === 'large-v3')?.daysSinceLastUse}
        onDeleteUnused={() => handleDeleteUnused('large-v3')}
        onDismissUnused={() => handleDismissUnused('large-v3')}
      />

      {/* Suggestions from correction learning */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Suggestions de vocabulaire</Text>
          <Text style={[styles.sectionDescription, { color: themeColors.textSecondary }]}>
            Ces mots ont été détectés lors de vos corrections de transcription.
          </Text>
          {suggestions.map((suggestion) => (
            <View key={suggestion.id} style={[styles.suggestionCard, {
              backgroundColor: themeColors.suggestionBg,
              borderColor: themeColors.suggestionBorder,
            }]}>
              <View style={styles.suggestionContent}>
                <Text style={[styles.suggestionPhrase, { color: themeColors.suggestionText }]}>"{suggestion.suggestedPhrase}"</Text>
                <Text style={[styles.suggestionDetail, { color: themeColors.suggestionDetailText }]}>
                  {suggestion.originalWord} → {suggestion.correctedWord} (corrigé {suggestion.count}x)
                </Text>
              </View>
              <View style={styles.suggestionActions}>
                <TouchableOpacity
                  style={[styles.addButton, { backgroundColor: themeColors.addButtonBg }]}
                  onPress={() => handleAddSuggestion(suggestion)}
                >
                  <Text style={styles.addButtonText}>+ Ajouter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dismissButton, { backgroundColor: themeColors.dismissButtonBg }]}
                  onPress={() => handleDismissSuggestion(suggestion)}
                >
                  <Text style={[styles.dismissButtonText, { color: themeColors.dismissButtonText }]}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.vocabularySection}>
        <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Vocabulaire personnalisé</Text>
        <Text style={[styles.sectionDescription, { color: themeColors.textSecondary }]}>
          Ajoutez les mots que vous utilisez souvent pour améliorer la transcription
          (termes techniques, noms propres, mots anglais...).
        </Text>
        <TextInput
          style={[styles.vocabularyInput, {
            backgroundColor: themeColors.inputBg,
            borderColor: themeColors.inputBorder,
            color: themeColors.inputText,
          }]}
          multiline
          placeholder="workflow, sprint, meeting, feedback, Small, Medium..."
          placeholderTextColor={isDark ? colors.neutral[500] : '#999'}
          value={vocabularyText}
          onChangeText={setVocabularyText}
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: isSavingVocabulary ? themeColors.saveButtonDisabledBg : themeColors.saveButtonBg
            }
          ]}
          onPress={handleSaveVocabulary}
          disabled={isSavingVocabulary}
        >
          <Text style={styles.saveButtonText}>
            {isSavingVocabulary ? 'Enregistrement...' : 'Enregistrer le vocabulaire'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Story 8.3: Audio preprocessing options */}
      <View style={styles.toggleSection}>
        <Text style={[styles.sectionTitle, { color: themeColors.textTertiary }]}>Options audio avancées</Text>
        <View style={[styles.toggleRow, { backgroundColor: isDark ? colors.neutral[800] : '#FFFFFF' }]}>
          <View style={styles.toggleTextContainer}>
            <Text style={[styles.toggleLabel, { color: themeColors.textPrimary }]}>
              Supprimer les silences automatiquement
            </Text>
            <Text style={[styles.toggleDescription, { color: themeColors.textSecondary }]}>
              Réduit la taille des fichiers audio. Peut affecter la complétude des transcriptions.
            </Text>
          </View>
          <Switch
            value={audioTrimEnabled}
            onValueChange={setAudioTrimEnabled}
            trackColor={{
              false: isDark ? colors.neutral[600] : '#767577',
              true: themeColors.saveButtonBg,
            }}
            thumbColor={audioTrimEnabled ? '#ffffff' : (isDark ? colors.neutral[400] : '#f4f3f4')}
            accessibilityLabel="Supprimer les silences automatiquement"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: themeColors.textTertiary }]}>
          Les modèles Whisper sont fournis par OpenAI et exécutés localement sur votre appareil.
          Vos enregistrements ne quittent jamais votre téléphone.
        </Text>
      </View>

      <AlertDialog
        visible={showDeleteOthersDialog}
        onClose={() => {
          setShowDeleteOthersDialog(false);
          setPendingDeleteModels([]);
        }}
        title="Supprimer les autres modèles ?"
        message={deleteDialogMessage}
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: 'Supprimer',
          onPress: confirmDeleteOthers,
        }}
        cancelAction={{
          label: 'Garder',
          onPress: () => {
            setShowDeleteOthersDialog(false);
            setPendingDeleteModels([]);
          },
        }}
      />

      {/* Story 8.8 — Confirmation suppression modèle Whisper inutilisé (AC6) */}
      <AlertDialog
        visible={showDeleteUnusedDialog}
        onClose={() => {
          setShowDeleteUnusedDialog(false);
          setPendingDeleteSize(null);
        }}
        title="Supprimer le modèle ?"
        message={
          pendingDeleteSize
            ? `Supprimer ${whisperModelLabels[pendingDeleteSize]} et libérer l'espace disque ?`
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
            setPendingDeleteSize(null);
          },
        }}
      />
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
  suggestionsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  suggestionCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionContent: {
    flex: 1,
    marginRight: 12,
  },
  suggestionPhrase: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5D4037',
    marginBottom: 4,
  },
  suggestionDetail: {
    fontSize: 12,
    color: '#8D6E63',
  },
  suggestionActions: {
    flexDirection: 'row',
    alignItems: 'center',

  },
  addButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    backgroundColor: '#EFEBE9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dismissButtonText: {
    color: '#8D6E63',
    fontSize: 14,
    fontWeight: '600',
  },
  vocabularySection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  vocabularyInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    color: '#000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#A8A8A8',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    lineHeight: 18,
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
  },
});
