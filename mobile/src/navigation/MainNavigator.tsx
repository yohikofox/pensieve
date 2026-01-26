import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { CaptureScreen } from '../screens/capture/CaptureScreen';
import { CapturesStackNavigator } from './CapturesStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { OfflineIndicator } from '../contexts/capture/ui/OfflineIndicator';

const Tab = createBottomTabNavigator();

export const MainNavigator = () => {
  return (
    <>
      <Tab.Navigator
        initialRouteName="Capture"
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Capture"
          component={CaptureScreen}
          options={{
            title: 'Capturer',
            tabBarLabel: 'Capturer',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="mic" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStackNavigator}
          options={{
            title: 'Paramètres',
            tabBarLabel: 'Paramètres',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <OfflineIndicator />
    </>
  );
};
