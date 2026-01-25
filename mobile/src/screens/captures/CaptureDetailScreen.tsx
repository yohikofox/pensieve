/**
 * CaptureDetailScreen - Display full capture details
 *
 * Features:
 * - Full transcription text display
 * - Copy to clipboard
 * - Share functionality
 * - Audio playback (future)
 * - Delete capture
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { Capture } from '../../contexts/capture/domain/Capture.model';
import { CorrectionLearningService } from '../../contexts/Normalization/services/CorrectionLearningService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string };
};

type Props = NativeStackScreenProps<CapturesStackParamList, 'CaptureDetail'>;

export function CaptureDetailScreen({ route, navigation }: Props) {
  const { captureId } = route.params;
  const [capture, setCapture] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadCapture();
  }, [captureId]);

  const loadCapture = async () => {
    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const result = await repository.findById(captureId);
      setCapture(result);
      // Initialize edited text with current transcription
      const initialText = result?.normalizedText || result?.rawContent || '';
      setEditedText(initialText);
      setHasChanges(false);
    } catch (error) {
      console.error('[CaptureDetailScreen] Failed to load capture:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setEditedText(text);
    const originalText = capture?.normalizedText || capture?.rawContent || '';
    setHasChanges(text !== originalText);
  };

  const handleSave = async () => {
    if (!capture || !hasChanges) return;

    setIsSaving(true);
    Keyboard.dismiss();

    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);

      // Learn from corrections before saving (passive vocabulary learning)
      const originalText = capture.normalizedText || capture.rawContent || '';
      if (originalText !== editedText) {
        await CorrectionLearningService.learn(originalText, editedText, captureId);
      }

      await repository.update(captureId, {
        normalizedText: editedText,
      });

      // Update local state
      setCapture({ ...capture, normalizedText: editedText });
      setHasChanges(false);

      console.log('[CaptureDetailScreen] Transcript saved successfully');
    } catch (error) {
      console.error('[CaptureDetailScreen] Failed to save transcript:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    const originalText = capture?.normalizedText || capture?.rawContent || '';
    setEditedText(originalText);
    setHasChanges(false);
    Keyboard.dismiss();
  };

  const handleCopy = async () => {
    if (!capture) return;

    // Use edited text (current state) for copy
    await Clipboard.setStringAsync(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!capture) return;

    // Use edited text (current state) for share
    try {
      await Share.share({
        message: editedText,
        title: 'Partager ma pensée',
      });
    } catch (error) {
      console.error('[CaptureDetailScreen] Share failed:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cette capture ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
              await repository.delete(captureId);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer la capture');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}min ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!capture) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>😕</Text>
        <Text style={styles.errorText}>Capture introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAudio = capture.type === 'audio';
  const hasText = editedText.length > 0;
  const isEditable = capture.state === 'ready' || capture.state === 'failed' || capture.type === 'text';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header Info */}
        <View style={styles.headerCard}>
          <View style={styles.typeRow}>
            <Text style={styles.typeIcon}>{isAudio ? '🎙️' : '✏️'}</Text>
            <Text style={styles.typeLabel}>{isAudio ? 'Enregistrement audio' : 'Note texte'}</Text>
          </View>

          <Text style={styles.date}>{formatDate(capture.createdAt)}</Text>

          {isAudio && capture.duration && (
            <Text style={styles.duration}>Durée: {formatDuration(capture.duration)}</Text>
          )}

          {/* Status Badge */}
          <View style={styles.statusRow}>
            {capture.state === 'captured' && (
              <View style={[styles.statusBadge, styles.statusPending]}>
                <Text style={styles.statusText}>⏳ En attente de transcription</Text>
              </View>
            )}
            {capture.state === 'processing' && (
              <View style={[styles.statusBadge, styles.statusProcessing]}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={[styles.statusText, { marginLeft: 8 }]}>Transcription en cours...</Text>
              </View>
            )}
            {capture.state === 'ready' && (
              <View style={[styles.statusBadge, styles.statusReady]}>
                <Text style={styles.statusText}>✅ Transcription terminée</Text>
              </View>
            )}
            {capture.state === 'failed' && (
              <View style={[styles.statusBadge, styles.statusFailed]}>
                <Text style={styles.statusText}>❌ Transcription échouée</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.contentCard}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle}>
              {isAudio ? 'Transcription' : 'Contenu'}
            </Text>
            {hasChanges && (
              <View style={styles.unsavedBadge}>
                <Text style={styles.unsavedText}>Non enregistré</Text>
              </View>
            )}
          </View>

          {isEditable && hasText ? (
            <TextInput
              ref={textInputRef}
              style={styles.contentTextInput}
              value={editedText}
              onChangeText={handleTextChange}
              multiline
              autoCorrect={true}
              spellCheck={true}
              autoCapitalize="sentences"
              keyboardType="default"
              textAlignVertical="top"
              placeholder="Saisissez ou corrigez le texte..."
              placeholderTextColor="#8E8E93"
            />
          ) : hasText ? (
            <Text style={styles.contentText} selectable>
              {editedText}
            </Text>
          ) : (
            <Text style={styles.placeholderText}>
              {capture.state === 'processing'
                ? 'Transcription en cours...'
                : capture.state === 'failed'
                ? 'La transcription a échoué'
                : 'Aucun contenu disponible'}
            </Text>
          )}
        </View>

        {/* Raw Transcript (before LLM) - Show when different from final text */}
        {capture.rawTranscript && capture.rawTranscript !== capture.normalizedText && (
          <View style={styles.rawTranscriptCard}>
            <Pressable
              style={styles.rawTranscriptHeader}
              onPress={() => setShowRawTranscript(!showRawTranscript)}
            >
              <View style={styles.rawTranscriptTitleRow}>
                <Text style={styles.rawTranscriptIcon}>🎙️</Text>
                <Text style={styles.rawTranscriptTitle}>Transcription brute (Whisper)</Text>
              </View>
              <Text style={styles.rawTranscriptToggle}>
                {showRawTranscript ? '▼' : '▶'}
              </Text>
            </Pressable>
            {showRawTranscript && (
              <View style={styles.rawTranscriptContent}>
                <Text style={styles.rawTranscriptText} selectable>
                  {capture.rawTranscript}
                </Text>
                <View style={styles.rawTranscriptBadge}>
                  <Text style={styles.rawTranscriptBadgeText}>
                    ✨ Amélioré par IA
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Transcription Prompt (if used) */}
        {capture.transcriptPrompt && (
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Vocabulaire utilisé</Text>
            <Text style={styles.promptText} selectable>
              {capture.transcriptPrompt}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        {hasChanges ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.discardButton]}
              onPress={handleDiscardChanges}
            >
              <Text style={styles.actionIcon}>↩️</Text>
              <Text style={[styles.actionLabel, styles.discardLabel]}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionIcon}>💾</Text>
              )}
              <Text style={[styles.actionLabel, styles.saveLabel]}>
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {hasText && (
              <>
                <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
                  <Text style={styles.actionIcon}>{copied ? '✅' : '📋'}</Text>
                  <Text style={styles.actionLabel}>{copied ? 'Copié!' : 'Copier'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                  <Text style={styles.actionIcon}>📤</Text>
                  <Text style={styles.actionLabel}>Partager</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionLabel, styles.deleteLabel]}>Supprimer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#8E8E93',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  typeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  date: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  duration: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  statusRow: {
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusProcessing: {
    backgroundColor: '#E3F2FD',
  },
  statusReady: {
    backgroundColor: '#E8F5E9',
  },
  statusFailed: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  unsavedBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unsavedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF9800',
  },
  contentText: {
    fontSize: 17,
    color: '#000',
    lineHeight: 26,
  },
  contentTextInput: {
    fontSize: 17,
    color: '#000',
    lineHeight: 26,
    minHeight: 120,
    padding: 0,
    textAlignVertical: 'top',
  },
  placeholderText: {
    fontSize: 16,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  rawTranscriptCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  rawTranscriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  rawTranscriptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rawTranscriptIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  rawTranscriptTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  rawTranscriptToggle: {
    fontSize: 12,
    color: '#999',
  },
  rawTranscriptContent: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  rawTranscriptText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  rawTranscriptBadge: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  rawTranscriptBadgeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  promptCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  promptTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F57C00',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 20,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteButton: {},
  deleteLabel: {
    color: '#FF3B30',
  },
  discardButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  discardLabel: {
    color: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  saveLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
