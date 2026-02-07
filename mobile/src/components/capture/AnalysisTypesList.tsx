/**
 * AnalysisTypesList Component
 *
 * Redesigned list of analysis types with improved visual hierarchy
 * - Status indicators (not generated, loading, generated)
 * - Consistent color coding per analysis type
 * - Better accessibility with larger touch targets
 * - Clear action buttons
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
import { colors, spacing, typography, borderRadius } from "../../design-system/tokens";
import type { AnalysisType, CaptureAnalysis } from "../../contexts/capture/domain/CaptureAnalysis.model";
import { ANALYSIS_LABELS } from "../../contexts/Normalization/services/analysisPrompts";
import { ANALYSIS_TYPES } from "../../contexts/capture/domain/CaptureAnalysis.model";

interface AnalysisTypeItemProps {
  analysisType: AnalysisType;
  analysis: CaptureAnalysis | null;
  isLoading: boolean;
  onGenerate: () => void;
  isDark: boolean;
  themeColors: any;
}

// Map analysis types to semantic colors
const getAnalysisTypeColor = (type: AnalysisType) => {
  switch (type) {
    case ANALYSIS_TYPES.SUMMARY:
      return colors.info[500]; // Blue
    case ANALYSIS_TYPES.HIGHLIGHTS:
      return colors.warning[500]; // Yellow
    case ANALYSIS_TYPES.ACTION_ITEMS:
      return colors.success[500]; // Green
    case ANALYSIS_TYPES.IDEAS:
      return colors.secondary[500]; // Rose/Pink
    default:
      return colors.primary[500];
  }
};

const getAnalysisTypeIcon = (type: AnalysisType): string => {
  switch (type) {
    case ANALYSIS_TYPES.SUMMARY:
      return "file-text";
    case ANALYSIS_TYPES.HIGHLIGHTS:
      return "target";
    case ANALYSIS_TYPES.ACTION_ITEMS:
      return "check-square";
    case ANALYSIS_TYPES.IDEAS:
      return "star";
    default:
      return "zap";
  }
};

function AnalysisTypeItem({
  analysisType,
  analysis,
  isLoading,
  onGenerate,
  isDark,
  themeColors,
}: AnalysisTypeItemProps) {
  const typeColor = getAnalysisTypeColor(analysisType);
  const icon = getAnalysisTypeIcon(analysisType);
  const isGenerated = !!analysis;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.neutral[800] : colors.neutral[0],
          borderColor: isDark ? colors.neutral[700] : colors.neutral[200],
        },
      ]}
    >
      {/* Header: Icon + Title + Status Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${typeColor}20` },
            ]}
          >
            <Feather name={icon} size={16} color={typeColor} />
          </View>
          <Text
            style={[
              styles.cardTitle,
              { color: themeColors.textPrimary },
            ]}
          >
            {ANALYSIS_LABELS[analysisType]}
          </Text>
        </View>

        {/* Status Badge */}
        {isLoading ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.info[50] }]}>
            <ActivityIndicator size={14} color={colors.info[500]} />
            <Text style={[styles.statusText, { color: colors.info[700] }]}>
              En cours
            </Text>
          </View>
        ) : isGenerated ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.success[50] }]}>
            <Feather name="check" size={12} color={colors.success[700]} />
            <Text style={[styles.statusText, { color: colors.success[700] }]}>
              Généré
            </Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: colors.neutral[100] }]}>
            <Text style={[styles.statusText, { color: colors.neutral[600] }]}>
              À faire
            </Text>
          </View>
        )}
      </View>

      {/* Action Button */}
      <TouchableOpacity
        onPress={onGenerate}
        disabled={isLoading}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[2],
          paddingVertical: spacing[3],
          borderRadius: borderRadius.md,
          backgroundColor: typeColor,
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : isGenerated ? (
          <>
            <Feather name="refresh-cw" size={14} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Régénérer</Text>
          </>
        ) : (
          <>
            <Feather name="zap" size={14} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Générer</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

interface AnalysisTypesListProps {
  analyses: Record<string, CaptureAnalysis | null>;
  analysisLoading: Record<string, boolean>;
  onGenerateAnalysis: (type: AnalysisType) => void;
  isDark: boolean;
  themeColors: any;
}

export function AnalysisTypesList({
  analyses,
  analysisLoading,
  onGenerateAnalysis,
  isDark,
  themeColors,
}: AnalysisTypesListProps) {
  const analysisTypes: AnalysisType[] = [
    ANALYSIS_TYPES.SUMMARY,
    ANALYSIS_TYPES.HIGHLIGHTS,
    ANALYSIS_TYPES.ACTION_ITEMS,
    ANALYSIS_TYPES.IDEAS,
  ];

  return (
    <View style={styles.container}>
      {analysisTypes.map((type) => (
        <AnalysisTypeItem
          key={type}
          analysisType={type}
          analysis={analyses[type] || null}
          isLoading={analysisLoading[type] || false}
          onGenerate={() => onGenerateAnalysis(type)}
          isDark={isDark}
          themeColors={themeColors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
    paddingVertical: spacing[2],
  },

  card: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing[3],
    gap: spacing[3],
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  titleSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flex: 1,
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },

  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },

  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
