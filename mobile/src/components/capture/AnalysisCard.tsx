/**
 * AnalysisCard Component
 *
 * Collapsible card containing all AI analysis sections
 * Story 5.1 - Refactoring: Extract analysis card responsibility
 * Story 5.4 - Unified store: reads directly from captureDetailStore
 */

import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { AlertDialog, useToast } from "../../design-system/components";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_LABELS, ANALYSIS_ICONS } from "../../contexts/Normalization/services/analysisPrompts";
import { AnalysisSection } from "./AnalysisSection";
import { ActionItemsList } from "./ActionItemsList";
import { IdeasSection } from "./IdeasSection";
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
  const navigation = useNavigation();

  // Direct store access - no more wrapper hooks
  const isReady = useCaptureDetailStore((state) => state.isReady);
  const editedText = useCaptureDetailStore((state) => state.editedText);
  const showCalendarDialog = useCaptureDetailStore(
    (state) => state.showCalendarDialog,
  );
  const setShowCalendarDialog = useCaptureDetailStore(
    (state) => state.setShowCalendarDialog,
  );

  // Story 8.5: LLM model availability guide
  const hasLLMModelAvailable = useCaptureDetailStore(
    (state) => state.hasLLMModelAvailable,
  );
  const isLLMEnabled = useSettingsStore((state) => state.llm.isEnabled);
  const showLLMGuide = hasLLMModelAvailable === false && isLLMEnabled;

  const handleConfigureLLM = useCallback(() => {
    navigation.navigate("LLMSettings" as never);
  }, [navigation]);

  const debugMode = useSettingsStore((state) => state.debugMode);
  const { themeColors, isDark } = useCaptureTheme();

  const {
    analyses,
    analysisLoading,
    analysisQueueStatus,
    handleGenerateAnalysis,
  } = analysesHook;

  // Only show for ready captures
  if (!isReady) return null;

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
      <View
        style={[styles.analysisContent, { backgroundColor: themeColors.analysisContentBg }]}
      >
          {/* Story 8.5: LLM guide when enabled but no model downloaded */}
          {showLLMGuide && (
            <View
              style={[
                styles.llmGuideContainer,
                {
                  backgroundColor: themeColors.cardBg,
                  borderColor: themeColors.borderDefault,
                },
              ]}
            >
              <Feather name="cpu" size={24} color={colors.warning[500]} />
              <Text
                style={[styles.llmGuideTitle, { color: themeColors.textPrimary }]}
              >
                Modèle LLM requis
              </Text>
              <Text
                style={[
                  styles.llmGuideDescription,
                  { color: themeColors.textSecondary },
                ]}
              >
                Téléchargez un modèle LLM pour activer l'analyse automatique de vos captures.
              </Text>
              <TouchableOpacity
                style={[
                  styles.llmGuideButton,
                  { backgroundColor: colors.primary[500] },
                ]}
                onPress={handleConfigureLLM}
                activeOpacity={0.8}
              >
                <Text style={styles.llmGuideButtonText}>
                  Configurer un modèle
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Show message if no text to analyze */}
          {!showLLMGuide && !editedText ? (
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
          ) : !showLLMGuide && (
            <>
              {/* Summary */}
              <AnalysisSection
                analysisType={ANALYSIS_TYPES.SUMMARY}
                analysis={analyses[ANALYSIS_TYPES.SUMMARY]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.SUMMARY]}
                queueStatus={analysisQueueStatus[ANALYSIS_TYPES.SUMMARY]}
                debugMode={debugMode}
                isDark={isDark}
                themeColors={themeColors}
                onGenerate={() =>
                  handleGenerateAnalysis(ANALYSIS_TYPES.SUMMARY)
                }
              />

              {/* Highlights */}
              <AnalysisSection
                analysisType={ANALYSIS_TYPES.HIGHLIGHTS}
                analysis={analyses[ANALYSIS_TYPES.HIGHLIGHTS]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.HIGHLIGHTS]}
                queueStatus={analysisQueueStatus[ANALYSIS_TYPES.HIGHLIGHTS]}
                debugMode={debugMode}
                isDark={isDark}
                themeColors={themeColors}
                onGenerate={() =>
                  handleGenerateAnalysis(ANALYSIS_TYPES.HIGHLIGHTS)
                }
              />

              {/* Action Items */}
              <View
                style={[
                  styles.analysisSection,
                  { borderBottomColor: themeColors.borderDefault },
                ]}
              >
                <View style={styles.analysisSectionHeader}>
                  <View style={styles.analysisSectionTitleRow}>
                    <Text style={{ fontSize: 16 }}>
                      {ANALYSIS_ICONS[ANALYSIS_TYPES.ACTION_ITEMS]}
                    </Text>
                    <Text
                      style={[
                        styles.analysisSectionTitle,
                        { color: themeColors.textPrimary },
                      ]}
                    >
                      {ANALYSIS_LABELS[ANALYSIS_TYPES.ACTION_ITEMS]}
                    </Text>
                  </View>
                  {(analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] || !analyses[ANALYSIS_TYPES.ACTION_ITEMS] || debugMode) && (
                    <TouchableOpacity
                      style={[
                        styles.generateButton,
                        {
                          backgroundColor: themeColors.actionItemTagBg,
                          borderColor: themeColors.analysisBorder,
                        },
                      ]}
                      onPress={() => handleGenerateAnalysis(ANALYSIS_TYPES.ACTION_ITEMS)}
                      disabled={analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS]}
                    >
                      {analysisQueueStatus[ANALYSIS_TYPES.ACTION_ITEMS] === 'queued' ? (
                        <View style={styles.queueStatusRow}>
                          <ActivityIndicator size="small" color={colors.neutral[400]} />
                          <Text style={[styles.queueStatusText, { color: colors.neutral[500] }]}>
                            En attente...
                          </Text>
                        </View>
                      ) : analysisQueueStatus[ANALYSIS_TYPES.ACTION_ITEMS] === 'processing' || analysisLoading[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                        <ActivityIndicator size="small" color={colors.primary[500]} />
                      ) : analyses[ANALYSIS_TYPES.ACTION_ITEMS] ? (
                        <Feather name="refresh-cw" size={16} color={isDark ? colors.primary[400] : colors.primary[600]} />
                      ) : (
                        <Text style={[styles.generateButtonText, { color: isDark ? colors.primary[400] : colors.primary[600] }]}>
                          Générer
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                {analyses[ANALYSIS_TYPES.ACTION_ITEMS] && (
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
                  ) : (
                    <Text style={styles.analysisResult} selectable>
                      {analyses[ANALYSIS_TYPES.ACTION_ITEMS]?.content ?? ""}
                    </Text>
                  )
                )}
              </View>

              {/* Ideas */}
              <IdeasSection
                ideas={ideasHook.ideas}
                ideasLoading={ideasHook.ideasLoading}
                analysis={analyses[ANALYSIS_TYPES.IDEAS]}
                analysisLoading={analysisLoading[ANALYSIS_TYPES.IDEAS]}
                queueStatus={analysisQueueStatus[ANALYSIS_TYPES.IDEAS]}
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
  analysisContent: {
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
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  analysisSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analysisSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  generateButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  generateButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  queueStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  queueStatusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  analysisResult: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
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
  // Story 8.5: LLM guide styles
  llmGuideContainer: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginVertical: 8,
  },
  llmGuideTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  llmGuideDescription: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  llmGuideButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  llmGuideButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
