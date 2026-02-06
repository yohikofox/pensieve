/**
 * AnalysisCard Component
 *
 * Collapsible card containing all AI analysis sections
 * Story 5.1 - Refactoring: Extract analysis card responsibility
 * Story 5.4 - Autonomous component: calls hooks directly, no prop drilling
 */

import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { NavigationIcons, ActionIcons } from "../../design-system/icons";
import { AlertDialog, useToast } from "../../design-system/components";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_LABELS } from "../../contexts/Normalization/services/analysisPrompts";
import { AnalysisSection } from "./AnalysisSection";
import { ActionItemsList } from "./ActionItemsList";
import { IdeasSection } from "./IdeasSection";
import type { AnalysisType } from "../../contexts/capture/domain/CaptureAnalysis.model";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useCurrentTextEditor } from "../../stores/textEditorStore";
import { useAnalyses } from "../../hooks/useAnalyses";
import { useActionItems } from "../../hooks/useActionItems";
import { useIdeas } from "../../hooks/useIdeas";
import {
  useCurrentActionItems,
  useActionItemsStore,
} from "../../stores/actionItemsStore";

interface AnalysisCardProps {
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function AnalysisCard({
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: AnalysisCardProps) {
  // Autonomous - calls hooks directly
  const analysesHook = useAnalyses();
  const actionItemsHook = useActionItems();
  const ideasHook = useIdeas();
  const toast = useToast();

  const capture = useCaptureDetailStore((state) => state.capture);
  const isReady = useCaptureDetailStore((state) => state.isReady);
  const showAnalysis = useCaptureDetailStore((state) => state.showAnalysis);
  const setShowAnalysis = useCaptureDetailStore(
    (state) => state.setShowAnalysis,
  );
  const debugMode = useSettingsStore((state) => state.debugMode);
  const { themeColors, isDark } = useCaptureTheme();
  const { editedText } = useCurrentTextEditor(capture?.id || "");
  const captureId = capture?.id || "";

  // Read Google Calendar dialog state from store
  const { showCalendarDialog } = useCurrentActionItems(captureId);
  const setShowCalendarDialog = useActionItemsStore(
    (state) => state.setShowCalendarDialog,
  );

  const {
    analyses,
    analysisLoading,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
  } = analysesHook;

  useEffect(() => {
    if (startAnalysis && isReady) {
      setShowAnalysis(true);
    }
  }, [startAnalysis, isReady]);

  // Component manages its own visibility - only show for ready captures
  if (!isReady) return null;

  const handleToggleAnalysis = () => setShowAnalysis(!showAnalysis);

  return (
    <View
      style={[
        styles.analysisCard,
        {
          backgroundColor: themeColors.analysisBg,
          borderColor: themeColors.analysisBorder,
        },
      ]}
    >
      <Pressable style={styles.analysisHeader} onPress={handleToggleAnalysis}>
        <View style={styles.analysisTitleRow}>
          <Feather
            name="cpu"
            size={16}
            color={isDark ? colors.primary[400] : colors.primary[700]}
          />
          <Text
            style={[
              styles.analysisTitle,
              {
                color: isDark ? colors.primary[300] : colors.primary[700],
              },
            ]}
          >
            Analyse IA
          </Text>
        </View>
        <Feather
          name={showAnalysis ? NavigationIcons.down : NavigationIcons.forward}
          size={16}
          color={isDark ? colors.primary[400] : colors.primary[600]}
        />
      </Pressable>
      {showAnalysis && (
        <View
          style={[
            styles.analysisContent,
            {
              backgroundColor: themeColors.analysisContentBg,
              borderTopColor: themeColors.analysisBorder,
            },
          ]}
        >
          {/* Show message if no text to analyze */}
          {!editedText ? (
            <View style={styles.noTextMessage}>
              <Feather
                name="file-text"
                size={32}
                color={themeColors.textTertiary}
              />
              <Text
                style={[
                  styles.noTextTitle,
                  { color: themeColors.textSecondary },
                ]}
              >
                Pas de texte à analyser
              </Text>
              <Text
                style={[
                  styles.noTextSubtitle,
                  { color: themeColors.textTertiary },
                ]}
              >
                La transcription n'a pas produit de texte. Essayez avec un
                enregistrement plus long ou plus clair.
              </Text>
            </View>
          ) : (
            <>
              {/* Analyze All Button - Show if not all generated, or in debug mode for regeneration */}
              {(() => {
                const allGenerated =
                  analyses[ANALYSIS_TYPES.SUMMARY] &&
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
                          <Feather
                            name="zap"
                            size={16}
                            color={colors.neutral[0]}
                          />
                          <Text style={styles.analyzeAllButtonText}>
                            {allGenerated ? "Tout réanalyser" : "Analyser"}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}
              {/* Summary Section */}
              <AnalysisSection
                analysisType={ANALYSIS_TYPES.SUMMARY}
                analysis={analyses[ANALYSIS_TYPES.SUMMARY]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.SUMMARY]}
                debugMode={debugMode}
                isDark={isDark}
                themeColors={themeColors}
                onGenerate={() =>
                  handleGenerateAnalysis(ANALYSIS_TYPES.SUMMARY)
                }
              />

              {/* Highlights Section */}
              <AnalysisSection
                analysisType={ANALYSIS_TYPES.HIGHLIGHTS}
                analysis={analyses[ANALYSIS_TYPES.HIGHLIGHTS]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS]}
                debugMode={debugMode}
                isDark={isDark}
                themeColors={themeColors}
                onGenerate={() =>
                  handleGenerateAnalysis(ANALYSIS_TYPES.HIGHLIGHTS)
                }
              />

              {/* Action Items Section */}
              <View
                style={[
                  styles.analysisSection,
                  { borderBottomColor: themeColors.borderDefault },
                ]}
              >
                <View style={styles.analysisSectionHeader}>
                  <View style={styles.analysisSectionTitleRow}>
                    <Feather
                      name="check-square"
                      size={16}
                      color={colors.success[500]}
                    />
                    <Text
                      style={[
                        styles.analysisSectionTitle,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {ANALYSIS_LABELS[ANALYSIS_TYPES.ACTION_ITEMS]}
                    </Text>
                  </View>
                  {/* Show button: loading, or no data, or debug mode for regeneration */}
                  {(analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] ||
                    !analyses[ANALYSIS_TYPES.ACTION_ITEMS] ||
                    debugMode) && (
                    <TouchableOpacity
                      style={[
                        styles.generateButton,
                        {
                          backgroundColor: themeColors.actionItemTagBg,
                          borderColor: themeColors.analysisBorder,
                        },
                      ]}
                      onPress={() =>
                        handleGenerateAnalysis(ANALYSIS_TYPES.ACTION_ITEMS)
                      }
                      disabled={analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS]}
                    >
                      {analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary[500]}
                        />
                      ) : analyses[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                        <Feather
                          name={ActionIcons.refresh}
                          size={16}
                          color={
                            isDark ? colors.primary[400] : colors.primary[600]
                          }
                        />
                      ) : (
                        <Text
                          style={[
                            styles.generateButtonText,
                            {
                              color: isDark
                                ? colors.primary[400]
                                : colors.primary[600],
                            },
                          ]}
                        >
                          Générer
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {analyses[ANALYSIS_TYPES.ACTION_ITEMS] &&
                actionItemsHook.actionItems &&
                actionItemsHook.actionItems.length > 0 ? (
                  <ActionItemsList
                    actionItems={actionItemsHook.actionItems}
                    isDark={isDark}
                    themeColors={themeColors}
                    savingActionIndex={actionItemsHook.savingActionIndex}
                    savedActionIndex={actionItemsHook.savedActionIndex}
                    addingToCalendarIndex={
                      actionItemsHook.addingToCalendarIndex
                    }
                    addedToCalendarIndex={actionItemsHook.addedToCalendarIndex}
                    onOpenDatePicker={actionItemsHook.handleOpenDatePicker}
                    onOpenContactPicker={
                      actionItemsHook.handleOpenContactPicker
                    }
                    onAddToCalendar={actionItemsHook.handleAddToCalendar}
                    onSavedIndicatorHidden={() =>
                      actionItemsHook.setSavedActionIndex(null)
                    }
                    highlightTodoId={highlightTodoId}
                  />
                ) : analyses[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                  <Text style={styles.analysisResult} selectable>
                    {analyses[ANALYSIS_TYPES.ACTION_ITEMS]?.content ?? ""}
                  </Text>
                ) : null}
              </View>

              {/* Ideas Section */}
              <IdeasSection
                ideas={ideasHook.ideas}
                ideasLoading={ideasHook.ideasLoading}
                analysis={analyses[ANALYSIS_TYPES.IDEAS]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.IDEAS]}
                debugMode={debugMode}
                isDark={isDark}
                themeColors={themeColors}
                onGenerate={() => handleGenerateAnalysis(ANALYSIS_TYPES.IDEAS)}
                highlightIdeaId={highlightIdeaId}
                highlightTodoId={highlightTodoId}
              />
            </>
          )}
        </View>
      )}

      {/* Google Calendar connection dialog */}
      <AlertDialog
        visible={showCalendarDialog}
        onClose={() => setShowCalendarDialog(captureId, false)}
        title="Google Calendar non connecté"
        message="Connectez votre compte Google dans les paramètres pour ajouter des événements à votre calendrier."
        icon="calendar"
        variant="warning"
        confirmAction={{
          label: "OK",
          onPress: () => {
            setShowCalendarDialog(captureId, false);
            toast.info(
              "Allez dans Paramètres > Intégrations > Google Calendar",
            );
          },
        }}
        cancelAction={{
          label: "Annuler",
          onPress: () => setShowCalendarDialog(captureId, false),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  analysisCard: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  analysisTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  analysisContent: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  analysisSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  analysisSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  analysisSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  analysisSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  generateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  analysisResult: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  analyzeAllButton: {
    backgroundColor: "#9C27B0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  analyzeAllContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  analyzeAllButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  noTextMessage: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noTextTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  noTextSubtitle: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
