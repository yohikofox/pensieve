/**
 * IdeasSection Component
 *
 * Display structured ideas extracted from capture
 * Story 5.1 - Task 10.4: Structured ideas display
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../design-system/tokens";
import { ActionIcons } from "../../design-system/icons";
import { IdeaItem } from "../../contexts/knowledge/ui/IdeaItem";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";
import {
  ANALYSIS_LABELS,
  ANALYSIS_ICONS,
} from "../../contexts/Normalization/services/analysisPrompts";
import type { Idea } from "../../contexts/knowledge/domain/Idea.model";
import type { CaptureAnalysis } from "../../contexts/capture/domain/CaptureAnalysis.model";

interface IdeasSectionProps {
  ideas: Idea[];
  ideasLoading: boolean;
  analysis: CaptureAnalysis | null;
  analysisLoading: boolean;
  debugMode: boolean;
  isDark: boolean;
  themeColors: {
    borderDefault: string;
    textPrimary: string;
    textSecondary: string;
    actionItemTagBg: string;
    analysisBorder: string;
  };
  onGenerate: () => void;
}

export function IdeasSection({
  ideas,
  ideasLoading,
  analysis,
  analysisLoading,
  debugMode,
  isDark,
  themeColors,
  onGenerate,
}: IdeasSectionProps) {
  return (
    <View
      style={[
        styles.section,
        { borderBottomColor: themeColors.borderDefault },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={{ fontSize: 16 }}>
            {ANALYSIS_ICONS[ANALYSIS_TYPES.IDEAS]}
          </Text>
          <Text
            style={[
              styles.title,
              { color: themeColors.textPrimary },
            ]}
          >
            {ANALYSIS_LABELS[ANALYSIS_TYPES.IDEAS]}
          </Text>
        </View>
        {/* Show button: loading, or no data, or debug mode for regeneration */}
        {(analysisLoading || !analysis || debugMode) && (
          <TouchableOpacity
            style={[
              styles.generateButton,
              {
                backgroundColor: themeColors.actionItemTagBg,
                borderColor: themeColors.analysisBorder,
              },
            ]}
            onPress={onGenerate}
            disabled={analysisLoading}
          >
            {analysisLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary[500]}
              />
            ) : analysis ? (
              <Feather
                name={ActionIcons.refresh}
                size={16}
                color={
                  isDark
                    ? colors.primary[400]
                    : colors.primary[600]
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
      {/* Story 5.1 - Task 10.4: Display structured ideas with inline todos */}
      {ideasLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text
            style={[
              styles.loadingText,
              { color: themeColors.textSecondary },
            ]}
          >
            Chargement des idées...
          </Text>
        </View>
      ) : ideas.length > 0 ? (
        <View style={styles.ideasContainer}>
          {ideas.map((idea) => (
            <IdeaItem key={idea.id} idea={idea} />
          ))}
        </View>
      ) : analysis ? (
        <Text
          style={[
            styles.analysisText,
            { color: themeColors.textPrimary },
          ]}
          selectable
        >
          {analysis.content}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
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
  loadingContainer: {
    padding: 16,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  ideasContainer: {
    paddingHorizontal: 8,
  },
  analysisText: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 22,
  },
});
