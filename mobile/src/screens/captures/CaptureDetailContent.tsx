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

import React, { useEffect, useRef, useCallback } from "react";
import { View, ScrollView, TextInput } from "react-native";
import { AlertDialog, useToast } from "../../design-system/components";
import { useCaptureDetailInit } from "../../hooks/useCaptureDetailInit";
import { StandardLayout } from "../../components/layouts";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";
import { useSettingsStore } from "../../stores/settingsStore";
import { useNavigation } from "@react-navigation/native";
import { useCaptureDetailListener } from "../../hooks/useCaptureDetailListener";
import { useActionItems } from "../../hooks/useActionItems";
import { useReprocessing } from "../../hooks/useReprocessing";
import { useIdeas } from "../../hooks/useIdeas";
import { useDeleteCapture } from "../../hooks/useDeleteCapture";
import { useTextEditor } from "../../hooks/useTextEditor";
import { useAnalyses } from "../../hooks/useAnalyses";
import {
  ReprocessingCard,
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
import { useCaptureDetailStore } from "../../stores/captureDetailStore";

export interface CaptureDetailContentProps {
  captureId: string;
  startAnalysis?: boolean;
}

export function CaptureDetailContent({
  captureId,
  startAnalysis,
}: CaptureDetailContentProps) {
  const navigation = useNavigation();

  // Zustand store for capture detail state
  const capture = useCaptureDetailStore((state) => state.capture);
  const loading = useCaptureDetailStore((state) => state.loading);

  const setCapture = useCaptureDetailStore((state) => state.setCapture);
  const setMetadata = useCaptureDetailStore((state) => state.setMetadata);
  const setLoading = useCaptureDetailStore((state) => state.setLoading);
  const setShowAnalysis = useCaptureDetailStore(
    (state) => state.setShowAnalysis,
  );
  const setHasModelAvailable = useCaptureDetailStore(
    (state) => state.setHasModelAvailable,
  );
  const setIsNativeEngine = useCaptureDetailStore(
    (state) => state.setIsNativeEngine,
  );
  const setAudioPosition = useCaptureDetailStore(
    (state) => state.setAudioPosition,
  );

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

  // Event-driven updates (replaces polling)
  useCaptureDetailListener(captureId, init.loadCapture);

  // Audio player callbacks (Story 3.2b - AC2)
  const handleAudioPositionChange = useCallback((positionMs: number) => {
    setAudioPosition(positionMs);
  }, [setAudioPosition]);

  if (loading) {
    return <CaptureDetailLoading />;
  }

  if (!capture) {
    return (
      <CaptureDetailError
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  const isAudio = capture.type === "audio";

  return (
    <StandardLayout>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
        >
          {/* Header Info */}
          <CaptureHeader />

          {/* Audio Player (Story 3.2b - AC2) - User can choose player type in Settings */}
          {isAudio && capture.rawContent && (
            <AudioPlayerSection
              onPositionChange={handleAudioPositionChange}
              onPlaybackEnd={() => setAudioPosition(0)}
            />
          )}

          {/* Content */}
          <ContentSection
            textInputRef={textInputRef}
            onTextChange={textEditorHook.handleTextChange}
          />

          {/* Raw Transcript (before LLM) - Show when different from final text */}
          <RawTranscriptSection />

          {/* Metadata Section */}
          <MetadataSection />

          {/* Actions Section - Quick actions for captures */}
          <ActionsSection
            reprocessing={reprocessingHook.reprocessing}
            onReTranscribe={reprocessingHook.handleReTranscribe}
            onRePostProcess={reprocessingHook.handleRePostProcess}
          />

          {/* Analysis Section - Show for ready audio captures AND all text notes with content */}
          {capture.state === "ready" && (
            <AnalysisCard
              actionItemsHook={actionItemsHook}
              ideasHook={ideasHook}
              analysesHook={analysesHook}
            />
          )}

          {/* Reprocess Section - Debug tools for audio captures (debug mode only) */}
          {isAudio && capture.state === "ready" && (
            <ReprocessingCard
              reprocessing={reprocessingHook.reprocessing}
              onReTranscribe={reprocessingHook.handleReTranscribe}
              onRePostProcess={reprocessingHook.handleRePostProcess}
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
          loadingContacts={actionItemsHook.loadingContacts}
          contactSearchQuery={actionItemsHook.contactSearchQuery}
          filteredContacts={actionItemsHook.filteredContacts}
          onClose={actionItemsHook.handleContactPickerCancel}
          onSearchChange={actionItemsHook.setContactSearchQuery}
          onSelectContact={actionItemsHook.handleSelectContact}
        />

        {/* Action Bar */}
        <ActionBar
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
              actionItemsHook.setShowCalendarDialog(false);
              toast.info(
                "Allez dans Paramètres > Intégrations > Google Calendar",
              );
            },
          }}
          cancelAction={{
            label: "Annuler",
            onPress: () => actionItemsHook.setShowCalendarDialog(false),
          }}
        />
      </View>
    </StandardLayout>
  );
}
