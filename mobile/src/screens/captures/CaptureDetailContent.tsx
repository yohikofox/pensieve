/**
 * CaptureDetailContent - Main content component for capture detail view
 *
 * Features:
 * - Full transcription text display
 * - Copy to clipboard
 * - Share functionality
 * - Audio playback
 * - Delete capture
 * - AI analysis
 *
 * This is the content component in the Wrapper + Content pattern.
 * The wrapper (CaptureDetailScreen) handles route params extraction.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { AlertDialog, useToast, Button } from "../../design-system/components";
import { colors } from "../../design-system/tokens";
import { useTheme } from "../../hooks/useTheme";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useCaptureDetailInit } from "../../hooks/useCaptureDetailInit";
import { StandardLayout } from '../../components/layouts';
import { styles } from "../../styles/CaptureDetailScreen.styles";
import type {
  CaptureAnalysis,
  AnalysisType,
} from "../../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";
import {
  ANALYSIS_LABELS,
  ANALYSIS_ICONS,
} from "../../contexts/Normalization/services/analysisPrompts";
import { GoogleCalendarService } from "../../services/GoogleCalendarService";
import { useSettingsStore } from "../../stores/settingsStore";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useCaptureDetailListener } from "../../hooks/useCaptureDetailListener";
import { useActionItems } from "../../hooks/useActionItems";
import { useReprocessing } from "../../hooks/useReprocessing";
import { useIdeas } from "../../hooks/useIdeas";
import { useDeleteCapture } from "../../hooks/useDeleteCapture";
import { useTextEditor } from "../../hooks/useTextEditor";
import { useAnalyses } from "../../hooks/useAnalyses";
import {
  ActionItemsList,
  ReprocessingCard,
  IdeasSection,
  AnalysisSection,
  CaptureHeader,
  MetadataSection,
  RawTranscriptSection,
  ActionsSection,
  ContactPickerModal,
  ActionBar,
  AnalysisCard,
  DatePickerModal,
  CaptureDetailLoading,
  CaptureDetailError,
  AudioPlayerSection,
  ContentSection,
} from "../../components/capture";
import { formatDate, formatDuration } from "../../utils/formatters";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export interface CaptureDetailContentProps {
  captureId: string;
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureDetailContent({
  captureId,
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureDetailContentProps) {
  const navigation = useNavigation();
  const debugMode = useSettingsStore((state) => state.debugMode);

  // Story 5.4 - AC8: Log highlight params (full implementation pending)
  React.useEffect(() => {
    if (highlightIdeaId || highlightTodoId) {
      console.log('[CaptureDetailScreen] Navigation with highlights:', {
        highlightIdeaId,
        highlightTodoId,
      });
      // TODO: Implement auto-scroll to highlighted idea
      // TODO: Implement highlight glow effect
      // TODO: Implement fade-out after 2-3 seconds
    }
  }, [highlightIdeaId, highlightTodoId]);
  const autoTranscriptionEnabled = useSettingsStore(
    (state) => state.autoTranscriptionEnabled,
  );
  const audioPlayerType = useSettingsStore((state) => state.audioPlayerType);
  const { themeColors, isDark, colorSchemePreference } = useCaptureTheme();

  // Zustand store for capture detail state
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const loading = useCaptureDetailStore((state) => state.loading);
  const showRawTranscript = useCaptureDetailStore((state) => state.showRawTranscript);
  const showMetadata = useCaptureDetailStore((state) => state.showMetadata);
  const showOriginalContent = useCaptureDetailStore((state) => state.showOriginalContent);
  const showAnalysis = useCaptureDetailStore((state) => state.showAnalysis);
  const hasModelAvailable = useCaptureDetailStore((state) => state.hasModelAvailable);
  const isNativeEngine = useCaptureDetailStore((state) => state.isNativeEngine);
  const audioPosition = useCaptureDetailStore((state) => state.audioPosition);
  const audioDuration = useCaptureDetailStore((state) => state.audioDuration);

  const setCapture = useCaptureDetailStore((state) => state.setCapture);
  const setMetadata = useCaptureDetailStore((state) => state.setMetadata);
  const setLoading = useCaptureDetailStore((state) => state.setLoading);
  const setShowRawTranscript = useCaptureDetailStore((state) => state.setShowRawTranscript);
  const setShowMetadata = useCaptureDetailStore((state) => state.setShowMetadata);
  const setShowOriginalContent = useCaptureDetailStore((state) => state.setShowOriginalContent);
  const setShowAnalysis = useCaptureDetailStore((state) => state.setShowAnalysis);
  const setHasModelAvailable = useCaptureDetailStore((state) => state.setHasModelAvailable);
  const setIsNativeEngine = useCaptureDetailStore((state) => state.setIsNativeEngine);
  const setAudioPosition = useCaptureDetailStore((state) => state.setAudioPosition);
  const setAudioDuration = useCaptureDetailStore((state) => state.setAudioDuration);

  const textInputRef = useRef<TextInput>(null);

  // Toast
  const toast = useToast();

  // Initialization hook - consolidates capture loading, analyses, and engine checks
  const init = useCaptureDetailInit({
    captureId,
    onCaptureLoaded: setCapture,
    onMetadataLoaded: setMetadata,
    onLoadingChange: setLoading,
    onModelAvailabilityChange: setHasModelAvailable,
    onEngineTypeChange: setIsNativeEngine,
  });

  // Text editor hook - manages text editing, saving, and sharing
  const textEditorHook = useTextEditor({
    captureId,
    capture,
    metadata,
    toast,
    onCaptureUpdate: setCapture,
  });

  // Analyses hook - manages LLM analysis generation (defined before actionItemsHook)
  const analysesHook = useAnalyses({
    captureId,
    toast,
    ensureTextSaved: textEditorHook.ensureTextSaved,
  });

  // Action items hook - manages all action items state and logic
  const actionItemsHook = useActionItems({
    captureId,
    actionItemsAnalysis: analysesHook.analyses[ANALYSIS_TYPES.ACTION_ITEMS],
    toast,
    onAnalysisUpdate: (updatedAnalysis) => {
      analysesHook.setAnalyses((prev) => ({
        ...prev,
        [ANALYSIS_TYPES.ACTION_ITEMS]: updatedAnalysis,
      }));
    },
  });

  // Reprocessing hook - manages re-transcribe and re-post-process
  const reprocessingHook = useReprocessing({
    capture,
    toast,
    onReloadCapture: init.loadCapture,
  });

  // Ideas hook - manages structured ideas loading
  const ideasHook = useIdeas({
    capture,
  });

  // Delete hook - manages capture deletion and confirmation dialog
  const deleteHook = useDeleteCapture({
    captureId,
    toast,
    onDeleted: () => navigation.goBack(),
  });

  // Initialize analyses when loaded by init hook
  useEffect(() => {
    if (init.existingAnalyses) {
      analysesHook.setAnalyses(init.existingAnalyses);
    }
  }, [init.existingAnalyses]);


  // Auto-expand analysis section if startAnalysis is true
  // Wait for loading to complete (ensures editedText is set)
  useEffect(() => {
    if (startAnalysis && capture?.state === "ready" && !loading) {
      setShowAnalysis(true);
    }
  }, [startAnalysis, capture?.state, loading]);

  // Debug: log capture state for analysis section
  useEffect(() => {
    if (capture) {
      console.log("[CaptureDetailScreen] Capture loaded:", {
        id: capture.id,
        state: capture.state,
        hasNormalizedText: !!capture.normalizedText,
        normalizedTextLength: capture.normalizedText?.length || 0,
        editedTextLength: textEditorHook.editedText?.length || 0,
        showAnalysis,
      });
    }
  }, [capture, showAnalysis, textEditorHook.editedText]);

  // Event-driven updates (replaces polling)
  useCaptureDetailListener(captureId, init.loadCapture);

  // Audio player callbacks (Story 3.2b - AC2)
  const handleAudioPositionChange = useCallback((positionMs: number) => {
    setAudioPosition(positionMs);
  }, []);

  const handleAudioSeek = useCallback((positionMs: number) => {
    setAudioPosition(positionMs);
  }, []);

  if (loading) {
    return <CaptureDetailLoading />;
  }

  if (!capture) {
    return (
      <CaptureDetailError
        themeColors={themeColors}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const isAudio = capture.type === "audio";
  const hasText = textEditorHook.editedText.length > 0;
  const isEditable =
    capture.state === "ready" ||
    capture.state === "failed" ||
    capture.type === "text";

  return (
    <StandardLayout>
      <View style={styles.container}>
        <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Header Info */}
        <CaptureHeader themeColors={themeColors} />

        {/* Audio Player (Story 3.2b - AC2) - User can choose player type in Settings */}
        {isAudio && capture.rawContent && (
          <AudioPlayerSection
            audioUri={capture.rawContent}
            captureId={capture.id}
            metadata={metadata}
            audioPlayerType={audioPlayerType}
            themeColors={themeColors}
            onPositionChange={handleAudioPositionChange}
            onPlaybackEnd={() => setAudioPosition(0)}
          />
        )}

        {/* Content */}
        <ContentSection
          capture={capture}
          metadata={metadata}
          themeColors={themeColors}
          isDark={isDark}
          editedText={textEditorHook.editedText}
          hasChanges={textEditorHook.hasChanges}
          textInputRef={textInputRef}
          onTextChange={textEditorHook.handleTextChange}
          showOriginalContent={showOriginalContent}
          onToggleOriginalContent={() =>
            setShowOriginalContent(!showOriginalContent)
          }
          audioPosition={audioPosition}
          audioDuration={audioDuration}
          onAudioSeek={handleAudioSeek}
        />

        {/* Raw Transcript (before LLM) - Show when different from final text */}
        <RawTranscriptSection themeColors={themeColors} />

        {/* Metadata Section */}
        <MetadataSection themeColors={themeColors} />

        {/* Actions Section - Quick actions for captures */}
        <ActionsSection
          themeColors={themeColors}
          isDark={isDark}
          debugMode={debugMode}
          editedText={textEditorHook.editedText}
          reprocessing={reprocessingHook.reprocessing}
          onReTranscribe={reprocessingHook.handleReTranscribe}
          onRePostProcess={reprocessingHook.handleRePostProcess}
        />

        {/* Analysis Section - Show for ready audio captures AND all text notes with content */}
        {(capture.state === "ready" ||
          (capture.type === "text" && textEditorHook.editedText)) && (
          <AnalysisCard
            themeColors={themeColors}
            isDark={isDark}
            debugMode={debugMode}
            editedText={textEditorHook.editedText}
            showAnalysis={showAnalysis}
            onToggleAnalysis={() => {
              console.log(
                "[CaptureDetailScreen] Analysis header pressed, showAnalysis:",
                !showAnalysis,
              );
              setShowAnalysis(!showAnalysis);
            }}
            actionItemsHook={actionItemsHook}
            ideasHook={ideasHook}
            analysesHook={analysesHook}
          />
        )}

        {/* Reprocess Section - Debug tools for audio captures (debug mode only) */}
        {debugMode && isAudio && capture.state === "ready" && (
          <ReprocessingCard
            capture={capture}
            metadata={metadata}
            reprocessing={reprocessingHook.reprocessing}
            onReTranscribe={reprocessingHook.handleReTranscribe}
            onRePostProcess={reprocessingHook.handleRePostProcess}
            isDark={isDark}
            themeColors={themeColors}
          />
        )}
      </ScrollView>

      {/* Date Picker Modal - Fonctionne sur iOS et Android */}
      <DatePickerModal
        visible={actionItemsHook.showDatePicker}
        selectedDate={actionItemsHook.selectedDate}
        onConfirm={actionItemsHook.handleDateConfirm}
        onCancel={actionItemsHook.handleDateCancel}
      />

      {/* Contact Picker Modal */}
      <ContactPickerModal
        visible={actionItemsHook.showContactPicker}
        themeColors={themeColors}
        loadingContacts={actionItemsHook.loadingContacts}
        contactSearchQuery={actionItemsHook.contactSearchQuery}
        filteredContacts={actionItemsHook.filteredContacts}
        onClose={actionItemsHook.handleContactPickerCancel}
        onSearchChange={actionItemsHook.setContactSearchQuery}
        onSelectContact={actionItemsHook.handleSelectContact}
      />

      {/* Action Bar */}
      <ActionBar
        themeColors={themeColors}
        isDark={isDark}
        hasText={hasText}
        hasChanges={textEditorHook.hasChanges}
        isSaving={textEditorHook.isSaving}
        copied={textEditorHook.copied}
        onCopy={textEditorHook.handleCopy}
        onShare={textEditorHook.handleShare}
        onDelete={deleteHook.handleDelete}
        onSave={textEditorHook.handleSave}
        onDiscardChanges={textEditorHook.handleDiscardChanges}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        visible={deleteHook.showDeleteDialog}
        onClose={deleteHook.cancelDelete}
        title="Supprimer cette capture ?"
        message="Cette action est irréversible."
        icon="trash-2"
        variant="danger"
        confirmAction={{
          label: "Supprimer",
          onPress: deleteHook.confirmDelete,
        }}
        cancelAction={{
          label: "Annuler",
          onPress: deleteHook.cancelDelete,
        }}
      />

      {/* Google Calendar connection dialog */}
      <AlertDialog
        visible={actionItemsHook.showCalendarDialog}
        onClose={() => actionItemsHook.setShowCalendarDialog(false)}
        title="Google Calendar non connecté"
        message="Connectez votre compte Google dans les paramètres pour ajouter des événements à votre calendrier."
        icon="calendar"
        variant="warning"
        confirmAction={{
          label: "OK",
          onPress: () => {
            setShowCalendarDialog(false);
            toast.info(
              "Allez dans Paramètres > Intégrations > Google Calendar",
            );
          },
        }}
        cancelAction={{
          label: "Annuler",
          onPress: () => setShowCalendarDialog(false),
        }}
      />
      </View>
    </StandardLayout>
  );
}
