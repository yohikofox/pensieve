import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { CaptureScreen } from '../screens/capture/CaptureScreen';
import { CapturesStackNavigator } from './CapturesStackNavigator';
import { OfflineIndicator } from '../contexts/capture/ui/OfflineIndicator';

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
        }}
      >
        <Tab.Screen
          name="Captures"
          component={CapturesStackNavigator}
          options={{
            title: 'Mes Captures',
            tabBarLabel: 'Captures',
          }}
        />
        <Tab.Screen
          name="Capture"
          component={CaptureScreen}
          options={{
            title: 'Capturer',
            tabBarLabel: 'Capturer',
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Paramètres',
            tabBarLabel: 'Paramètres',
          }}
        />
      </Tab.Navigator>
      <OfflineIndicator />
    </>
  );
};
