/**
 * AnalysisSection Component
 *
 * Generic component for displaying LLM analysis results
 * Used for Summary, Highlights, and other text-based analyses
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
import type { AnalysisType, CaptureAnalysis } from "../../contexts/capture/domain/CaptureAnalysis.model";
import {
  ANALYSIS_LABELS,
  ANALYSIS_ICONS,
} from "../../contexts/Normalization/services/analysisPrompts";

interface AnalysisSectionProps {
  analysisType: AnalysisType;
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

export function AnalysisSection({
  analysisType,
  analysis,
  analysisLoading,
  debugMode,
  isDark,
  themeColors,
  onGenerate,
}: AnalysisSectionProps) {
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
            {ANALYSIS_ICONS[analysisType]}
          </Text>
          <Text
            style={[
              styles.title,
              { color: themeColors.textPrimary },
            ]}
          >
            {ANALYSIS_LABELS[analysisType]}
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
      {analysis && (
        <Text
          style={[
            styles.analysisText,
            { color: themeColors.textPrimary },
          ]}
          selectable
        >
          {analysis.content}
        </Text>
      )}
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
  analysisText: {
    paddingHorizontal: 16,
    fontSize: 14,
    lineHeight: 22,
  },
});
