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
 */

import React from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { styles } from "../../styles/CaptureDetailScreen.styles";
import { METADATA_KEYS } from "../../contexts/capture/domain/CaptureMetadata.model";
import { TranscriptionSync } from "../audio/TranscriptionSync";
import type { ThemeColors } from "../../hooks/useCaptureTheme";
import type { Capture } from "../../contexts/capture/domain/Capture.model";
import type { CaptureMetadata } from "../../contexts/capture/domain/CaptureMetadata.model";

export interface ContentSectionProps {
  capture: Capture;
  metadata: Record<string, CaptureMetadata>;
  themeColors: ThemeColors;
  isDark: boolean;

  // Text editing
  editedText: string;
  hasChanges: boolean;
  textInputRef: React.RefObject<TextInput>;
  onTextChange: (text: string) => void;

  // Original/AI toggle
  showOriginalContent: boolean;
  onToggleOriginalContent: () => void;

  // Audio sync
  audioPosition: number;
  audioDuration: number;
  onAudioSeek: (positionMs: number) => void;
}

export function ContentSection({
  capture,
  metadata,
  themeColors,
  isDark,
  editedText,
  hasChanges,
  textInputRef,
  onTextChange,
  showOriginalContent,
  onToggleOriginalContent,
  audioPosition,
  audioDuration,
  onAudioSeek,
}: ContentSectionProps) {
  const isAudio = capture.type === "audio";
  const hasText = editedText.length > 0;
  const isEditable =
    capture.state === "ready" ||
    capture.state === "failed" ||
    capture.type === "text";

  // Check if content has been AI-enhanced
  const rawTranscript = metadata[METADATA_KEYS.RAW_TRANSCRIPT]?.value;
  const originalText = isAudio ? rawTranscript : capture?.rawContent;
  const hasBeenEnhanced =
    !!originalText &&
    capture?.normalizedText &&
    originalText !== capture.normalizedText;

  // Determine which text to display
  const displayText =
    showOriginalContent && hasBeenEnhanced ? originalText : editedText;

  return (
    <View style={[styles.contentCard, { backgroundColor: themeColors.cardBg }]}>
      {/* Header with title and badges */}
      <View style={styles.contentHeader}>
        <View style={styles.contentTitleRow}>
          <Text
            style={[styles.contentTitle, { color: themeColors.textMuted }]}
          >
            {isAudio ? "TRANSCRIPTION" : "CONTENU"}
          </Text>

          {/* AI Enhanced Badge */}
          {hasBeenEnhanced && (
            <View
              style={[
                styles.aiEnhancedBadge,
                {
                  backgroundColor: isDark
                    ? colors.success[900]
                    : "#E8F5E9",
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
                    color: isDark
                      ? colors.success[400]
                      : colors.success[600],
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
              onPress={onToggleOriginalContent}
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
                    color: isDark
                      ? colors.neutral[300]
                      : colors.neutral[600],
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
          style={[
            styles.contentTextInput,
            { color: themeColors.textPrimary },
          ]}
          value={displayText}
          onChangeText={onTextChange}
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
            onSeek={onAudioSeek}
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
          style={[
            styles.placeholderText,
            { color: themeColors.textMuted },
          ]}
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
