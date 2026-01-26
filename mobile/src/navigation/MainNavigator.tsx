/**
 * MainNavigator - Bottom Tab Navigation
 *
 * Main navigation with three tabs:
 * - Captures: List of all captures
 * - Capture: Recording/capture screen
 * - Settings: App settings
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { CaptureScreen } from '../screens/capture/CaptureScreen';
import { CapturesStackNavigator } from './CapturesStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { OfflineIndicator } from '../contexts/capture/ui/OfflineIndicator';
import { TabBarIcon, TabIcons } from './components';
import { tabBarStyle } from './theme';

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  const { t } = useTranslation();

  return (
    <>
      <Tab.Navigator
        initialRouteName="Capture"
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: tabBarStyle.activeTintColor,
          tabBarInactiveTintColor: tabBarStyle.inactiveTintColor,
          tabBarLabelStyle: tabBarStyle.labelStyle,
        }}
      >
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
