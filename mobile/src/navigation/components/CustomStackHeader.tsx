/**
 * CustomStackHeader - Reusable header component for Stack Navigators
 *
 * Features:
 * - Consistent styling across all stack navigators
 * - Theme-aware (dark/light mode)
 * - Back button with native icon
 * - Matches Tab Navigator header design
 * - Sync status indicator (Story 6.2 - Task 9.7)
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import { useTheme } from "../../hooks/useTheme";
import {
  colors,
  typography,
  getBackgroundColorsForColorScheme,
  getPrimaryPaletteForColorScheme,
} from "../../design-system/tokens";
import { SyncStatusIndicator } from "../../components/SyncStatusIndicator";

export function CustomStackHeader({
  options,
  route,
  back,
  navigation,
}: NativeStackHeaderProps) {
  const { isDark, colorSchemePreference } = useTheme();
  const backgrounds = getBackgroundColorsForColorScheme(
    colorSchemePreference,
    isDark
  );
  const primaryPalette = getPrimaryPaletteForColorScheme(colorSchemePreference);

  // Header avec teinte du color scheme, plus sombre en mode sombre
  const headerBackgroundColor = backgrounds.header;

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: headerBackgroundColor,
          borderBottomColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.08)",
        },
      ]}
    >
      {/* Bouton back */}
      {back && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Feather
            name="arrow-left"
            size={24}
            color={primaryPalette[isDark ? 400 : 500]}
          />
        </TouchableOpacity>
      )}

      {/* Titre */}
      <Text
        style={[
          styles.headerTitle,
          { color: isDark ? colors.neutral[50] : colors.neutral[900] },
          !back && styles.headerTitleNoBack,
        ]}
        numberOfLines={1}
      >
        {options.title || route.name}
      </Text>

      {/* Sync Status Indicator (Story 6.2 - Task 9.7) */}
      <SyncStatusIndicator compact />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: typography.fontWeight.semibold as "600",
    flex: 1,
  },
  headerTitleNoBack: {
    marginLeft: 0,
  },
  rightSpacer: {
    width: 36,
  },
});
