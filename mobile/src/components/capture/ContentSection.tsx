/**
 * ContentSection
 *
 * Main content section for CaptureDetailScreen.
 * Handles display and editing of capture content (transcription or text note).
 *
 * Features:
 * - AI-enhanced content indicator
 * - Toggle between original and AI-enhanced versions
 * - Editable text input for ready captures
 * - TranscriptionSync for audio captures
 * - Unsaved changes indicator
 *
 * Extracted from CaptureDetailScreen.tsx to reduce complexity.
 * Story 5.4: Refactored to consume stores directly instead of props.
 */

import React, { useRef } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { TranscriptionSync } from "../audio/TranscriptionSync";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";

export function ContentSection() {
  const capture = useCaptureDetailStore((state) => state.capture);
  const metadata = useCaptureDetailStore((state) => state.metadata);
  const showOriginalContent = useCaptureDetailStore(
    (state) => state.showOriginalContent,
  );
  const setShowOriginalContent = useCaptureDetailStore(
    (state) => state.setShowOriginalContent,
  );
  const audioPosition = useCaptureDetailStore((state) => state.audioPosition);
  const audioDuration = useCaptureDetailStore((state) => state.audioDuration);
  const setAudioPosition = useCaptureDetailStore(
    (state) => state.setAudioPosition,
  );

  const { themeColors, isDark } = useCaptureTheme();

  // Direct store access - no wrapper hooks
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const hasChanges = useCaptureDetailStore((state) => state.hasTextChanges);
  const setEditedText = useCaptureDetailStore((state) => state.setEditedText);
  const setHasChanges = useCaptureDetailStore(
    (state) => state.setHasTextChanges,
  );

  // Text change handler with change detection
  const handleTextChange = (text: string) => {
    setEditedText(text);
    // Compare with original to detect changes
    const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value || null;
    const isAudioCapture = capture?.type === "audio";
    const originalText =
      capture?.normalizedText ||
      rawTranscript ||
      (isAudioCapture ? "" : capture?.rawContent) ||
      "";
    setHasChanges(text !== originalText);
  };

  // Internal ref - no need to expose to parent
  const textInputRef = useRef<TextInput>(null);

  if (!capture) return null;

  const handleToggleOriginalContent = () => {
    setShowOriginalContent(!showOriginalContent);
  };

  const handleAudioSeek = (positionMs: number) => {
    setAudioPosition(positionMs);
  };
  const isAudio = useCaptureDetailStore((state) => state.isAudio);
  const hasText = editedText.length > 0;
  const isEditable =
    capture.state === "ready" ||
    capture.state === "failed" ||
    capture.type === "text";

  // Check if content has been AI-enhanced
  const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
  const originalText = isAudio ? rawTranscript : capture?.rawContent;

  const hasBeenEnhanced = !!originalText && !!capture?.normalizedText;
  // &&     originalText !== capture.normalizedText;

  // Determine which text to display
  const displayText =
    showOriginalContent && hasBeenEnhanced ? (originalText ?? "") : editedText;

  return (
    <View style={[styles.contentCard, { backgroundColor: themeColors.cardBg }]}>
      {/* Header with title and badges */}
      <View style={styles.contentHeader}>
        <View style={styles.contentTitleRow}>
          <Text style={[styles.contentTitle, { color: themeColors.textMuted }]}>
            {isAudio ? "TRANSCRIPTION" : "CONTENU"}
          </Text>

          {/* AI Enhanced Badge */}
          {hasBeenEnhanced && (
            <View
              style={[
                styles.aiEnhancedBadge,
                {
                  backgroundColor: isDark ? colors.success[900] : "#E8F5E9",
                },
              ]}
            >
              <Feather
                name="zap"
                size={10}
                color={isDark ? colors.success[400] : colors.success[600]}
              />
              <Text
                style={[
                  styles.aiEnhancedBadgeText,
                  {
                    color: isDark ? colors.success[400] : colors.success[600],
                  },
                ]}
              >
                Amélioré par IA
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.contentHeaderActions}>
          {/* Toggle Original/AI Version */}
          {hasBeenEnhanced && (
            <TouchableOpacity
              style={[
                styles.toggleVersionButton,
                {
                  backgroundColor: isDark ? colors.neutral[700] : "#F2F2F7",
                },
              ]}
              onPress={handleToggleOriginalContent}
            >
              <Feather
                name={showOriginalContent ? "eye" : "eye-off"}
                size={14}
                color={isDark ? colors.neutral[300] : colors.neutral[600]}
              />
              <Text
                style={[
                  styles.toggleVersionText,
                  {
                    color: isDark ? colors.neutral[300] : colors.neutral[600],
                  },
                ]}
              >
                {showOriginalContent ? "Version IA" : "Original"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Unsaved Changes Badge */}
          {hasChanges && (
            <View style={styles.unsavedBadge}>
              <Text style={styles.unsavedText}>Non enregistré</Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Display/Edit Area */}

      {isEditable && hasText && !showOriginalContent ? (
        // Editable TextInput
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
        // Read-only content with TranscriptionSync for audio
        isAudio && capture.rawContent ? (
          <TranscriptionSync
            transcription={displayText}
            currentPosition={audioPosition}
            duration={audioDuration || capture.duration || 0}
            onSeek={handleAudioSeek}
          />
        ) : (
          <Text
            style={[
              styles.contentText,
              {
                color: showOriginalContent
                  ? themeColors.textSecondary
                  : themeColors.textPrimary,
              },
            ]}
            selectable
          >
            {displayText}
          </Text>
        )
      ) : (
        // Placeholder for empty/processing captures
        <Text
          style={[styles.placeholderText, { color: themeColors.textMuted }]}
        >
          {capture.state === "processing"
            ? "Transcription en cours..."
            : capture.state === "failed"
              ? "La transcription a échoué"
              : capture.state === "ready" && isAudio
                ? "Aucun audio détecté dans l'enregistrement"
                : "Aucun contenu disponible"}
        </Text>
      )}
    </View>
  );
}
