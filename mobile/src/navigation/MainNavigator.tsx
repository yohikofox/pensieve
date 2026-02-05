/**
 * MainNavigator - Bottom Tab Navigation
 *
 * Main navigation with five tabs:
 * - News: News feed and updates (coming soon)
 * - Captures: List of all captures
 * - Capture: Recording/capture screen
 * - Projects: Project organization (coming soon)
 * - Settings: App settings
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { CaptureScreen } from '../screens/capture/CaptureScreen';
import { ProjectsScreen } from '../screens/projects/ProjectsScreen';
import { NewsScreen } from '../screens/news/NewsScreen';
import { ActionsScreen } from '../screens/actions/ActionsScreen';
import { CapturesStackNavigator } from './CapturesStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { OfflineIndicator } from '../contexts/capture/ui/OfflineIndicator';
import { TabBarIcon, TabIcons } from './components';
import { lightTabBarStyle, darkTabBarStyle } from './theme';
import { useTheme } from '../hooks/useTheme';
import { useActiveTodoCount } from '../contexts/action/hooks/useActiveTodoCount';

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const tabBarStyle = isDark ? darkTabBarStyle : lightTabBarStyle;

  // Story 5.2 - AC1: Active todo count for badge
  const { data: activeTodoCount } = useActiveTodoCount();

  return (
    <>
      <Tab.Navigator
        initialRouteName="Capture"
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: tabBarStyle.activeTintColor,
          tabBarInactiveTintColor: tabBarStyle.inactiveTintColor,
          tabBarLabelStyle: tabBarStyle.labelStyle,
          tabBarStyle: tabBarStyle.style,
        }}
      >
        <Tab.Screen
          name="News"
          component={NewsScreen}
          options={{
            title: t('navigation.headers.news'),
            tabBarLabel: t('navigation.tabs.news'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.news}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Captures"
          component={CapturesStackNavigator}
          options={{
            headerShown: false, // Stack navigator handles its own headers
            tabBarLabel: t('navigation.tabs.captures'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.captures}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Capture"
          component={CaptureScreen}
          options={{
            title: t('navigation.headers.capture'),
            tabBarLabel: t('navigation.tabs.capture'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.capture}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Actions"
          component={ActionsScreen}
          options={{
            title: t('navigation.headers.actions'),
            tabBarLabel: t('navigation.tabs.actions'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.actions}
                color={color}
                size={size}
                focused={focused}
                badge={activeTodoCount}
              />
            ),
          }}
          listeners={{
            // Story 5.2 - Subtask 1.6: Haptic feedback on tab press
            tabPress: () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            },
          }}
        />
        <Tab.Screen
          name="Projects"
          component={ProjectsScreen}
          options={{
            title: t('navigation.headers.projects'),
            tabBarLabel: t('navigation.tabs.projects'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.projects}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStackNavigator}
          options={{
            headerShown: false, // Stack navigator handles its own headers
            tabBarLabel: t('navigation.tabs.settings'),
            tabBarIcon: ({ color, size, focused }) => (
              <TabBarIcon
                name={TabIcons.settings}
                color={color}
                size={size}
                focused={focused}
              />
            ),
          }}
        />
      </Tab.Navigator>
      <OfflineIndicator />
    </>
  );
};
