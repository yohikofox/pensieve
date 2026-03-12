/**
 * CaptureTextDetailContent
 *
 * Layout dédié aux captures texte :
 * - Mode lecture : texte brut + bouton "Modifier"
 * - Mode édition : TextInput multiline, curseur positionné en début de texte,
 *   KeyboardAwareScrollView pour que le contenu reste visible au-dessus du clavier
 * - Section Analyse visible uniquement en mode lecture
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useTextEditor } from "../../hooks/useTextEditor";
import { CaptureDetailShell } from "./CaptureDetailShell";
import { AnalysisCard } from "./AnalysisCard";
import { ActionsSection } from "./ActionsSection";

interface CaptureTextDetailContentProps {
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureTextDetailContent({
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureTextDetailContentProps) {
  const { themeColors, isDark } = useCaptureTheme();
  const textInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<
    { start: number; end: number } | undefined
  >(undefined);

  const isEditingText = useCaptureDetailStore((state) => state.isEditingText);
  const setIsEditingText = useCaptureDetailStore(
    (state) => state.setIsEditingText,
  );
  const { editedText, handleTextChange } = useTextEditor();

  useEffect(() => {
    if (isEditingText) {
      setSelection({ start: 0, end: 0 });
      const focusTimeout = setTimeout(() => {
        textInputRef.current?.focus();
        const releaseTimeout = setTimeout(() => setSelection(undefined), 150);
        return () => clearTimeout(releaseTimeout);
      }, 50);
      return () => clearTimeout(focusTimeout);
    }
  }, [isEditingText]);

  return (
    <CaptureDetailShell>
      <KeyboardAwareScrollView
        bottomOffset={80}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contentContainer}
      >
        <View
          style={[
            styles.textZone,
            {
              backgroundColor: isEditingText
                ? isDark
                  ? colors.neutral[800]
                  : colors.neutral[50]
                : themeColors.cardBg,
              borderColor: isEditingText
                ? colors.primary[500]
                : themeColors.borderDefault,
              borderWidth: isEditingText ? 2 : 1,
            },
          ]}
        >
          {isEditingText ? (
            <TextInput
              ref={textInputRef}
              style={[styles.textInput, { color: themeColors.textPrimary }]}
              value={editedText}
              onChangeText={handleTextChange}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              placeholder="Saisissez votre texte..."
              placeholderTextColor={themeColors.textMuted}
              selection={selection}
            />
          ) : (
            <View style={styles.readModeContainer}>
              <Text
                style={[styles.readText, { color: themeColors.textPrimary }]}
                selectable
              >
                {editedText || "Aucun contenu"}
              </Text>

              <TouchableOpacity
                style={[
                  styles.editButton,
                  {
                    backgroundColor: themeColors.cardBg,
                    borderColor: themeColors.borderDefault,
                  },
                ]}
                onPress={() => setIsEditingText(true)}
                accessibilityLabel="Modifier le texte"
                accessibilityRole="button"
              >
                <Feather name="edit-2" size={16} color={colors.primary[500]} />
                <Text
                  style={[
                    styles.editButtonLabel,
                    { color: colors.primary[500] },
                  ]}
                >
                  Modifier
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!isEditingText && (
          <View style={styles.analysisContainer}>
            <AnalysisCard
              startAnalysis={startAnalysis}
              highlightIdeaId={highlightIdeaId}
              highlightTodoId={highlightTodoId}
            />
            <ActionsSection />
          </View>
        )}
      </KeyboardAwareScrollView>
    </CaptureDetailShell>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  textZone: {
    borderRadius: 8,
    overflow: "hidden",
  },
  readModeContainer: {
    padding: 12,
    gap: 12,
  },
  readText: {
    fontSize: 16,
    lineHeight: 24,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButtonLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  textInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 150,
    padding: 12,
  },
  analysisContainer: {
    gap: 16,
  },
});
