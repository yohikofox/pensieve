/**
 * ActionBar Component
 *
 * Bottom action bar with Copy, Share, Delete, and Save buttons
 * Story 5.1 - Refactoring: Extract action bar responsibility
 * Story 5.4 - Autonomous component: calls hooks directly, no prop drilling
 */

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { ActionIcons, StatusIcons } from "../../design-system/icons";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useTextEditor } from "../../hooks/useTextEditor";
import { useDeleteCapture } from "../../hooks/useDeleteCapture";

export function ActionBar() {
  // Autonomous - calls hooks directly
  const { handleDelete } = useDeleteCapture();

  const capture = useCaptureDetailStore((state) => state.capture);
  const isInQueue = useCaptureDetailStore((state) => state.isInQueue);
  const { themeColors, isDark } = useCaptureTheme();
  const isCaptureInProcessing = capture?.state === "processing" || isInQueue;

  // Direct store access - no wrapper hooks
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const hasChanges = useCaptureDetailStore((state) => state.hasTextChanges);
  const isSaving = useCaptureDetailStore((state) => state.isSavingText);
  const copied = useCaptureDetailStore((state) => state.textCopied);

  const { handleSave, handleCopy, handleShare, handleDiscardChanges } = useTextEditor();

  const hasText = editedText.length > 0;
  return (
    <View
      style={[
        styles.actionBar,
        {
          backgroundColor: themeColors.cardBg,
          borderTopColor: themeColors.borderSubtle,
        },
      ]}
    >
      {hasChanges ? (
        <>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.discardButton,
              { backgroundColor: isDark ? colors.neutral[700] : "#F2F2F7" },
            ]}
            onPress={handleDiscardChanges}
          >
            <Feather
              name="rotate-ccw"
              size={22}
              color={themeColors.textMuted}
            />
            <Text
              style={[styles.actionLabel, { color: themeColors.textMuted }]}
            >
              Annuler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Feather
                name={ActionIcons.save}
                size={22}
                color={colors.neutral[0]}
              />
            )}
            <Text style={[styles.actionLabel, styles.saveLabel]}>
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {hasText && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleCopy}
              >
                <Feather
                  name={copied ? StatusIcons.success : ActionIcons.copy}
                  size={22}
                  color={copied ? colors.success[500] : colors.primary[500]}
                />
                <Text
                  style={[styles.actionLabel, { color: colors.primary[500] }]}
                >
                  {copied ? "Copié!" : "Copier"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShare}
              >
                <Feather
                  name={ActionIcons.share}
                  size={22}
                  color={colors.primary[500]}
                />
                <Text
                  style={[styles.actionLabel, { color: colors.primary[500] }]}
                >
                  Partager
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, isCaptureInProcessing && styles.disabledButton]}
            onPress={handleDelete}
            disabled={isCaptureInProcessing}
          >
            <Feather
              name={ActionIcons.delete}
              size={22}
              color={isCaptureInProcessing ? colors.neutral[400] : colors.error[500]}
            />
            <Text style={[styles.actionLabel, isCaptureInProcessing ? styles.disabledLabel : styles.deleteLabel]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  actionLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "500",
  },
  deleteButton: {},
  deleteLabel: {
    color: "#FF3B30",
  },
  disabledButton: {
    opacity: 0.4,
  },
  disabledLabel: {
    color: "#8E8E93",
  },
  discardButton: {
    borderRadius: 8,
    marginHorizontal: 8,
  },
  saveButton: {
    backgroundColor: "#34C759",
    borderRadius: 8,
    marginHorizontal: 8,
  },
  saveLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
