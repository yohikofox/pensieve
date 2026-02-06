/**
 * MainNavigator - Bottom Tab Navigation
 *
 * Main navigation with tab bar.
 * Screen configurations are defined in src/screens/registry.ts
 *
 * Architecture:
 * - Each screen owns its icon, labels, and options (registry pattern)
 * - MainNavigator is responsible for rendering and shared behaviors
 * - Dynamic data (badges, counts) is injected via hooks
 */

import React, { useCallback, useMemo } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { OfflineIndicator } from "../contexts/capture/ui/OfflineIndicator";
import { TabBarIcon } from "./components";
import { useTabBarStyle, useTabHeaderOptions } from "../hooks/useNavigationTheme";
import { useActiveTodoCount } from "../contexts/action/hooks/useActiveTodoCount";
import { tabScreens, type TabScreenConfig } from "../screens/registry";

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  const { t } = useTranslation();
  const tabBarStyle = useTabBarStyle();
  const tabHeaderOptions = useTabHeaderOptions();

  // Dynamic badge count for Actions tab
  const { data: activeTodoCount } = useActiveTodoCount();
  const todoCount = activeTodoCount ?? 0;

  // Memoized haptic feedback handler
  const handleTabPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Memoized tab press listeners (shared by all tabs)
  const tabPressListener = useMemo(
    () => ({
      tabPress: handleTabPress,
    }),
    [handleTabPress],
  );

  // Helper: Create tab bar icon renderer with optional badge
  const createIconRenderer = useCallback(
    (iconName: TabScreenConfig["icon"], badge?: number) => {
      return ({
        color,
        size,
        focused,
      }: {
        color: string;
        size: number;
        focused: boolean;
      }) => (
        <TabBarIcon
          name={iconName}
          color={color}
          size={size}
          focused={focused}
          badge={badge}
        />
      );
    },
    [],
  );

  // Helper: Get accessibility label with optional count
  const getAccessibilityLabel = useCallback(
    (screenName: string, config: TabScreenConfig, count?: number) => {
      // Special case: Actions tab with dynamic count
      if (screenName === "Actions" && count !== undefined && count > 0) {
        return t(config.i18n.accessibilityLabelWithCount!, { count });
      }
      return t(config.i18n.accessibilityLabel);
    },
    [t],
  );

  return (
    <>
      <Tab.Navigator
        initialRouteName="Capture"
        screenOptions={{
          ...tabHeaderOptions,
          headerShown: true,
          tabBarActiveTintColor: tabBarStyle.activeTintColor,
          tabBarInactiveTintColor: tabBarStyle.inactiveTintColor,
          tabBarLabelStyle: tabBarStyle.labelStyle,
          tabBarStyle: tabBarStyle.style,
        }}
      >
        {Object.entries(tabScreens).map(([name, config]) => {
          // Type assertion: config satisfies TabScreenConfig
          const screenConfig = config as TabScreenConfig;

          // Inject dynamic badge for Actions tab
          const badge = name === "Actions" ? todoCount : screenConfig.badge;

          return (
            <Tab.Screen
              key={name}
              name={name}
              component={screenConfig.component}
              options={{
                // Merge screen-specific options (if any)
                ...(screenConfig.options ?? {}),
                // Title (only if not hidden by headerShown: false)
                title: screenConfig.i18n.title
                  ? t(screenConfig.i18n.title)
                  : undefined,
                // Tab bar label
                tabBarLabel: t(screenConfig.i18n.tabLabel),
                // Tab bar icon with optional badge
                tabBarIcon: createIconRenderer(screenConfig.icon, badge),
                // Accessibility label
                tabBarAccessibilityLabel: getAccessibilityLabel(
                  name,
                  screenConfig,
                  todoCount,
                ),
              }}
              listeners={tabPressListener}
            />
          );
        })}
      </Tab.Navigator>
      <OfflineIndicator />
    </>
  );
};
