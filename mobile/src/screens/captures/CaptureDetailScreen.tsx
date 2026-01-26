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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Animated } from 'react-native';
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
  Modal,
  FlatList,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { container } from 'tsyringe';
import { TOKENS } from '../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../contexts/capture/domain/ICaptureRepository';
import type { ICaptureMetadataRepository } from '../../contexts/capture/domain/ICaptureMetadataRepository';
import type { ICaptureAnalysisRepository } from '../../contexts/capture/domain/ICaptureAnalysisRepository';
import { METADATA_KEYS } from '../../contexts/capture/domain/CaptureMetadata.model';
import type { Capture } from '../../contexts/capture/domain/Capture.model';
import { CorrectionLearningService } from '../../contexts/Normalization/services/CorrectionLearningService';
import { CaptureAnalysisService } from '../../contexts/Normalization/services/CaptureAnalysisService';
import { TranscriptionQueueService } from '../../contexts/Normalization/services/TranscriptionQueueService';
import { PostProcessingService } from '../../contexts/Normalization/services/PostProcessingService';
import type { CaptureAnalysis, AnalysisType } from '../../contexts/capture/domain/CaptureAnalysis.model';
import { ANALYSIS_TYPES } from '../../contexts/capture/domain/CaptureAnalysis.model';
import { ANALYSIS_LABELS, ANALYSIS_ICONS } from '../../contexts/Normalization/services/analysisPrompts';
import { GoogleCalendarService } from '../../services/GoogleCalendarService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Action item structure from LLM JSON output */
interface ActionItem {
  title: string;
  deadline_text: string | null;
  deadline_date: string | null; // Format: "JJ-MM-AAAA, HH:mm"
  target: string | null;
}

/** Format a deadline date for display */
function formatDeadlineDate(dateStr: string): string {
  // Parse "JJ-MM-AAAA, HH:mm" format
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
  if (!match) {
    return dateStr; // Return as-is if format doesn't match
  }

  const [, day, month, year, hours, minutes] = match;
  const targetDate = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10)
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  const timeStr = `${hours}h${minutes !== '00' ? minutes : ''}`;

  // Check if it's today
  if (targetDay.getTime() === today.getTime()) {
    return `Aujourd'hui à ${timeStr}`;
  }

  // Check if it's tomorrow
  if (targetDay.getTime() === tomorrow.getTime()) {
    return `Demain à ${timeStr}`;
  }

  // Check if it's within the next 7 days
  const diffDays = Math.floor((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays > 0 && diffDays <= 7) {
    const dayName = days[targetDate.getDay()];
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} à ${timeStr}`;
  }

  // Otherwise show full date
  const dayName = days[targetDate.getDay()];
  const monthName = months[targetDate.getMonth()];
  return `${dayName} ${parseInt(day, 10)} ${monthName} à ${timeStr}`;
}

/** Parse action items from LLM JSON output */
function parseActionItems(content: string): ActionItem[] | null {
  try {
    // Try to extract JSON from the content (might have extra text around it)
    const jsonMatch = content.match(/\{[\s\S]*"items"[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.items && Array.isArray(parsed.items)) {
      return parsed.items;
    }
    return null;
  } catch {
    return null;
  }
}

type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string; startAnalysis?: boolean };
};

type Props = NativeStackScreenProps<CapturesStackParamList, 'CaptureDetail'>;

/** Animated checkmark component with fade and scale */
function SavedIndicator({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Fade in + scale up
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Start fade out after 1.5s (total visible ~2s)
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          // Reset scale for next time
          scale.setValue(0.8);
          onHidden();
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible, opacity, scale, onHidden]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.actionItemSaveIndicator,
        { opacity, transform: [{ scale }] },
      ]}
    >
      <Text style={styles.actionItemSavedIcon}>✓</Text>
    </Animated.View>
  );
}

export function CaptureDetailScreen({ route, navigation }: Props) {
  const { captureId, startAnalysis } = route.params;
  const [capture, setCapture] = useState<Capture | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // Analysis state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyses, setAnalyses] = useState<Record<AnalysisType, CaptureAnalysis | null>>({
    [ANALYSIS_TYPES.SUMMARY]: null,
    [ANALYSIS_TYPES.HIGHLIGHTS]: null,
    [ANALYSIS_TYPES.ACTION_ITEMS]: null,
  });
  const [analysisLoading, setAnalysisLoading] = useState<Record<AnalysisType, boolean>>({
    [ANALYSIS_TYPES.SUMMARY]: false,
    [ANALYSIS_TYPES.HIGHLIGHTS]: false,
    [ANALYSIS_TYPES.ACTION_ITEMS]: false,
  });
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Reprocessing state
  const [showReprocess, setShowReprocess] = useState(false);
  const [reprocessing, setReprocessing] = useState<{
    transcribe: boolean;
    postProcess: boolean;
  }>({ transcribe: false, postProcess: false });

  // Action items interactive state
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [localActionItems, setLocalActionItems] = useState<ActionItem[] | null>(null);
  const [savingActionIndex, setSavingActionIndex] = useState<number | null>(null);
  const [savedActionIndex, setSavedActionIndex] = useState<number | null>(null);
  const [addingToCalendarIndex, setAddingToCalendarIndex] = useState<number | null>(null);
  const [addedToCalendarIndex, setAddedToCalendarIndex] = useState<number | null>(null);

  useEffect(() => {
    loadCapture();
  }, [captureId]);

  // Load existing analyses
  useEffect(() => {
    loadAnalyses();
  }, [captureId]);

  // Sync local action items when analyses change
  useEffect(() => {
    if (analyses[ANALYSIS_TYPES.ACTION_ITEMS]) {
      const parsed = parseActionItems(analyses[ANALYSIS_TYPES.ACTION_ITEMS].content);
      setLocalActionItems(parsed);
    }
  }, [analyses[ANALYSIS_TYPES.ACTION_ITEMS]]);

  // Auto-expand analysis section if startAnalysis is true
  // Wait for loading to complete (ensures editedText is set)
  useEffect(() => {
    if (startAnalysis && capture?.state === 'ready' && !loading) {
      setShowAnalysis(true);
    }
  }, [startAnalysis, capture?.state, loading]);

  // Debug: log capture state for analysis section
  useEffect(() => {
    if (capture) {
      console.log('[CaptureDetailScreen] Capture loaded:', {
        id: capture.id,
        state: capture.state,
        hasNormalizedText: !!capture.normalizedText,
        normalizedTextLength: capture.normalizedText?.length || 0,
        editedTextLength: editedText?.length || 0,
        showAnalysis,
      });
    }
  }, [capture, showAnalysis, editedText]);

  const loadAnalyses = async () => {
    try {
      const analysisService = container.resolve(CaptureAnalysisService);
      const existingAnalyses = await analysisService.getAnalyses(captureId);
      setAnalyses(existingAnalyses);
    } catch (error) {
      console.error('[CaptureDetailScreen] Failed to load analyses:', error);
    }
  };

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    console.log('[CaptureDetailScreen] handleGenerateAnalysis called for:', type);
    setAnalysisLoading(prev => ({ ...prev, [type]: true }));
    setAnalysisError(null);

    try {
      const analysisService = container.resolve(CaptureAnalysisService);
      console.log('[CaptureDetailScreen] Calling analysisService.analyze...');
      const result = await analysisService.analyze(captureId, type);
      console.log('[CaptureDetailScreen] Analysis result:', result);

      if (result.success) {
        setAnalyses(prev => ({ ...prev, [type]: result.analysis }));
      } else {
        setAnalysisError(result.error);
        Alert.alert('Erreur', result.error);
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] Analysis failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      setAnalysisError(errorMsg);
      Alert.alert('Erreur', errorMsg);
    } finally {
      setAnalysisLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleAnalyzeAll = async () => {
    console.log('[CaptureDetailScreen] handleAnalyzeAll called');
    // Set all loading states
    setAnalysisLoading({
      [ANALYSIS_TYPES.SUMMARY]: true,
      [ANALYSIS_TYPES.HIGHLIGHTS]: true,
      [ANALYSIS_TYPES.ACTION_ITEMS]: true,
    });
    setAnalysisError(null);

    try {
      const analysisService = container.resolve(CaptureAnalysisService);
      const results = await analysisService.analyzeAll(captureId);

      // Update analyses with successful results
      const newAnalyses: Record<AnalysisType, CaptureAnalysis | null> = {
        [ANALYSIS_TYPES.SUMMARY]: null,
        [ANALYSIS_TYPES.HIGHLIGHTS]: null,
        [ANALYSIS_TYPES.ACTION_ITEMS]: null,
      };

      let hasError = false;
      for (const [type, result] of Object.entries(results)) {
        if (result.success) {
          newAnalyses[type as AnalysisType] = result.analysis;
        } else {
          hasError = true;
          console.error(`[CaptureDetailScreen] Analysis ${type} failed:`, result.error);
        }
      }

      setAnalyses(newAnalyses);

      if (hasError) {
        Alert.alert('Attention', 'Certaines analyses ont echoue. Verifiez les logs.');
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] AnalyzeAll failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      setAnalysisError(errorMsg);
      Alert.alert('Erreur', errorMsg);
    } finally {
      setAnalysisLoading({
        [ANALYSIS_TYPES.SUMMARY]: false,
        [ANALYSIS_TYPES.HIGHLIGHTS]: false,
        [ANALYSIS_TYPES.ACTION_ITEMS]: false,
      });
    }
  };

  const isAnyAnalysisLoading = Object.values(analysisLoading).some(Boolean);

  // Handler to open date picker for an action item
  const handleOpenDatePicker = (index: number, existingDate: string | null) => {
    setEditingActionIndex(index);
    if (existingDate) {
      // Parse "JJ-MM-AAAA, HH:mm" format
      const match = existingDate.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
      if (match) {
        const [, day, month, year, hours, minutes] = match;
        setSelectedDate(new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hours, 10),
          parseInt(minutes, 10)
        ));
      } else {
        setSelectedDate(new Date());
      }
    } else {
      setSelectedDate(new Date());
    }
    setShowDatePicker(true);
  };

  // Save action items to database
  const saveActionItems = async (items: ActionItem[], itemIndex: number) => {
    setSavingActionIndex(itemIndex);
    setSavedActionIndex(null);

    try {
      const analysisRepository = container.resolve<ICaptureAnalysisRepository>(TOKENS.ICaptureAnalysisRepository);
      const content = JSON.stringify({ items });

      // Get existing analysis to preserve modelId and processingDurationMs
      const existingAnalysis = analyses[ANALYSIS_TYPES.ACTION_ITEMS];

      await analysisRepository.save({
        captureId,
        analysisType: ANALYSIS_TYPES.ACTION_ITEMS,
        content,
        modelId: existingAnalysis?.modelId || undefined,
        processingDurationMs: existingAnalysis?.processingDurationMs || undefined,
      });

      // Update local analyses state
      if (existingAnalysis) {
        setAnalyses(prev => ({
          ...prev,
          [ANALYSIS_TYPES.ACTION_ITEMS]: {
            ...existingAnalysis,
            content,
            updatedAt: new Date(),
          },
        }));
      }

      console.log('[CaptureDetailScreen] Action items saved');

      // Show saved indicator (animation handles the timeout)
      setSavingActionIndex(null);
      setSavedActionIndex(itemIndex);
    } catch (error) {
      console.error('[CaptureDetailScreen] Failed to save action items:', error);
      setSavingActionIndex(null);
    }
  };

  // Handler for date confirmation
  const handleDateConfirm = (date: Date) => {
    if (editingActionIndex !== null && localActionItems) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const dateStr = `${day}-${month}-${year}, ${hours}:${minutes}`;

      const updatedItems = [...localActionItems];
      updatedItems[editingActionIndex] = {
        ...updatedItems[editingActionIndex],
        deadline_date: dateStr,
        deadline_text: null, // Clear text when a specific date is set
      };
      setLocalActionItems(updatedItems);
      setSelectedDate(date);

      // Auto-save
      saveActionItems(updatedItems, editingActionIndex);
    }
    setShowDatePicker(false);
    setEditingActionIndex(null);
  };

  // Handler for date picker cancel
  const handleDateCancel = () => {
    setShowDatePicker(false);
    setEditingActionIndex(null);
  };

  // Handler to open contact picker
  const handleOpenContactPicker = async (index: number) => {
    setEditingActionIndex(index);
    setContactSearchQuery('');
    setLoadingContacts(true);
    setShowContactPicker(true);

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'L\'accès aux contacts est nécessaire pour cette fonctionnalité.');
        setShowContactPicker(false);
        setLoadingContacts(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });

      setContacts(data);
    } catch (error) {
      console.error('[CaptureDetailScreen] Failed to load contacts:', error);
      Alert.alert('Erreur', 'Impossible de charger les contacts.');
      setShowContactPicker(false);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Handler for contact selection
  const handleSelectContact = (contact: Contacts.Contact) => {
    if (editingActionIndex !== null && localActionItems) {
      const currentIndex = editingActionIndex;
      const updatedItems = [...localActionItems];
      updatedItems[currentIndex] = {
        ...updatedItems[currentIndex],
        target: contact.name || 'Contact sans nom',
      };
      setLocalActionItems(updatedItems);

      // Auto-save (capture index before clearing)
      saveActionItems(updatedItems, currentIndex);
    }
    setShowContactPicker(false);
    setEditingActionIndex(null);
    setContactSearchQuery('');
  };

  // Filter contacts based on search query
  const filteredContacts = contacts.filter(contact => {
    if (!contactSearchQuery) return true;
    const name = contact.name?.toLowerCase() || '';
    return name.includes(contactSearchQuery.toLowerCase());
  });

  // Handler for adding action item to Google Calendar
  const handleAddToCalendar = async (index: number, item: ActionItem) => {
    if (!item.deadline_date) return;

    // Check if Google is connected
    const isConnected = await GoogleCalendarService.isConnected();

    if (!isConnected) {
      Alert.alert(
        'Google Calendar non connecté',
        'Connectez votre compte Google dans les paramètres pour ajouter des événements à votre calendrier.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Paramètres',
            onPress: () => {
              // Navigate to settings - we can't easily do this from here
              // So just show a message
              Alert.alert('Info', 'Allez dans Paramètres > Intégrations > Google Calendar');
            },
          },
        ]
      );
      return;
    }

    setAddingToCalendarIndex(index);
    setAddedToCalendarIndex(null);

    try {
      // Parse the date from "JJ-MM-AAAA, HH:mm" format
      const match = item.deadline_date.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
      if (!match) {
        Alert.alert('Erreur', 'Format de date invalide');
        setAddingToCalendarIndex(null);
        return;
      }

      const [, day, month, year, hours, minutes] = match;
      const startDate = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10)
      );

      const result = await GoogleCalendarService.createEvent({
        summary: item.title,
        description: item.target ? `Pour: ${item.target}` : undefined,
        startDateTime: startDate,
      });

      if (result.success) {
        setAddingToCalendarIndex(null);
        setAddedToCalendarIndex(index);

        // Clear indicator after 2 seconds
        setTimeout(() => {
          setAddedToCalendarIndex(prev => prev === index ? null : prev);
        }, 2000);
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de créer l\'événement');
        setAddingToCalendarIndex(null);
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] Add to calendar error:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'événement');
      setAddingToCalendarIndex(null);
    }
  };

  // Reprocessing handlers
  const handleReTranscribe = async () => {
    if (!capture || capture.type !== 'audio') return;

    try {
      setReprocessing(prev => ({ ...prev, transcribe: true }));
      console.log('[CaptureDetailScreen] Re-transcribing capture:', captureId);

      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const queueService = container.resolve(TranscriptionQueueService);

      // Reset capture state to trigger re-transcription
      await repository.update(captureId, {
        state: 'captured',
        normalizedText: '',
      });

      // Clear metadata
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(TOKENS.ICaptureMetadataRepository);
      await metadataRepository.delete(captureId, METADATA_KEYS.RAW_TRANSCRIPT);
      await metadataRepository.delete(captureId, METADATA_KEYS.LLM_MODEL);

      // Enqueue for transcription
      await queueService.enqueue({
        captureId,
        audioPath: capture.rawContent,
        audioDuration: capture.duration || undefined,
      });

      Alert.alert('Succès', 'La capture a été remise en queue pour transcription.');

      // Reload capture to see new state
      await loadCapture();
    } catch (error) {
      console.error('[CaptureDetailScreen] Re-transcribe failed:', error);
      Alert.alert('Erreur', 'Impossible de relancer la transcription.');
    } finally {
      setReprocessing(prev => ({ ...prev, transcribe: false }));
    }
  };

  const handleRePostProcess = async () => {
    if (!capture) return;

    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT];
    if (!rawTranscript) {
      Alert.alert('Erreur', 'Pas de transcription brute disponible.');
      return;
    }

    try {
      setReprocessing(prev => ({ ...prev, postProcess: true }));
      console.log('[CaptureDetailScreen] Re-post-processing capture:', captureId);
      console.log('[CaptureDetailScreen] Raw transcript length:', rawTranscript.length);

      const postProcessingService = container.resolve(PostProcessingService);

      // Check if post-processing is enabled
      const isEnabled = await postProcessingService.isEnabled();
      if (!isEnabled) {
        Alert.alert('Erreur', 'Le post-traitement LLM n\'est pas activé dans les paramètres.');
        return;
      }

      // Process the raw transcript
      const processedText = await postProcessingService.process(rawTranscript);

      console.log('[CaptureDetailScreen] Post-processing result:', {
        inputLength: rawTranscript.length,
        outputLength: processedText.length,
        changed: processedText !== rawTranscript,
      });

      // Save to normalizedText
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      await repository.update(captureId, {
        normalizedText: processedText,
      });

      // Update LLM model metadata
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(TOKENS.ICaptureMetadataRepository);
      const llmModelId = postProcessingService.getCurrentModelId();
      if (llmModelId) {
        await metadataRepository.set(captureId, METADATA_KEYS.LLM_MODEL, llmModelId);
      }

      Alert.alert('Succès', `Post-traitement terminé. ${processedText !== rawTranscript ? 'Texte modifié.' : 'Aucune modification.'}`);

      // Reload capture
      await loadCapture();
    } catch (error) {
      console.error('[CaptureDetailScreen] Re-post-process failed:', error);
      Alert.alert('Erreur', `Post-traitement échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setReprocessing(prev => ({ ...prev, postProcess: false }));
    }
  };

  const loadCapture = async () => {
    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const metadataRepository = container.resolve<ICaptureMetadataRepository>(TOKENS.ICaptureMetadataRepository);

      const result = await repository.findById(captureId);
      setCapture(result);

      // Load metadata
      const captureMetadata = await metadataRepository.getAllAsMap(captureId);
      setMetadata(captureMetadata);

      // Initialize edited text with current transcription
      // For audio captures, rawContent is the file path - don't use it as fallback text
      const isAudioCapture = result?.type === 'audio';
      const rawTranscript = captureMetadata[METADATA_KEYS.RAW_TRANSCRIPT] || null;
      const initialText = result?.normalizedText || rawTranscript || (isAudioCapture ? '' : result?.rawContent) || '';
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
    const isAudioCapture = capture?.type === 'audio';
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT] || null;
    const originalText = capture?.normalizedText || rawTranscript || (isAudioCapture ? '' : capture?.rawContent) || '';
    setHasChanges(text !== originalText);
  };

  const handleSave = async () => {
    if (!capture || !hasChanges) return;

    setIsSaving(true);
    Keyboard.dismiss();

    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);

      // Learn from corrections before saving (passive vocabulary learning)
      const isAudioCapture = capture.type === 'audio';
      const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT] || null;
      const originalText = capture.normalizedText || rawTranscript || (isAudioCapture ? '' : capture.rawContent) || '';
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
    const isAudioCapture = capture?.type === 'audio';
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT] || null;
    const originalText = capture?.normalizedText || rawTranscript || (isAudioCapture ? '' : capture?.rawContent) || '';
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
        {metadata[METADATA_KEYS.RAW_TRANSCRIPT] && metadata[METADATA_KEYS.RAW_TRANSCRIPT] !== capture.normalizedText && (
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
                  {metadata[METADATA_KEYS.RAW_TRANSCRIPT]}
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

        {/* Metadata Section */}
        {Object.keys(metadata).length > 0 && (
          <View style={styles.metadataCard}>
            <Pressable
              style={styles.metadataHeader}
              onPress={() => setShowMetadata(!showMetadata)}
            >
              <View style={styles.metadataTitleRow}>
                <Text style={styles.metadataIcon}>📊</Text>
                <Text style={styles.metadataTitle}>Métadonnées de transcription</Text>
              </View>
              <Text style={styles.metadataToggle}>
                {showMetadata ? '▼' : '▶'}
              </Text>
            </Pressable>
            {showMetadata && (
              <View style={styles.metadataContent}>
                {metadata[METADATA_KEYS.WHISPER_MODEL] && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Modèle Whisper</Text>
                    <Text style={styles.metadataValue}>{metadata[METADATA_KEYS.WHISPER_MODEL]}</Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.WHISPER_DURATION_MS] && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Durée traitement Whisper</Text>
                    <Text style={styles.metadataValue}>
                      {Math.round(parseInt(metadata[METADATA_KEYS.WHISPER_DURATION_MS]!) / 1000 * 10) / 10}s
                    </Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.LLM_MODEL] && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Modèle LLM</Text>
                    <Text style={styles.metadataValue}>{metadata[METADATA_KEYS.LLM_MODEL]}</Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.LLM_DURATION_MS] && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Durée traitement LLM</Text>
                    <Text style={styles.metadataValue}>
                      {Math.round(parseInt(metadata[METADATA_KEYS.LLM_DURATION_MS]!) / 1000 * 10) / 10}s
                    </Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.TRANSCRIPT_PROMPT] && (
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Vocabulaire utilisé</Text>
                    <Text style={styles.metadataValue} numberOfLines={2}>
                      {metadata[METADATA_KEYS.TRANSCRIPT_PROMPT]}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Analysis Section - Show for ready captures */}
        {capture.state === 'ready' && (
          <View style={styles.analysisCard}>
            <Pressable
              style={styles.analysisHeader}
              onPress={() => {
                console.log('[CaptureDetailScreen] Analysis header pressed, showAnalysis:', !showAnalysis);
                setShowAnalysis(!showAnalysis);
              }}
            >
              <View style={styles.analysisTitleRow}>
                <Text style={styles.analysisIcon}>🤖</Text>
                <Text style={styles.analysisTitle}>Analyse IA</Text>
              </View>
              <Text style={styles.analysisToggle}>
                {showAnalysis ? '▼' : '▶'}
              </Text>
            </Pressable>
            {showAnalysis && (
              <View style={styles.analysisContent}>
                {/* Show message if no text to analyze */}
                {!editedText ? (
                  <View style={styles.noTextMessage}>
                    <Text style={styles.noTextIcon}>📝</Text>
                    <Text style={styles.noTextTitle}>Pas de texte à analyser</Text>
                    <Text style={styles.noTextSubtitle}>
                      La transcription n'a pas produit de texte. Essayez avec un enregistrement plus long ou plus clair.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Analyze All Button */}
                    <TouchableOpacity
                      style={styles.analyzeAllButton}
                      onPress={handleAnalyzeAll}
                      disabled={isAnyAnalysisLoading}
                    >
                      {isAnyAnalysisLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.analyzeAllButtonText}>🚀 Analyser tout</Text>
                      )}
                    </TouchableOpacity>
                {/* Summary Section */}
                <View style={styles.analysisSection}>
                  <View style={styles.analysisSectionHeader}>
                    <Text style={styles.analysisSectionTitle}>
                      {ANALYSIS_ICONS[ANALYSIS_TYPES.SUMMARY]} {ANALYSIS_LABELS[ANALYSIS_TYPES.SUMMARY]}
                    </Text>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.SUMMARY)}
                      disabled={analysisLoading[ANALYSIS_TYPES.SUMMARY]}
                    >
                      {analysisLoading[ANALYSIS_TYPES.SUMMARY] ? (
                        <ActivityIndicator size="small" color="#9C27B0" />
                      ) : (
                        <Text style={styles.generateButtonText}>
                          {analyses[ANALYSIS_TYPES.SUMMARY] ? '🔄' : 'Generer'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {analyses[ANALYSIS_TYPES.SUMMARY] && (
                    <Text style={styles.analysisResult} selectable>
                      {analyses[ANALYSIS_TYPES.SUMMARY].content}
                    </Text>
                  )}
                </View>

                {/* Highlights Section */}
                <View style={styles.analysisSection}>
                  <View style={styles.analysisSectionHeader}>
                    <Text style={styles.analysisSectionTitle}>
                      {ANALYSIS_ICONS[ANALYSIS_TYPES.HIGHLIGHTS]} {ANALYSIS_LABELS[ANALYSIS_TYPES.HIGHLIGHTS]}
                    </Text>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.HIGHLIGHTS)}
                      disabled={analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS]}
                    >
                      {analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS] ? (
                        <ActivityIndicator size="small" color="#9C27B0" />
                      ) : (
                        <Text style={styles.generateButtonText}>
                          {analyses[ANALYSIS_TYPES.HIGHLIGHTS] ? '🔄' : 'Generer'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {analyses[ANALYSIS_TYPES.HIGHLIGHTS] && (
                    <Text style={styles.analysisResult} selectable>
                      {analyses[ANALYSIS_TYPES.HIGHLIGHTS].content}
                    </Text>
                  )}
                </View>

                {/* Action Items Section */}
                <View style={styles.analysisSection}>
                  <View style={styles.analysisSectionHeader}>
                    <Text style={styles.analysisSectionTitle}>
                      {ANALYSIS_ICONS[ANALYSIS_TYPES.ACTION_ITEMS]} {ANALYSIS_LABELS[ANALYSIS_TYPES.ACTION_ITEMS]}
                    </Text>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.ACTION_ITEMS)}
                      disabled={analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS]}
                    >
                      {analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                        <ActivityIndicator size="small" color="#9C27B0" />
                      ) : (
                        <Text style={styles.generateButtonText}>
                          {analyses[ANALYSIS_TYPES.ACTION_ITEMS] ? '🔄' : 'Generer'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {analyses[ANALYSIS_TYPES.ACTION_ITEMS] && (() => {
                    const actionItems = localActionItems;
                    if (actionItems && actionItems.length > 0) {
                      return (
                        <View style={styles.actionItemsList}>
                          {actionItems.map((item, index) => (
                            <View key={index} style={styles.actionItem}>
                              <View style={styles.actionItemHeader}>
                                <View style={styles.actionItemCheckbox} />
                                <Text style={styles.actionItemTitle} selectable>
                                  {item.title}
                                </Text>
                              </View>
                              {/* Save indicator */}
                              {savingActionIndex === index && (
                                <View style={styles.actionItemSaveIndicator}>
                                  <ActivityIndicator size="small" color="#9C27B0" />
                                </View>
                              )}
                              <SavedIndicator
                                visible={savedActionIndex === index}
                                onHidden={() => setSavedActionIndex(null)}
                              />
                              <View style={styles.actionItemMeta}>
                                {/* Deadline tag - always clickable */}
                                <TouchableOpacity
                                  style={[
                                    styles.actionItemTag,
                                    styles.actionItemTagClickable,
                                    !item.deadline_date && !item.deadline_text && styles.actionItemTagEmpty,
                                  ]}
                                  onPress={() => handleOpenDatePicker(index, item.deadline_date)}
                                >
                                  <Text style={styles.actionItemTagIcon}>📅</Text>
                                  <Text style={[
                                    styles.actionItemTagText,
                                    !item.deadline_date && !item.deadline_text && styles.actionItemTagTextEmpty,
                                  ]}>
                                    {item.deadline_date
                                      ? formatDeadlineDate(item.deadline_date)
                                      : item.deadline_text || 'Ajouter date'}
                                  </Text>
                                </TouchableOpacity>
                                {/* Target tag - always clickable */}
                                <TouchableOpacity
                                  style={[
                                    styles.actionItemTag,
                                    styles.actionItemTagClickable,
                                    !item.target && styles.actionItemTagEmpty,
                                  ]}
                                  onPress={() => handleOpenContactPicker(index)}
                                >
                                  <Text style={styles.actionItemTagIcon}>👤</Text>
                                  <Text style={[
                                    styles.actionItemTagText,
                                    !item.target && styles.actionItemTagTextEmpty,
                                  ]}>
                                    {item.target || 'Ajouter contact'}
                                  </Text>
                                </TouchableOpacity>
                                {/* Add to Calendar button - only when date exists */}
                                {item.deadline_date && (
                                  <TouchableOpacity
                                    style={[
                                      styles.actionItemTag,
                                      styles.actionItemCalendarButton,
                                      addedToCalendarIndex === index && styles.actionItemCalendarButtonDone,
                                    ]}
                                    onPress={() => handleAddToCalendar(index, item)}
                                    disabled={addingToCalendarIndex === index}
                                  >
                                    {addingToCalendarIndex === index ? (
                                      <ActivityIndicator size="small" color="#4285F4" />
                                    ) : addedToCalendarIndex === index ? (
                                      <>
                                        <Text style={styles.actionItemTagIcon}>✓</Text>
                                        <Text style={styles.actionItemCalendarTextDone}>Ajouté</Text>
                                      </>
                                    ) : (
                                      <>
                                        <Text style={styles.actionItemTagIcon}>📆</Text>
                                        <Text style={styles.actionItemCalendarText}>Calendrier</Text>
                                      </>
                                    )}
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    // Fallback to raw text if JSON parsing fails
                    return (
                      <Text style={styles.analysisResult} selectable>
                        {analyses[ANALYSIS_TYPES.ACTION_ITEMS].content}
                      </Text>
                    );
                  })()}
                </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Reprocess Section - Debug tools for audio captures */}
        {isAudio && capture.state === 'ready' && (
          <View style={styles.reprocessCard}>
            <Pressable
              style={styles.reprocessHeader}
              onPress={() => setShowReprocess(!showReprocess)}
            >
              <View style={styles.reprocessTitleRow}>
                <Text style={styles.reprocessIcon}>🔧</Text>
                <Text style={styles.reprocessTitle}>Retraitement</Text>
              </View>
              <Text style={styles.reprocessToggle}>
                {showReprocess ? '▼' : '▶'}
              </Text>
            </Pressable>
            {showReprocess && (
              <View style={styles.reprocessContent}>
                <Text style={styles.reprocessInfo}>
                  Outils de debug pour relancer le pipeline de traitement.
                </Text>

                {/* Status info */}
                <View style={styles.reprocessStatus}>
                  <Text style={styles.reprocessStatusLabel}>État actuel:</Text>
                  <Text style={styles.reprocessStatusValue}>
                    • raw_transcript: {metadata[METADATA_KEYS.RAW_TRANSCRIPT] ? `${metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.length} chars` : '❌ absent'}
                  </Text>
                  <Text style={styles.reprocessStatusValue}>
                    • normalizedText: {capture.normalizedText ? `${capture.normalizedText.length} chars` : '❌ absent'}
                  </Text>
                  <Text style={styles.reprocessStatusValue}>
                    • LLM model: {metadata[METADATA_KEYS.LLM_MODEL] || '❌ non appliqué'}
                  </Text>
                </View>

                {/* Re-transcribe button */}
                <TouchableOpacity
                  style={[styles.reprocessButton, styles.reprocessButtonTranscribe]}
                  onPress={handleReTranscribe}
                  disabled={reprocessing.transcribe}
                >
                  {reprocessing.transcribe ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.reprocessButtonIcon}>🎙️</Text>
                      <View style={styles.reprocessButtonTextContainer}>
                        <Text style={styles.reprocessButtonTitle}>Re-transcrire</Text>
                        <Text style={styles.reprocessButtonDesc}>Relance Whisper sur l'audio</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Re-post-process button */}
                <TouchableOpacity
                  style={[styles.reprocessButton, styles.reprocessButtonPostProcess]}
                  onPress={handleRePostProcess}
                  disabled={reprocessing.postProcess || !metadata[METADATA_KEYS.RAW_TRANSCRIPT]}
                >
                  {reprocessing.postProcess ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.reprocessButtonIcon}>🤖</Text>
                      <View style={styles.reprocessButtonTextContainer}>
                        <Text style={styles.reprocessButtonTitle}>Re-post-traiter</Text>
                        <Text style={styles.reprocessButtonDesc}>
                          {metadata[METADATA_KEYS.RAW_TRANSCRIPT]
                            ? 'Repasse raw_transcript dans le LLM'
                            : 'Nécessite raw_transcript'}
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Info about analysis */}
                <Text style={styles.reprocessNote}>
                  💡 Pour relancer l'analyse IA, utilisez la section "Analyse IA" ci-dessus.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Date Picker Modal - Fonctionne sur iOS et Android */}
      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="datetime"
        date={selectedDate}
        onConfirm={handleDateConfirm}
        onCancel={handleDateCancel}
        locale="fr"
        confirmTextIOS="OK"
        cancelTextIOS="Annuler"
      />

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <Modal
          visible={showContactPicker}
          animationType="slide"
          onRequestClose={() => {
            setShowContactPicker(false);
            setEditingActionIndex(null);
            setContactSearchQuery('');
          }}
        >
        <View style={styles.contactPickerContainer}>
          <View style={styles.contactPickerHeader}>
            <TouchableOpacity
              style={styles.contactPickerCloseButton}
              onPress={() => {
                setShowContactPicker(false);
                setEditingActionIndex(null);
                setContactSearchQuery('');
              }}
            >
              <Text style={styles.contactPickerCloseText}>Fermer</Text>
            </TouchableOpacity>
            <Text style={styles.contactPickerTitle}>Choisir un contact</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.contactSearchContainer}>
            <TextInput
              style={styles.contactSearchInput}
              placeholder="Rechercher..."
              placeholderTextColor="#8E8E93"
              value={contactSearchQuery}
              onChangeText={setContactSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {loadingContacts ? (
            <View style={styles.contactLoadingContainer}>
              <ActivityIndicator size="large" color="#9C27B0" />
              <Text style={styles.contactLoadingText}>Chargement des contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item, index) => (item as { id?: string }).id || `contact-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  onPress={() => handleSelectContact(item)}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {item.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name || 'Sans nom'}</Text>
                    {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                      <Text style={styles.contactPhone}>
                        {item.phoneNumbers[0].number}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.contactEmptyContainer}>
                  <Text style={styles.contactEmptyText}>Aucun contact trouve</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
      )}

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
  metadataCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  metadataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  metadataTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  metadataTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  metadataToggle: {
    fontSize: 12,
    color: '#999',
  },
  metadataContent: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  metadataLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  metadataValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  // Analysis section styles
  analysisCard: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#CE93D8',
    overflow: 'hidden',
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  analysisTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B1FA2',
  },
  analysisToggle: {
    fontSize: 12,
    color: '#9C27B0',
  },
  analysisContent: {
    borderTopWidth: 1,
    borderTopColor: '#CE93D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
  },
  analysisSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  analysisSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  analysisSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  generateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3E5F5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CE93D8',
    minWidth: 70,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#9C27B0',
  },
  analysisResult: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginTop: 4,
  },
  // Action items styles
  actionItemsList: {
    marginTop: 8,
    gap: 10,
  },
  actionItem: {
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  actionItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionItemCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9C27B0',
    marginRight: 12,
  },
  actionItemTitle: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
    fontWeight: '500',
  },
  actionItemMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingLeft: 32,
    gap: 8,
  },
  actionItemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  actionItemTagIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  actionItemTagText: {
    fontSize: 13,
    color: '#7B1FA2',
    fontWeight: '500',
  },
  analyzeAllButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeAllButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  noTextMessage: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noTextIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noTextTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  noTextSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 20,
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
  // Reprocess section styles
  reprocessCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    overflow: 'hidden',
  },
  reprocessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  reprocessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reprocessIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  reprocessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
  },
  reprocessToggle: {
    fontSize: 14,
    color: '#FF9800',
  },
  reprocessContent: {
    borderTopWidth: 1,
    borderTopColor: '#FFE0B2',
    padding: 16,
    backgroundColor: '#FFF8E1',
  },
  reprocessInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  reprocessStatus: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  reprocessStatusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reprocessStatusValue: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  reprocessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  reprocessButtonTranscribe: {
    backgroundColor: '#2196F3',
  },
  reprocessButtonPostProcess: {
    backgroundColor: '#9C27B0',
  },
  reprocessButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  reprocessButtonTextContainer: {
    flex: 1,
  },
  reprocessButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reprocessButtonDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  reprocessNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Action item interactive styles
  actionItemTagClickable: {
    borderWidth: 1,
    borderColor: '#CE93D8',
  },
  actionItemTagEmpty: {
    backgroundColor: '#FAFAFA',
    borderStyle: 'dashed',
    borderColor: '#CE93D8',
  },
  actionItemTagTextEmpty: {
    color: '#9C27B0',
    fontStyle: 'italic',
  },
  actionItemSaveIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  actionItemSavedIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#32CD32', // Lime green
  },
  actionItemCalendarButton: {
    backgroundColor: '#E8F0FE',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  actionItemCalendarButtonDone: {
    backgroundColor: '#E8F5E9',
    borderColor: '#32CD32',
  },
  actionItemCalendarText: {
    fontSize: 13,
    color: '#4285F4',
    fontWeight: '500',
  },
  actionItemCalendarTextDone: {
    fontSize: 13,
    color: '#32CD32',
    fontWeight: '500',
  },
  // Contact Picker styles
  contactPickerContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contactPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contactPickerCloseButton: {
    width: 60,
  },
  contactPickerCloseText: {
    fontSize: 17,
    color: '#9C27B0',
  },
  contactPickerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  contactSearchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  contactSearchInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  contactLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactLoadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#9C27B0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  contactPhone: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  contactEmptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  contactEmptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
