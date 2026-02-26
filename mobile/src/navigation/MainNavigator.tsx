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

import React, { useCallback, useMemo, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { OfflineIndicator } from "../contexts/capture/ui/OfflineIndicator";
import { TabBarIcon } from "./components";
import { useTabBarStyle, useTabHeaderOptions } from "../hooks/useNavigationTheme";
import { useActiveTodoCount } from "../contexts/action/hooks/useActiveTodoCount";
import { tabScreens, type TabScreenConfig } from "../screens/registry";
import { SyncStatusIndicatorButton } from "../components/SyncStatusIndicatorButton";
import { SyncStatusDetailModal } from "../components/SyncStatusDetailModal";
import { useSettingsStore } from "../stores/settingsStore";

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  const { t } = useTranslation();
  const tabBarStyle = useTabBarStyle();
  const tabHeaderOptions = useTabHeaderOptions();
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  // Dynamic badge count for Actions tab
  const { data: activeTodoCount } = useActiveTodoCount();
  const todoCount = activeTodoCount ?? 0;

  // Story 24.3: Feature-gated tabs — subscribe to features object for reactivity.
  // Using state.getFeature (stable fn ref) as selector would NOT trigger re-renders on feature changes.
  const features = useSettingsStore((state) => state.features);

  // Story 24.3 Subtask 6.3: Compute visible tab names for safe initial route and deep link protection.
  // React Navigation gracefully ignores navigation to screens absent from the current navigator,
  // so this also guards against deep links targeting feature-gated tabs.
  const visibleTabNames = useMemo(
    () =>
      Object.entries(tabScreens)
        .filter(([, config]) => {
          const screenConfig = config as TabScreenConfig;
          return !screenConfig.featureKey || (features[screenConfig.featureKey] ?? false);
        })
        .map(([name]) => name),
    [features],
  );

  // "Capture" is never feature-gated; derive dynamically for safety
  const safeInitialRoute = visibleTabNames.includes('Capture')
    ? 'Capture'
    : (visibleTabNames[0] ?? 'Capture');

  // Tab press handler: haptic + reset nested stack to root when re-pressing active tab.
  // Using a factory function (not a shared object) so the listener has access to
  // `navigation` and `route` — required to detect whether the tab is already focused
  // and to dispatch the navigate action that pops the nested stack to its initial screen.
  const createTabListeners = useCallback(
    (name: string) =>
      ({ navigation }: { navigation: any }) => ({
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (navigation.isFocused()) {
            // Re-pressing an already active tab: navigate to the tab's root.
            // React Navigation propagates this to the nested stack, which pops
            // all screens on top of the initial route (e.g. WhisperSettings → SettingsMain).
            navigation.navigate(name);
          }
        },
      }),
    [],
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
        initialRouteName={safeInitialRoute}
        screenOptions={{
          ...tabHeaderOptions,
          headerShown: true,
          headerRight: () => (
            <SyncStatusIndicatorButton onPress={() => setSyncModalVisible(true)} />
          ),
          tabBarActiveTintColor: tabBarStyle.activeTintColor,
          tabBarInactiveTintColor: tabBarStyle.inactiveTintColor,
          tabBarLabelStyle: tabBarStyle.labelStyle,
          tabBarStyle: tabBarStyle.style,
        }}
      >
        {Object.entries(tabScreens)
          // Story 24.3 AC3-AC4: Filter feature-gated tabs using features object (reactive)
          .filter(([, config]) => {
            const screenConfig = config as TabScreenConfig;
            if (!screenConfig.featureKey) return true; // Always show non-gated tabs
            return features[screenConfig.featureKey] ?? false;
          })
          .map(([name, config]) => {
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
              listeners={createTabListeners(name)}
            />
          );
        })}
      </Tab.Navigator>
      <OfflineIndicator />
      <SyncStatusDetailModal
        visible={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
      />
    </>
  );
};
