/**
 * NewsScreen - News Feed
 *
 * Displays a feed of news and updates
 */

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { colors } from "../../design-system/tokens";
import { StandardLayout } from "../../components/layouts";
import { useLayoutConfig } from "../../hooks/useLayoutConfig";

export const NewsScreen = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const layoutConfig = useLayoutConfig("News");

  const iconColor = isDark ? colors.neutral[400] : colors.neutral[500];

  return (
    <StandardLayout {...layoutConfig}>
      <View className="flex-1 justify-center items-center">
        <Feather name="rss" size={64} color={iconColor} />
        <Text className="text-2xl font-semibold text-text-primary mt-4 mb-2">
          {t("news.comingSoon.title")}
        </Text>
        <Text className="text-base text-text-secondary text-center leading-6">
          {t("news.comingSoon.description")}
        </Text>
      </View>
    </StandardLayout>
  );
};
