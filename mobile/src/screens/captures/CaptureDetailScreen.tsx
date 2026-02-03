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
  Share,
  ActivityIndicator,
  TextInput,
  Keyboard,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Contacts from 'expo-contacts';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { container } from 'tsyringe';
import { colors } from '../../design-system/tokens';
import { AlertDialog, useToast, Button } from '../../design-system/components';
import { useTheme } from '../../hooks/useTheme';
import {
  CaptureIcons,
  StatusIcons,
  ActionIcons,
  NavigationIcons,
  UIIcons,
} from '../../design-system/icons';
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
import { TranscriptionModelService } from '../../contexts/Normalization/services/TranscriptionModelService';
import { TranscriptionEngineService } from '../../contexts/Normalization/services/TranscriptionEngineService';
import type { CaptureAnalysis, AnalysisType } from '../../contexts/capture/domain/CaptureAnalysis.model';
import { ANALYSIS_TYPES } from '../../contexts/capture/domain/CaptureAnalysis.model';
import { ANALYSIS_LABELS, ANALYSIS_ICONS } from '../../contexts/Normalization/services/analysisPrompts';
import { GoogleCalendarService } from '../../services/GoogleCalendarService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { AudioPlayer } from '../../components/audio/AudioPlayer';
import { WaveformPlayer } from '../../components/audio/WaveformPlayer';
import { Waveform } from '../../components/audio/Waveform';
import { TranscriptionSync } from '../../components/audio/TranscriptionSync';

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
  } catch (error) {
    console.error('[parseActionItems] Failed to parse:', error);
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
      <Feather name={StatusIcons.success} size={18} color={colors.success[500]} />
    </Animated.View>
  );
}

// Theme-aware color palette
const getThemeColors = (isDark: boolean) => ({
  // Backgrounds
  screenBg: isDark ? colors.neutral[900] : colors.neutral[100],
  cardBg: isDark ? colors.neutral[800] : colors.neutral[0],
  subtleBg: isDark ? colors.neutral[700] : colors.neutral[50],
  inputBg: isDark ? colors.neutral[800] : colors.neutral[0],
  // Text
  textPrimary: isDark ? colors.neutral[50] : colors.neutral[900],
  textSecondary: isDark ? colors.neutral[400] : colors.neutral[500],
  textTertiary: isDark ? colors.neutral[500] : colors.neutral[400],
  textMuted: isDark ? colors.neutral[500] : '#8E8E93',
  // Borders
  borderDefault: isDark ? colors.neutral[700] : colors.neutral[200],
  borderSubtle: isDark ? colors.neutral[800] : '#E5E5EA',
  // Status backgrounds
  statusPendingBg: isDark ? colors.warning[900] : '#FFF3E0',
  statusProcessingBg: isDark ? colors.info[900] : '#E3F2FD',
  statusReadyBg: isDark ? colors.success[900] : '#E8F5E9',
  statusFailedBg: isDark ? colors.error[900] : '#FFEBEE',
  // Analysis section
  analysisBg: isDark ? '#2A1B35' : '#F3E5F5',
  analysisBorder: isDark ? '#6A4C7D' : '#CE93D8',
  analysisContentBg: isDark ? colors.neutral[800] : '#FAFAFA',
  // Metadata section
  metadataBg: isDark ? colors.neutral[800] : '#F5F5F5',
  metadataBorder: isDark ? colors.neutral[700] : '#E0E0E0',
  metadataContentBg: isDark ? colors.neutral[850] : '#FAFAFA',
  // Actions section
  actionsBg: isDark ? '#1A2F3F' : '#E3F2FD',
  actionsBorder: isDark ? '#2C5F7C' : '#90CAF9',
  actionsContentBg: isDark ? colors.neutral[800] : '#FAFAFA',
  actionsTitle: isDark ? colors.info[300] : colors.info[700],
  actionButtonBg: isDark ? colors.info[700] : colors.info[500],
  actionButtonDisabledBg: isDark ? colors.neutral[700] : colors.neutral[300],
  // Action items
  actionItemBg: isDark ? colors.neutral[800] : '#FAFAFA',
  actionItemBorder: isDark ? colors.neutral[700] : '#E0E0E0',
  actionItemTagBg: isDark ? '#2A1B35' : '#F3E5F5',
  // Reprocess section
  reprocessBg: isDark ? colors.warning[900] : '#FFF3E0',
  reprocessBorder: isDark ? colors.warning[700] : '#FFE0B2',
  reprocessContentBg: isDark ? colors.warning[800] : '#FFF8E1',
  reprocessTitle: isDark ? colors.warning[300] : '#E65100',
  reprocessText: isDark ? colors.neutral[300] : '#666',
  reprocessStatusBg: isDark ? colors.neutral[800] : '#FFFFFF',
  reprocessStatusBorder: isDark ? colors.neutral[700] : '#E0E0E0',
  reprocessStatusLabel: isDark ? colors.neutral[100] : '#333',
  reprocessStatusValue: isDark ? colors.neutral[400] : '#666',
  reprocessStatusError: isDark ? colors.error[400] : '#EF4444',
  reprocessButtonTranscribe: isDark ? '#1565C0' : '#2196F3',
  reprocessButtonPostProcess: isDark ? '#6A1B9A' : '#9C27B0',
  // Contact picker
  contactBg: isDark ? colors.neutral[900] : '#F2F2F7',
  contactHeaderBg: isDark ? colors.neutral[800] : colors.neutral[0],
  contactItemBg: isDark ? colors.neutral[800] : colors.neutral[0],
  contactSearchBg: isDark ? colors.neutral[700] : '#F2F2F7',
});

export function CaptureDetailScreen({ route, navigation }: Props) {
  const { captureId, startAnalysis } = route.params;
  const debugMode = useSettingsStore((state) => state.debugMode);
  const autoTranscriptionEnabled = useSettingsStore((state) => state.autoTranscriptionEnabled);
  const audioPlayerType = useSettingsStore((state) => state.audioPlayerType);
  const { isDark } = useTheme();
  const themeColors = getThemeColors(isDark);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showOriginalContent, setShowOriginalContent] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // Analysis state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyses, setAnalyses] = useState<Record<AnalysisType, CaptureAnalysis | null>>({
    [ANALYSIS_TYPES.SUMMARY]: null,
    [ANALYSIS_TYPES.HIGHLIGHTS]: null,
    [ANALYSIS_TYPES.ACTION_ITEMS]: null,
    [ANALYSIS_TYPES.IDEAS]: null,
  });
  const [analysisLoading, setAnalysisLoading] = useState<Record<AnalysisType, boolean>>({
    [ANALYSIS_TYPES.SUMMARY]: false,
    [ANALYSIS_TYPES.HIGHLIGHTS]: false,
    [ANALYSIS_TYPES.ACTION_ITEMS]: false,
    [ANALYSIS_TYPES.IDEAS]: false,
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

  // Toast and dialog states
  const toast = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);

  // Model availability state (AC4: Story 2.7)
  const [hasModelAvailable, setHasModelAvailable] = useState<boolean | null>(null);

  // Transcription engine state (Story 3.2b - fix for native transcription)
  const [isNativeEngine, setIsNativeEngine] = useState<boolean>(false);

  // Audio player state (Story 3.2b - AC2)
  const [audioPosition, setAudioPosition] = useState(0); // in milliseconds
  const [audioDuration, setAudioDuration] = useState(0); // in milliseconds

  useEffect(() => {
    loadCapture();
  }, [loadCapture]);

  // Poll for updates when capture is in a pending state (captured or processing)
  useEffect(() => {
    // Only poll if capture exists and is in a non-final state
    if (!capture || (capture.state !== 'captured' && capture.state !== 'processing')) {
      return;
    }

    console.log('[CaptureDetailScreen] Starting polling for capture updates, state:', capture.state);

    const pollInterval = setInterval(async () => {
      try {
        const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
        const updatedCapture = await repository.findById(captureId);

        if (updatedCapture && updatedCapture.state !== capture.state) {
          console.log('[CaptureDetailScreen] Capture state changed:', capture.state, '->', updatedCapture.state);
          // State changed, reload everything
          await loadCapture();
        }
      } catch (error) {
        console.error('[CaptureDetailScreen] Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      console.log('[CaptureDetailScreen] Stopping polling');
      clearInterval(pollInterval);
    };
  }, [capture?.state, captureId, loadCapture]);

  // Load existing analyses
  useEffect(() => {
    loadAnalyses();
  }, [captureId]);

  // Check model availability (AC4: Story 2.7)
  useEffect(() => {
    const checkModelAvailability = async () => {
      try {
        const modelService = container.resolve(TranscriptionModelService);
        const bestModel = await modelService.getBestAvailableModel();
        setHasModelAvailable(bestModel !== null);
      } catch (error) {
        console.error('[CaptureDetailScreen] Failed to check model availability:', error);
        setHasModelAvailable(null); // Unknown state
      }
    };
    checkModelAvailability();
  }, []);

  // Check transcription engine type (Story 3.2b - fix for native transcription)
  useEffect(() => {
    const checkEngineType = async () => {
      try {
        const engineService = container.resolve(TranscriptionEngineService);
        const isNative = await engineService.isNativeEngineSelected();
        setIsNativeEngine(isNative);
      } catch (error) {
        console.error('[CaptureDetailScreen] Failed to check engine type:', error);
        setIsNativeEngine(false); // Default to Whisper on error
      }
    };
    checkEngineType();
  }, []);

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

  /**
   * Ensure text is saved to DB before analysis (required for text captures)
   */
  const ensureTextSaved = async () => {
    if (!capture) return;

    // For text captures, always ensure normalizedText is set (even if no changes)
    // This handles old notes created before normalizedText was set automatically
    const needsSave = hasChanges || (capture.type === 'text' && !capture.normalizedText && editedText);
    if (!needsSave) return;

    console.log('[CaptureDetailScreen] Saving text before analysis...', {
      hasChanges,
      isText: capture.type === 'text',
      hasNormalizedText: !!capture.normalizedText,
      hasEditedText: !!editedText,
    });

    const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
    await repository.update(captureId, {
      normalizedText: editedText,
    });

    // Update local state
    setCapture({ ...capture, normalizedText: editedText });
    setHasChanges(false);
  };

  const handleGenerateAnalysis = async (type: AnalysisType) => {
    console.log('[CaptureDetailScreen] handleGenerateAnalysis called for:', type);
    setAnalysisLoading(prev => ({ ...prev, [type]: true }));
    setAnalysisError(null);

    try {
      // Save text to DB if there are unsaved changes (needed for analysis)
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      console.log('[CaptureDetailScreen] Calling analysisService.analyze...');
      const result = await analysisService.analyze(captureId, type);
      console.log('[CaptureDetailScreen] Analysis result:', result);

      if (result.success) {
        setAnalyses(prev => ({ ...prev, [type]: result.analysis }));
      } else {
        setAnalysisError(result.error);
        toast.error(result.error ?? 'Erreur d\'analyse');
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] Analysis failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
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
      [ANALYSIS_TYPES.IDEAS]: true,
    });
    setAnalysisError(null);

    try {
      // Save text to DB if there are unsaved changes (needed for analysis)
      await ensureTextSaved();

      const analysisService = container.resolve(CaptureAnalysisService);
      const results = await analysisService.analyzeAll(captureId);

      // Update analyses with successful results
      const newAnalyses: Record<AnalysisType, CaptureAnalysis | null> = {
        [ANALYSIS_TYPES.SUMMARY]: null,
        [ANALYSIS_TYPES.HIGHLIGHTS]: null,
        [ANALYSIS_TYPES.ACTION_ITEMS]: null,
        [ANALYSIS_TYPES.IDEAS]: null,
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
        toast.warning('Certaines analyses ont échoué. Vérifiez les logs.');
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] AnalyzeAll failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setAnalysisLoading({
        [ANALYSIS_TYPES.SUMMARY]: false,
        [ANALYSIS_TYPES.HIGHLIGHTS]: false,
        [ANALYSIS_TYPES.ACTION_ITEMS]: false,
        [ANALYSIS_TYPES.IDEAS]: false,
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
        toast.warning('L\'accès aux contacts est nécessaire pour cette fonctionnalité');
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
      toast.error('Impossible de charger les contacts');
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
      setShowCalendarDialog(true);
      return;
    }

    setAddingToCalendarIndex(index);
    setAddedToCalendarIndex(null);

    try {
      // Parse the date from "JJ-MM-AAAA, HH:mm" format
      const match = item.deadline_date.match(/^(\d{2})-(\d{2})-(\d{4}),?\s*(\d{2}):(\d{2})$/);
      if (!match) {
        toast.error('Format de date invalide');
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
        toast.error(result.error || 'Impossible de créer l\'événement');
        setAddingToCalendarIndex(null);
      }
    } catch (error) {
      console.error('[CaptureDetailScreen] Add to calendar error:', error);
      toast.error('Impossible de créer l\'événement');
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

      toast.success('La capture a été remise en queue pour transcription');

      // Reload capture to see new state
      await loadCapture();
    } catch (error) {
      console.error('[CaptureDetailScreen] Re-transcribe failed:', error);
      toast.error('Impossible de relancer la transcription');
    } finally {
      setReprocessing(prev => ({ ...prev, transcribe: false }));
    }
  };

  const handleRePostProcess = async () => {
    if (!capture) return;

    // For audio captures, use raw_transcript; for text captures, use editedText
    const isTextCapture = capture.type === 'text';
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
    const sourceText = isTextCapture ? editedText : rawTranscript;

    if (!sourceText) {
      toast.error(isTextCapture ? 'Pas de texte à traiter' : 'Pas de transcription brute disponible');
      return;
    }

    try {
      // Save text to DB for text captures before processing
      if (isTextCapture) {
        await ensureTextSaved();
      }

      setReprocessing(prev => ({ ...prev, postProcess: true }));
      console.log('[CaptureDetailScreen] Post-processing capture:', captureId);
      console.log('[CaptureDetailScreen] Source text length:', sourceText.length);

      const postProcessingService = container.resolve(PostProcessingService);

      // Check if post-processing is enabled
      const isEnabled = await postProcessingService.isEnabled();
      if (!isEnabled) {
        toast.error('Le post-traitement LLM n\'est pas activé dans les paramètres');
        return;
      }

      // Process the text
      const processedText = await postProcessingService.process(sourceText);

      console.log('[CaptureDetailScreen] Post-processing result:', {
        inputLength: sourceText.length,
        outputLength: processedText.length,
        changed: processedText !== sourceText,
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

      toast.success(`Post-traitement terminé. ${processedText !== sourceText ? 'Texte modifié.' : 'Aucune modification.'}`);

      // Reload capture
      await loadCapture();
    } catch (error) {
      console.error('[CaptureDetailScreen] Re-post-process failed:', error);
      toast.error(`Post-traitement échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setReprocessing(prev => ({ ...prev, postProcess: false }));
    }
  };

  const loadCapture = useCallback(async () => {
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
  }, [captureId]);

  // Audio player callbacks (Story 3.2b - AC2)
  const handleAudioPositionChange = useCallback((positionMs: number) => {
    setAudioPosition(positionMs);
  }, []);

  const handleAudioSeek = useCallback((positionMs: number) => {
    setAudioPosition(positionMs);
  }, []);

  const handleTextChange = (text: string) => {
    setEditedText(text);
    const isAudioCapture = capture?.type === 'audio';
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
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
      const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
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
      toast.error('Impossible de sauvegarder les modifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    const isAudioCapture = capture?.type === 'audio';
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
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
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setShowDeleteDialog(false);
    try {
      const repository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      await repository.delete(captureId);
      navigation.goBack();
    } catch (error) {
      toast.error('Impossible de supprimer la capture');
    }
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
      <View style={[styles.loadingContainer, { backgroundColor: themeColors.screenBg }]}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!capture) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: themeColors.screenBg }]}>
        <Feather name={StatusIcons.error} size={48} color={themeColors.textTertiary} />
        <Text style={[styles.errorText, { color: themeColors.textMuted }]}>Capture introuvable</Text>
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
    <View style={[styles.container, { backgroundColor: themeColors.screenBg }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header Info */}
        <View style={[styles.headerCard, { backgroundColor: themeColors.cardBg }]}>
          <View style={styles.typeRow}>
            <View style={[styles.typeIconContainer, { backgroundColor: isDark ? (isAudio ? colors.primary[900] : colors.secondary[900]) : (isAudio ? colors.primary[100] : colors.secondary[100]) }]}>
              <Feather
                name={isAudio ? CaptureIcons.voice : ActionIcons.edit}
                size={20}
                color={isAudio ? colors.primary[500] : colors.secondary[500]}
              />
            </View>
            <Text style={[styles.typeLabel, { color: themeColors.textPrimary }]}>{isAudio ? 'Enregistrement audio' : 'Note texte'}</Text>
          </View>

          <Text style={[styles.date, { color: themeColors.textMuted }]}>{formatDate(capture.createdAt)}</Text>

          {isAudio && capture.duration && (
            <Text style={[styles.duration, { color: themeColors.textMuted }]}>Durée: {formatDuration(capture.duration)}</Text>
          )}

          {/* Status Badge - Only for audio captures */}
          {isAudio && (
            <View style={styles.statusRow}>
              {/* AC4: Show "Model required" badge when no model available (Story 2.7) */}
              {capture.state === 'captured' && hasModelAvailable === false && !capture.normalizedText && (
                <View style={[styles.statusBadge, { backgroundColor: isDark ? colors.error[900] : colors.error[50] }]}>
                  <Feather name="alert-circle" size={14} color={isDark ? colors.error[400] : colors.error[700]} />
                  <Text style={[styles.statusText, { marginLeft: 6, color: isDark ? colors.error[300] : colors.error[700] }]}>
                    Modèle de transcription requis
                  </Text>
                </View>
              )}
              {/* Show normal "waiting" status when model is available OR model status unknown */}
              {capture.state === 'captured' && (hasModelAvailable === true || hasModelAvailable === null || capture.normalizedText) && (
                <View style={[styles.statusBadge, { backgroundColor: themeColors.statusPendingBg }]}>
                  <Feather name={StatusIcons.pending} size={14} color={isDark ? colors.warning[400] : colors.warning[700]} />
                  <Text style={[styles.statusText, { marginLeft: 6, color: isDark ? colors.warning[300] : colors.warning[700] }]}>
                    {autoTranscriptionEnabled ? 'En attente de transcription' : 'Transcription manuelle'}
                  </Text>
                </View>
              )}
              {capture.state === 'processing' && (
                <View style={[styles.statusBadge, { backgroundColor: themeColors.statusProcessingBg }]}>
                  <ActivityIndicator size="small" color={isDark ? colors.info[400] : colors.info[600]} />
                  <Text style={[styles.statusText, { marginLeft: 8, color: isDark ? colors.info[300] : colors.info[700] }]}>Transcription en cours...</Text>
                </View>
              )}
              {capture.state === 'ready' && (
                <View style={[styles.statusBadge, { backgroundColor: themeColors.statusReadyBg }]}>
                  <Feather name={StatusIcons.success} size={14} color={isDark ? colors.success[400] : colors.success[700]} />
                  <Text style={[styles.statusText, { marginLeft: 6, color: isDark ? colors.success[300] : colors.success[700] }]}>Transcription terminée</Text>
                </View>
              )}
              {capture.state === 'failed' && (
                <View style={[styles.statusBadge, { backgroundColor: themeColors.statusFailedBg }]}>
                  <Feather name={StatusIcons.error} size={14} color={isDark ? colors.error[400] : colors.error[700]} />
                  <Text style={[styles.statusText, { marginLeft: 6, color: isDark ? colors.error[300] : colors.error[700] }]}>Transcription échouée</Text>
                </View>
              )}
            </View>
          )}

          {/* AC5: Configure Model button (when no model available AND Whisper engine selected) - Story 2.7 */}
          {isAudio && capture.state === 'captured' && !isNativeEngine && hasModelAvailable === false && !capture.normalizedText && (
            <View style={{ marginTop: 16, paddingHorizontal: 20 }}>
              <Button
                variant="secondary"
                size="md"
                onPress={() => {
                  navigation.navigate('WhisperSettings' as never);
                }}
              >
                <Feather name="download" size={18} color={isDark ? colors.neutral[100] : colors.neutral[700]} style={{ marginRight: 8 }} />
                Télécharger un modèle
              </Button>
            </View>
          )}

          {/* Manual transcription button (Story 3.2b - Native or Whisper) */}
          {isAudio && capture.state === 'captured' && !capture.normalizedText && (
            // Show if: native engine selected OR (whisper engine + auto-transcription disabled + model available)
            (isNativeEngine || (!autoTranscriptionEnabled && hasModelAvailable === true)) && (
            <View style={{ marginTop: 16, paddingHorizontal: 20 }}>
              <Button
                variant="primary"
                size="md"
                onPress={async () => {
                  try {
                    const queueService = container.resolve(TranscriptionQueueService);
                    await queueService.enqueue({
                      captureId: capture.id,
                      audioPath: capture.rawContent || '',
                      audioDuration: capture.duration,
                    });
                    toast.success('Transcription lancée');
                  } catch (error) {
                    console.error('[CaptureDetail] Failed to enqueue:', error);
                    toast.error('Échec du lancement de la transcription');
                  }
                }}
              >
                <Feather name="file-text" size={18} color={colors.neutral[0]} style={{ marginRight: 8 }} />
                Transcrire maintenant
              </Button>
            </View>
            )
          )}
        </View>

        {/* Audio Player (Story 3.2b - AC2) - User can choose player type in Settings */}
        {isAudio && capture.rawContent && (
          <View style={[styles.audioCard, { backgroundColor: themeColors.cardBg }]}>
            {audioPlayerType === 'waveform' ? (
              <WaveformPlayer
                audioUri={capture.rawContent}
                captureId={capture.id}
                metadata={metadata}
                onPositionChange={handleAudioPositionChange}
                onPlaybackEnd={() => setAudioPosition(0)}
              />
            ) : (
              <AudioPlayer
                audioUri={capture.rawContent}
                onPositionChange={handleAudioPositionChange}
                onPlaybackEnd={() => setAudioPosition(0)}
              />
            )}
          </View>
        )}

        {/* Content */}
        <View style={[styles.contentCard, { backgroundColor: themeColors.cardBg }]}>
          {(() => {
            // Check if content has been AI-enhanced
            const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
            const originalText = isAudio ? rawTranscript : capture?.rawContent;
            const hasBeenEnhanced = !!originalText && capture?.normalizedText && originalText !== capture.normalizedText;

            // Determine which text to display
            const displayText = showOriginalContent && hasBeenEnhanced ? originalText : editedText;

            return (
              <>
                <View style={styles.contentHeader}>
                  <View style={styles.contentTitleRow}>
                    <Text style={[styles.contentTitle, { color: themeColors.textMuted }]}>
                      {isAudio ? 'TRANSCRIPTION' : 'CONTENU'}
                    </Text>
                    {hasBeenEnhanced && (
                      <View style={[styles.aiEnhancedBadge, { backgroundColor: isDark ? colors.success[900] : '#E8F5E9' }]}>
                        <Feather name="zap" size={10} color={isDark ? colors.success[400] : colors.success[600]} />
                        <Text style={[styles.aiEnhancedBadgeText, { color: isDark ? colors.success[400] : colors.success[600] }]}>
                          Amélioré par IA
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.contentHeaderActions}>
                    {hasBeenEnhanced && (
                      <TouchableOpacity
                        style={[styles.toggleVersionButton, { backgroundColor: isDark ? colors.neutral[700] : '#F2F2F7' }]}
                        onPress={() => setShowOriginalContent(!showOriginalContent)}
                      >
                        <Feather
                          name={showOriginalContent ? "eye" : "eye-off"}
                          size={14}
                          color={isDark ? colors.neutral[300] : colors.neutral[600]}
                        />
                        <Text style={[styles.toggleVersionText, { color: isDark ? colors.neutral[300] : colors.neutral[600] }]}>
                          {showOriginalContent ? 'Version IA' : 'Original'}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {hasChanges && (
                      <View style={styles.unsavedBadge}>
                        <Text style={styles.unsavedText}>Non enregistré</Text>
                      </View>
                    )}
                  </View>
                </View>

                {isEditable && hasText && !showOriginalContent ? (
                  <TextInput
                    ref={textInputRef}
                    style={[styles.contentTextInput, { color: themeColors.textPrimary }]}
                    value={displayText}
                    onChangeText={handleTextChange}
                    multiline
                    autoCorrect={true}
                    spellCheck={true}
                    autoCapitalize="sentences"
                    keyboardType="default"
                    textAlignVertical="top"
                    placeholder="Saisissez ou corrigez le texte..."
                    placeholderTextColor={themeColors.textMuted}
                  />
                ) : hasText || (showOriginalContent && originalText) ? (
                  // Story 3.2b - AC2: Use TranscriptionSync for audio captures with text available
                  isAudio && capture.rawContent ? (
                    <TranscriptionSync
                      transcription={displayText}
                      currentPosition={audioPosition}
                      duration={audioDuration || capture.duration || 0}
                      onSeek={handleAudioSeek}
                    />
                  ) : (
                    <Text style={[styles.contentText, { color: showOriginalContent ? themeColors.textSecondary : themeColors.textPrimary }]} selectable>
                      {displayText}
                    </Text>
                  )
                ) : (
                  <Text style={[styles.placeholderText, { color: themeColors.textMuted }]}>
                    {capture.state === 'processing'
                      ? 'Transcription en cours...'
                      : capture.state === 'failed'
                      ? 'La transcription a échoué'
                      : capture.state === 'ready' && isAudio
                      ? 'Aucun audio détecté dans l\'enregistrement'
                      : 'Aucun contenu disponible'}
                  </Text>
                )}
              </>
            );
          })()}
        </View>

        {/* Raw Transcript (before LLM) - Show when different from final text */}
        {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value && metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value !== capture.normalizedText && (
          <View style={[styles.rawTranscriptCard, { backgroundColor: themeColors.metadataBg, borderColor: themeColors.metadataBorder }]}>
            <Pressable
              style={styles.rawTranscriptHeader}
              onPress={() => setShowRawTranscript(!showRawTranscript)}
            >
              <View style={styles.rawTranscriptTitleRow}>
                <Feather name={CaptureIcons.voice} size={16} color={themeColors.textSecondary} />
                <Text style={[styles.rawTranscriptTitle, { color: themeColors.textSecondary }]}>Transcription brute (Whisper)</Text>
              </View>
              <Feather
                name={showRawTranscript ? NavigationIcons.down : NavigationIcons.forward}
                size={16}
                color={themeColors.textTertiary}
              />
            </Pressable>
            {showRawTranscript && (
              <View style={[styles.rawTranscriptContent, { backgroundColor: themeColors.metadataContentBg, borderTopColor: themeColors.metadataBorder }]}>
                <Text style={[styles.rawTranscriptText, { color: themeColors.textSecondary }]} selectable>
                  {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value}
                </Text>
                <View style={[styles.rawTranscriptBadge, { backgroundColor: isDark ? colors.success[900] : '#E8F5E9' }]}>
                  <Feather name="zap" size={12} color={isDark ? colors.success[400] : colors.success[600]} />
                  <Text style={[styles.rawTranscriptBadgeText, { color: isDark ? colors.success[400] : colors.success[600] }]}>Amélioré par IA</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Metadata Section */}
        {Object.keys(metadata).length > 0 && (
          <View style={[styles.metadataCard, { backgroundColor: themeColors.metadataBg, borderColor: themeColors.metadataBorder }]}>
            <Pressable
              style={styles.metadataHeader}
              onPress={() => setShowMetadata(!showMetadata)}
            >
              <View style={styles.metadataTitleRow}>
                <Feather name="info" size={16} color={themeColors.textSecondary} />
                <Text style={[styles.metadataTitle, { color: themeColors.textSecondary }]}>Métadonnées de transcription</Text>
              </View>
              <Feather
                name={showMetadata ? NavigationIcons.down : NavigationIcons.forward}
                size={16}
                color={themeColors.textTertiary}
              />
            </Pressable>
            {showMetadata && (
              <View style={[styles.metadataContent, { backgroundColor: themeColors.metadataContentBg, borderTopColor: themeColors.metadataBorder }]}>
                {metadata[METADATA_KEYS.WHISPER_MODEL]?.value && (
                  <View style={[styles.metadataRow, { borderBottomColor: themeColors.borderDefault }]}>
                    <Text style={[styles.metadataLabel, { color: themeColors.textSecondary }]}>Moteur de transcription</Text>
                    <Text style={[styles.metadataValue, { color: themeColors.textPrimary }]}>{metadata[METADATA_KEYS.WHISPER_MODEL]?.value}</Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.WHISPER_DURATION_MS]?.value && (
                  <View style={[styles.metadataRow, { borderBottomColor: themeColors.borderDefault }]}>
                    <Text style={[styles.metadataLabel, { color: themeColors.textSecondary }]}>Durée de transcription</Text>
                    <Text style={[styles.metadataValue, { color: themeColors.textPrimary }]}>
                      {Math.round(parseInt(metadata[METADATA_KEYS.WHISPER_DURATION_MS]?.value!) / 1000 * 10) / 10}s
                    </Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.LLM_MODEL]?.value && (
                  <View style={[styles.metadataRow, { borderBottomColor: themeColors.borderDefault }]}>
                    <Text style={[styles.metadataLabel, { color: themeColors.textSecondary }]}>Modèle LLM</Text>
                    <Text style={[styles.metadataValue, { color: themeColors.textPrimary }]}>{metadata[METADATA_KEYS.LLM_MODEL]?.value}</Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.LLM_DURATION_MS]?.value && (
                  <View style={[styles.metadataRow, { borderBottomColor: themeColors.borderDefault }]}>
                    <Text style={[styles.metadataLabel, { color: themeColors.textSecondary }]}>Durée traitement LLM</Text>
                    <Text style={[styles.metadataValue, { color: themeColors.textPrimary }]}>
                      {Math.round(parseInt(metadata[METADATA_KEYS.LLM_DURATION_MS]?.value!) / 1000 * 10) / 10}s
                    </Text>
                  </View>
                )}
                {metadata[METADATA_KEYS.TRANSCRIPT_PROMPT]?.value && (
                  <View style={[styles.metadataRow, { borderBottomColor: themeColors.borderDefault }]}>
                    <Text style={[styles.metadataLabel, { color: themeColors.textSecondary }]}>Vocabulaire utilisé</Text>
                    <Text style={[styles.metadataValue, { color: themeColors.textPrimary }]} numberOfLines={2}>
                      {metadata[METADATA_KEYS.TRANSCRIPT_PROMPT]?.value}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Actions Section - Quick actions for captures */}
        {(() => {
          const isAudioCapture = capture.type === 'audio';
          const isTextCapture = capture.type === 'text';
          const hasRawTranscript = !!metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
          const hasBeenPostProcessed = !!metadata[METADATA_KEYS.LLM_MODEL]?.value;
          const canPostProcess = (isAudioCapture && hasRawTranscript) || (isTextCapture && editedText);
          const showPostProcessButton = canPostProcess && (!hasBeenPostProcessed || debugMode);
          const showReTranscribeButton = isAudioCapture && debugMode;

          // Only show section if there are actions available
          if (!showPostProcessButton && !showReTranscribeButton) return null;

          return (
            <View style={[styles.actionsCard, { backgroundColor: themeColors.actionsBg, borderColor: themeColors.actionsBorder }]}>
              <View style={styles.actionsHeader}>
                <View style={styles.actionsTitleRow}>
                  <Feather name="zap" size={16} color={isDark ? colors.info[400] : colors.info[700]} />
                  <Text style={[styles.actionsTitle, { color: themeColors.actionsTitle }]}>Actions rapides</Text>
                </View>
              </View>

              <View style={[styles.actionsContent, { backgroundColor: themeColors.actionsContentBg }]}>
                {/* Post-processing action */}
                {showPostProcessButton && (
                  <TouchableOpacity
                    style={[styles.quickActionButton, { backgroundColor: themeColors.actionButtonBg }]}
                    onPress={handleRePostProcess}
                    disabled={reprocessing.postProcess}
                  >
                    {reprocessing.postProcess ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <View style={styles.actionButtonTextContainer}>
                          <Text style={styles.actionButtonTitle}>Traitement en cours...</Text>
                          <Text style={styles.actionButtonDesc}>Le LLM analyse le texte</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Feather name="cpu" size={20} color={colors.neutral[0]} />
                        <View style={styles.actionButtonTextContainer}>
                          <Text style={styles.actionButtonTitle}>
                            {hasBeenPostProcessed ? 'Re-post-traiter' : 'Post-traitement LLM'}
                          </Text>
                          <Text style={styles.actionButtonDesc}>
                            {isTextCapture
                              ? 'Améliorer le texte avec l\'IA'
                              : 'Améliorer la transcription avec l\'IA'
                            }
                          </Text>
                        </View>
                        {hasBeenPostProcessed && debugMode && (
                          <View style={styles.debugBadge}>
                            <Text style={styles.debugBadgeText}>DEBUG</Text>
                          </View>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Re-transcribe action (audio only, debug only) */}
                {showReTranscribeButton && (
                  <TouchableOpacity
                    style={[styles.quickActionButton, { backgroundColor: themeColors.reprocessButtonTranscribe, marginTop: 12 }]}
                    onPress={handleReTranscribe}
                    disabled={reprocessing.transcribe}
                  >
                    {reprocessing.transcribe ? (
                      <>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <View style={styles.actionButtonTextContainer}>
                          <Text style={styles.actionButtonTitle}>Transcription en cours...</Text>
                          <Text style={styles.actionButtonDesc}>Whisper analyse l'audio</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Feather name={CaptureIcons.voice} size={20} color={colors.neutral[0]} />
                        <View style={styles.actionButtonTextContainer}>
                          <Text style={styles.actionButtonTitle}>Re-transcrire</Text>
                          <Text style={styles.actionButtonDesc}>Relancer Whisper sur l'audio</Text>
                        </View>
                        <View style={styles.debugBadge}>
                          <Text style={styles.debugBadgeText}>DEBUG</Text>
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {/* Analysis Section - Show for ready audio captures AND all text notes with content */}
        {(capture.state === 'ready' || (capture.type === 'text' && editedText)) && (
          <View style={[styles.analysisCard, { backgroundColor: themeColors.analysisBg, borderColor: themeColors.analysisBorder }]}>
            <Pressable
              style={styles.analysisHeader}
              onPress={() => {
                console.log('[CaptureDetailScreen] Analysis header pressed, showAnalysis:', !showAnalysis);
                setShowAnalysis(!showAnalysis);
              }}
            >
              <View style={styles.analysisTitleRow}>
                <Feather name="cpu" size={16} color={isDark ? colors.primary[400] : colors.primary[700]} />
                <Text style={[styles.analysisTitle, { color: isDark ? colors.primary[300] : colors.primary[700] }]}>Analyse IA</Text>
              </View>
              <Feather
                name={showAnalysis ? NavigationIcons.down : NavigationIcons.forward}
                size={16}
                color={isDark ? colors.primary[400] : colors.primary[600]}
              />
            </Pressable>
            {showAnalysis && (
              <View style={[styles.analysisContent, { backgroundColor: themeColors.analysisContentBg, borderTopColor: themeColors.analysisBorder }]}>
                {/* Show message if no text to analyze */}
                {!editedText ? (
                  <View style={styles.noTextMessage}>
                    <Feather name="file-text" size={32} color={themeColors.textTertiary} />
                    <Text style={[styles.noTextTitle, { color: themeColors.textSecondary }]}>Pas de texte à analyser</Text>
                    <Text style={[styles.noTextSubtitle, { color: themeColors.textTertiary }]}>
                      La transcription n'a pas produit de texte. Essayez avec un enregistrement plus long ou plus clair.
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Analyze All Button - Show if not all generated, or in debug mode for regeneration */}
                    {(() => {
                      const allGenerated = analyses[ANALYSIS_TYPES.SUMMARY] &&
                        analyses[ANALYSIS_TYPES.HIGHLIGHTS] &&
                        analyses[ANALYSIS_TYPES.ACTION_ITEMS] &&
                        analyses[ANALYSIS_TYPES.IDEAS];
                      if (!allGenerated || debugMode) {
                        return (
                          <TouchableOpacity
                            style={styles.analyzeAllButton}
                            onPress={handleAnalyzeAll}
                            disabled={isAnyAnalysisLoading}
                          >
                            {isAnyAnalysisLoading ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <View style={styles.analyzeAllContent}>
                                <Feather name="zap" size={16} color={colors.neutral[0]} />
                                <Text style={styles.analyzeAllButtonText}>
                                  {allGenerated ? 'Tout réanalyser' : 'Analyser'}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      }
                      return null;
                    })()}
                {/* Summary Section */}
                <View style={[styles.analysisSection, { borderBottomColor: themeColors.borderDefault }]}>
                  <View style={styles.analysisSectionHeader}>
                    <View style={styles.analysisSectionTitleRow}>
                      <Feather name="file-text" size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                      <Text style={[styles.analysisSectionTitle, { color: themeColors.textPrimary }]}>{ANALYSIS_LABELS[ANALYSIS_TYPES.SUMMARY]}</Text>
                    </View>
                    {/* Show button: loading, or no data, or debug mode for regeneration */}
                    {(analysisLoading[ANALYSIS_TYPES.SUMMARY] || !analyses[ANALYSIS_TYPES.SUMMARY] || debugMode) && (
                      <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder }]}
                        onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.SUMMARY)}
                        disabled={analysisLoading[ANALYSIS_TYPES.SUMMARY]}
                      >
                        {analysisLoading[ANALYSIS_TYPES.SUMMARY] ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : analyses[ANALYSIS_TYPES.SUMMARY] ? (
                          <Feather name={ActionIcons.refresh} size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                        ) : (
                          <Text style={[styles.generateButtonText, { color: isDark ? colors.primary[400] : colors.primary[600] }]}>Générer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {analyses[ANALYSIS_TYPES.SUMMARY] && (
                    <Text style={[styles.analysisResult, { color: themeColors.textPrimary }]} selectable>
                      {analyses[ANALYSIS_TYPES.SUMMARY].content}
                    </Text>
                  )}
                </View>

                {/* Highlights Section */}
                <View style={[styles.analysisSection, { borderBottomColor: themeColors.borderDefault }]}>
                  <View style={styles.analysisSectionHeader}>
                    <View style={styles.analysisSectionTitleRow}>
                      <Feather name="star" size={16} color={colors.warning[500]} />
                      <Text style={[styles.analysisSectionTitle, { color: themeColors.textPrimary }]}>{ANALYSIS_LABELS[ANALYSIS_TYPES.HIGHLIGHTS]}</Text>
                    </View>
                    {/* Show button: loading, or no data, or debug mode for regeneration */}
                    {(analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS] || !analyses[ANALYSIS_TYPES.HIGHLIGHTS] || debugMode) && (
                      <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder }]}
                        onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.HIGHLIGHTS)}
                        disabled={analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS]}
                      >
                        {analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS] ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : analyses[ANALYSIS_TYPES.HIGHLIGHTS] ? (
                          <Feather name={ActionIcons.refresh} size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                        ) : (
                          <Text style={[styles.generateButtonText, { color: isDark ? colors.primary[400] : colors.primary[600] }]}>Générer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {analyses[ANALYSIS_TYPES.HIGHLIGHTS] && (
                    <Text style={[styles.analysisResult, { color: themeColors.textPrimary }]} selectable>
                      {analyses[ANALYSIS_TYPES.HIGHLIGHTS].content}
                    </Text>
                  )}
                </View>

                {/* Action Items Section */}
                <View style={[styles.analysisSection, { borderBottomColor: themeColors.borderDefault }]}>
                  <View style={styles.analysisSectionHeader}>
                    <View style={styles.analysisSectionTitleRow}>
                      <Feather name="check-square" size={16} color={colors.success[500]} />
                      <Text style={[styles.analysisSectionTitle, { color: themeColors.textPrimary }]}>{ANALYSIS_LABELS[ANALYSIS_TYPES.ACTION_ITEMS]}</Text>
                    </View>
                    {/* Show button: loading, or no data, or debug mode for regeneration */}
                    {(analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] || !analyses[ANALYSIS_TYPES.ACTION_ITEMS] || debugMode) && (
                      <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder }]}
                        onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.ACTION_ITEMS)}
                        disabled={analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS]}
                      >
                        {analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : analyses[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                          <Feather name={ActionIcons.refresh} size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                        ) : (
                          <Text style={[styles.generateButtonText, { color: isDark ? colors.primary[400] : colors.primary[600] }]}>Générer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {analyses[ANALYSIS_TYPES.ACTION_ITEMS] && (() => {
                    const actionItems = localActionItems;
                    if (actionItems && actionItems.length > 0) {
                      return (
                        <View style={styles.actionItemsList}>
                          {actionItems.map((item, index) => (
                            <View key={index} style={[styles.actionItem, { backgroundColor: themeColors.actionItemBg, borderColor: themeColors.actionItemBorder }]}>
                              <View style={styles.actionItemHeader}>
                                <View style={[styles.actionItemCheckbox, { borderColor: isDark ? colors.primary[400] : colors.primary[600] }]} />
                                <Text style={[styles.actionItemTitle, { color: themeColors.textPrimary }]} selectable>
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
                                    { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder },
                                    !item.deadline_date && !item.deadline_text && { backgroundColor: isDark ? colors.neutral[800] : '#FAFAFA', borderStyle: 'dashed' as const },
                                  ]}
                                  onPress={() => handleOpenDatePicker(index, item.deadline_date)}
                                >
                                  <Feather name="calendar" size={13} color={isDark ? colors.primary[400] : colors.primary[700]} style={styles.actionItemTagIconFeather} />
                                  <Text style={[
                                    styles.actionItemTagText,
                                    { color: isDark ? colors.primary[300] : colors.primary[700] },
                                    !item.deadline_date && !item.deadline_text && { fontStyle: 'italic' as const },
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
                                    { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder },
                                    !item.target && { backgroundColor: isDark ? colors.neutral[800] : '#FAFAFA', borderStyle: 'dashed' as const },
                                  ]}
                                  onPress={() => handleOpenContactPicker(index)}
                                >
                                  <Feather name="user" size={13} color={isDark ? colors.primary[400] : colors.primary[700]} style={styles.actionItemTagIconFeather} />
                                  <Text style={[
                                    styles.actionItemTagText,
                                    { color: isDark ? colors.primary[300] : colors.primary[700] },
                                    !item.target && { fontStyle: 'italic' as const },
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
                                        <Feather name="check" size={13} color={colors.success[600]} style={styles.actionItemTagIconFeather} />
                                        <Text style={styles.actionItemCalendarTextDone}>Ajouté</Text>
                                      </>
                                    ) : (
                                      <>
                                        <Feather name="calendar" size={13} color={colors.info[600]} style={styles.actionItemTagIconFeather} />
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

                {/* Ideas Section */}
                <View style={[styles.analysisSection, { borderBottomColor: themeColors.borderDefault }]}>
                  <View style={styles.analysisSectionHeader}>
                    <View style={styles.analysisSectionTitleRow}>
                      <Text style={{ fontSize: 16 }}>{ANALYSIS_ICONS[ANALYSIS_TYPES.IDEAS]}</Text>
                      <Text style={[styles.analysisSectionTitle, { color: themeColors.textPrimary }]}>{ANALYSIS_LABELS[ANALYSIS_TYPES.IDEAS]}</Text>
                    </View>
                    {/* Show button: loading, or no data, or debug mode for regeneration */}
                    {(analysisLoading[ANALYSIS_TYPES.IDEAS] || !analyses[ANALYSIS_TYPES.IDEAS] || debugMode) && (
                      <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: themeColors.actionItemTagBg, borderColor: themeColors.analysisBorder }]}
                        onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.IDEAS)}
                        disabled={analysisLoading[ANALYSIS_TYPES.IDEAS]}
                      >
                        {analysisLoading[ANALYSIS_TYPES.IDEAS] ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : analyses[ANALYSIS_TYPES.IDEAS] ? (
                          <Feather name={ActionIcons.refresh} size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                        ) : (
                          <Text style={[styles.generateButtonText, { color: isDark ? colors.primary[400] : colors.primary[600] }]}>Générer</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                  {analyses[ANALYSIS_TYPES.IDEAS] && (
                    <Text style={[styles.analysisResult, { color: themeColors.textPrimary }]} selectable>
                      {analyses[ANALYSIS_TYPES.IDEAS].content}
                    </Text>
                  )}
                </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Reprocess Section - Debug tools for audio captures (debug mode only) */}
        {debugMode && isAudio && capture.state === 'ready' && (
          <View style={[styles.reprocessCard, { backgroundColor: themeColors.reprocessBg, borderColor: themeColors.reprocessBorder }]}>
            <Pressable
              style={styles.reprocessHeader}
              onPress={() => setShowReprocess(!showReprocess)}
            >
              <View style={styles.reprocessTitleRow}>
                <Feather name="tool" size={18} color={isDark ? colors.warning[500] : colors.warning[700]} />
                <Text style={[styles.reprocessTitle, { color: themeColors.reprocessTitle }]}>Retraitement</Text>
              </View>
              <Feather
                name={showReprocess ? NavigationIcons.down : NavigationIcons.forward}
                size={16}
                color={isDark ? colors.warning[500] : colors.warning[600]}
              />
            </Pressable>
            {showReprocess && (
              <View style={[styles.reprocessContent, { backgroundColor: themeColors.reprocessContentBg, borderTopColor: themeColors.reprocessBorder }]}>
                <Text style={[styles.reprocessInfo, { color: themeColors.reprocessText }]}>
                  Outils de debug pour relancer le pipeline de traitement.
                </Text>

                {/* Status info */}
                <View style={[styles.reprocessStatus, { backgroundColor: themeColors.reprocessStatusBg, borderColor: themeColors.reprocessStatusBorder }]}>
                  <Text style={[styles.reprocessStatusLabel, { color: themeColors.reprocessStatusLabel }]}>État actuel:</Text>
                  <View style={styles.reprocessStatusRow}>
                    <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>• raw_transcript: </Text>
                    {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value ? (
                      <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>{metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value?.length} chars</Text>
                    ) : (
                      <View style={styles.reprocessStatusMissing}>
                        <Feather name="x-circle" size={12} color={colors.error[500]} />
                        <Text style={[styles.reprocessStatusMissingText, { color: themeColors.reprocessStatusError }]}>absent</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.reprocessStatusRow}>
                    <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>• normalizedText: </Text>
                    {capture.normalizedText ? (
                      <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>{capture.normalizedText.length} chars</Text>
                    ) : (
                      <View style={styles.reprocessStatusMissing}>
                        <Feather name="x-circle" size={12} color={colors.error[500]} />
                        <Text style={[styles.reprocessStatusMissingText, { color: themeColors.reprocessStatusError }]}>absent</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.reprocessStatusRow}>
                    <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>• LLM model: </Text>
                    {metadata[METADATA_KEYS.LLM_MODEL]?.value ? (
                      <Text style={[styles.reprocessStatusValue, { color: themeColors.reprocessStatusValue }]}>{metadata[METADATA_KEYS.LLM_MODEL]?.value}</Text>
                    ) : (
                      <View style={styles.reprocessStatusMissing}>
                        <Feather name="x-circle" size={12} color={colors.error[500]} />
                        <Text style={[styles.reprocessStatusMissingText, { color: themeColors.reprocessStatusError }]}>non appliqué</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Re-transcribe button */}
                <TouchableOpacity
                  style={[styles.reprocessButton, { backgroundColor: themeColors.reprocessButtonTranscribe }]}
                  onPress={handleReTranscribe}
                  disabled={reprocessing.transcribe}
                >
                  {reprocessing.transcribe ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name={CaptureIcons.voice} size={24} color={colors.neutral[0]} style={styles.reprocessButtonIconFeather} />
                      <View style={styles.reprocessButtonTextContainer}>
                        <Text style={styles.reprocessButtonTitle}>Re-transcrire</Text>
                        <Text style={styles.reprocessButtonDesc}>Relance Whisper sur l'audio</Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Re-post-process button */}
                <TouchableOpacity
                  style={[styles.reprocessButton, { backgroundColor: themeColors.reprocessButtonPostProcess }]}
                  onPress={handleRePostProcess}
                  disabled={reprocessing.postProcess || !metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value}
                >
                  {reprocessing.postProcess ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="cpu" size={24} color={colors.neutral[0]} style={styles.reprocessButtonIconFeather} />
                      <View style={styles.reprocessButtonTextContainer}>
                        <Text style={styles.reprocessButtonTitle}>Re-post-traiter</Text>
                        <Text style={styles.reprocessButtonDesc}>
                          {metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value
                            ? 'Repasse raw_transcript dans le LLM'
                            : 'Nécessite raw_transcript'}
                        </Text>
                      </View>
                    </>
                  )}
                </TouchableOpacity>

                {/* Info about analysis */}
                <View style={styles.reprocessNoteContainer}>
                  <Feather name="info" size={14} color={isDark ? colors.neutral[400] : colors.neutral[500]} />
                  <Text style={[styles.reprocessNote, { color: themeColors.reprocessText }]}>
                    Pour relancer l'analyse IA, utilisez la section "Analyse IA" ci-dessus.
                  </Text>
                </View>
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
        <View style={[styles.contactPickerContainer, { backgroundColor: themeColors.contactBg }]}>
          <View style={[styles.contactPickerHeader, { backgroundColor: themeColors.contactHeaderBg, borderBottomColor: themeColors.borderDefault }]}>
            <TouchableOpacity
              style={styles.contactPickerCloseButton}
              onPress={() => {
                setShowContactPicker(false);
                setEditingActionIndex(null);
                setContactSearchQuery('');
              }}
            >
              <Text style={[styles.contactPickerCloseText, { color: colors.primary[500] }]}>Fermer</Text>
            </TouchableOpacity>
            <Text style={[styles.contactPickerTitle, { color: themeColors.textPrimary }]}>Choisir un contact</Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={[styles.contactSearchContainer, { backgroundColor: themeColors.contactHeaderBg }]}>
            <TextInput
              style={[styles.contactSearchInput, { backgroundColor: themeColors.contactSearchBg, color: themeColors.textPrimary }]}
              placeholder="Rechercher..."
              placeholderTextColor={themeColors.textMuted}
              value={contactSearchQuery}
              onChangeText={setContactSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {loadingContacts ? (
            <View style={styles.contactLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text style={[styles.contactLoadingText, { color: themeColors.textSecondary }]}>Chargement des contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item, index) => (item as { id?: string }).id || `contact-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.contactItem, { backgroundColor: themeColors.contactItemBg, borderBottomColor: themeColors.borderDefault }]}
                  onPress={() => handleSelectContact(item)}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {item.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={[styles.contactName, { color: themeColors.textPrimary }]}>{item.name || 'Sans nom'}</Text>
                    {item.phoneNumbers && item.phoneNumbers.length > 0 && (
                      <Text style={[styles.contactPhone, { color: themeColors.textMuted }]}>
                        {item.phoneNumbers[0].number}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.contactEmptyContainer}>
                  <Text style={[styles.contactEmptyText, { color: themeColors.textMuted }]}>Aucun contact trouvé</Text>
                </View>
              }
            />
          )}
        </View>
      </Modal>
      )}

      {/* Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: themeColors.cardBg, borderTopColor: themeColors.borderSubtle }]}>
        {hasChanges ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.discardButton, { backgroundColor: isDark ? colors.neutral[700] : '#F2F2F7' }]}
              onPress={handleDiscardChanges}
            >
              <Feather name="rotate-ccw" size={22} color={themeColors.textTertiary} />
              <Text style={[styles.actionLabel, { color: themeColors.textMuted }]}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name={ActionIcons.save} size={22} color={colors.neutral[0]} />
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
                  <Feather
                    name={copied ? StatusIcons.success : ActionIcons.copy}
                    size={22}
                    color={copied ? colors.success[500] : colors.primary[500]}
                  />
                  <Text style={[styles.actionLabel, { color: colors.primary[500] }]}>{copied ? 'Copié!' : 'Copier'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                  <Feather name={ActionIcons.share} size={22} color={colors.primary[500]} />
                  <Text style={[styles.actionLabel, { color: colors.primary[500] }]}>Partager</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleDelete}>
              <Feather name={ActionIcons.delete} size={22} color={colors.error[500]} />
              <Text style={[styles.actionLabel, styles.deleteLabel]}>Supprimer</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Delete confirmation dialog */}
      <AlertDialog
        visible={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Supprimer cette capture ?"
        message="Cette action est irréversible."
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: 'Supprimer',
          onPress: confirmDelete,
        }}
        cancelAction={{
          label: 'Annuler',
          onPress: () => setShowDeleteDialog(false),
        }}
      />

      {/* Google Calendar connection dialog */}
      <AlertDialog
        visible={showCalendarDialog}
        onClose={() => setShowCalendarDialog(false)}
        title="Google Calendar non connecté"
        message="Connectez votre compte Google dans les paramètres pour ajouter des événements à votre calendrier."
        icon="calendar"
        variant="warning"
        confirmAction={{
          label: 'OK',
          onPress: () => {
            setShowCalendarDialog(false);
            toast.info('Allez dans Paramètres > Intégrations > Google Calendar');
          },
        }}
        cancelAction={{
          label: 'Annuler',
          onPress: () => setShowCalendarDialog(false),
        }}
      />
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
  errorText: {
    marginTop: 16,
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
  typeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
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
  audioCard: {
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
  contentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contentHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiEnhancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  aiEnhancedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  toggleVersionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  toggleVersionText: {
    fontSize: 12,
    fontWeight: '500',
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
  rawTranscriptTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    gap: 4,
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
  metadataTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
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
  // Actions section
  actionsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
    overflow: 'hidden',
  },
  actionsHeader: {
    padding: 12,
  },
  actionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginLeft: 8,
  },
  actionsContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    minHeight: 56,
  },
  actionButtonTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionButtonDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  debugBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  debugBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
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
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7B1FA2',
    marginLeft: 8,
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
  analysisSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  actionItemTagIconFeather: {
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
  analyzeAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  noTextTitle: {
    marginTop: 12,
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  actionLabel: {
    marginTop: 4,
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
    marginHorizontal: 8,
  },
  discardLabel: {
    color: '#8E8E93',
  },
  saveButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    marginHorizontal: 8,
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
  reprocessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginLeft: 8,
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
  reprocessStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reprocessStatusValue: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  reprocessStatusMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reprocessStatusMissingText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'monospace',
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
  reprocessButtonIconFeather: {
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
  reprocessNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  reprocessNote: {
    fontSize: 12,
    color: '#666',
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
