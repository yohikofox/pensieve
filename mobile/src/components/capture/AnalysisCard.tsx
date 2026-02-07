/**
 * AnalysisCard Component
 *
 * Collapsible card containing all AI analysis sections
 * Story 5.1 - Refactoring: Extract analysis card responsibility
 * Story 5.4 - Unified store: reads directly from captureDetailStore
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
import { AnalysisTypesList } from "./AnalysisTypesList";
import { DatePickerModal } from "./DatePickerModal";
import { ContactPickerModal } from "./ContactPickerModal";
import { useCaptureDetailStore } from "../../stores/captureDetailStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { useAnalyses } from "../../hooks/useAnalyses";
import { useActionItems } from "../../hooks/useActionItems";
import { useIdeas } from "../../hooks/useIdeas";

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
  // Autonomous hooks - read from unified store
  const analysesHook = useAnalyses();
  const actionItemsHook = useActionItems();
  const ideasHook = useIdeas();
  const toast = useToast();

  // Direct store access - no more wrapper hooks
  const isReady = useCaptureDetailStore((state) => state.isReady);
  const showAnalysis = useCaptureDetailStore((state) => state.showAnalysis);
  const setShowAnalysis = useCaptureDetailStore(
    (state) => state.setShowAnalysis,
  );
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const showCalendarDialog = useCaptureDetailStore(
    (state) => state.showCalendarDialog,
  );
  const setShowCalendarDialog = useCaptureDetailStore(
    (state) => state.setShowCalendarDialog,
  );

  const debugMode = useSettingsStore((state) => state.debugMode);
  const { themeColors, isDark } = useCaptureTheme();

  const {
    analyses,
    analysisLoading,
    isAnyAnalysisLoading,
    handleGenerateAnalysis,
    handleAnalyzeAll,
  } = analysesHook;

  useEffect(() => {
    if ((startAnalysis || highlightIdeaId || highlightTodoId) && isReady) {
      setShowAnalysis(true);
    }
  }, [startAnalysis, highlightIdeaId, highlightTodoId, isReady]);

  // Only show for ready captures
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
              {/* Analyze All Button */}
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

              {/* Analysis Types Overview */}
              <AnalysisTypesList
                analyses={analyses}
                analysisLoading={analysisLoading}
                onGenerateAnalysis={handleGenerateAnalysis}
                isDark={isDark}
                themeColors={themeColors}
              />

              {/* Detailed Sections - shown when content is generated */}
              {analyses[ANALYSIS_TYPES.SUMMARY] && (
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
              )}

              {analyses[ANALYSIS_TYPES.HIGHLIGHTS] && (
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
              )}

              {analyses[ANALYSIS_TYPES.ACTION_ITEMS] && (
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
                  </View>
                  {actionItemsHook.actionItems &&
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
                  ) : (
                    <Text style={styles.analysisResult} selectable>
                      {analyses[ANALYSIS_TYPES.ACTION_ITEMS]?.content ?? ""}
                    </Text>
                  )}
                </View>
              )}

              {analyses[ANALYSIS_TYPES.IDEAS] && (
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
              )}
            </>
          )}
        </View>
      )}

      {/* Google Calendar connection dialog */}
      <AlertDialog
        visible={showCalendarDialog}
        onClose={() => setShowCalendarDialog(false)}
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

      {/* Date Picker Modal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  analysisCard: {
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
