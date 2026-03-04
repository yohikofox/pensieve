/**
 * CaptureDetailTabs
 *
 * Tabbed navigation for the capture detail screen.
 * - Tab "Analyse" (défaut) : AnalysisCard + ActionsSection
 * - Tab "Transcription" : ContentSection
 *
 * Aucune dépendance externe ajoutée — state local uniquement.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { colors } from "../../design-system/tokens";
import { useCaptureTheme } from "../../hooks/useCaptureTheme";
import { AnalysisCard } from "./AnalysisCard";
import { ActionsSection } from "./ActionsSection";
import { ContentSection } from "./ContentSection";

type Tab = "analyse" | "transcription";

interface CaptureDetailTabsProps {
  startAnalysis?: boolean;
  highlightIdeaId?: string;
  highlightTodoId?: string;
}

export function CaptureDetailTabs({
  startAnalysis,
  highlightIdeaId,
  highlightTodoId,
}: CaptureDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("analyse");
  const { themeColors, isDark } = useCaptureTheme();

  const activeColor = isDark ? colors.primary[400] : colors.primary[600];
  const inactiveColor = themeColors.textMuted;
  const tabBarBg = themeColors.cardBg;
  const tabBarBorder = themeColors.borderDefault;

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: tabBarBg, borderBottomColor: tabBarBorder },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "analyse" && {
              borderBottomColor: activeColor,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("analyse")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "analyse" ? activeColor : inactiveColor },
            ]}
          >
            ✨ Analyse
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "transcription" && {
              borderBottomColor: activeColor,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("transcription")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "transcription" ? activeColor : inactiveColor,
              },
            ]}
          >
            📄 Transcription
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "analyse" ? (
          <View style={styles.stack}>
            <AnalysisCard
              startAnalysis={startAnalysis}
              highlightIdeaId={highlightIdeaId}
              highlightTodoId={highlightTodoId}
            />
            <ActionsSection />
          </View>
        ) : (
          <View style={styles.stack}>
            <ContentSection />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  stack: {
    gap: 16,
  },
});
