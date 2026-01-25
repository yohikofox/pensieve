/**
 * SettingsStackNavigator - Stack navigation for Settings flow
 *
 * Screens:
 * - SettingsMain: Main settings screen
 * - WhisperSettings: Whisper model configuration
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { WhisperSettingsScreen } from '../screens/settings/WhisperSettingsScreen';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  WhisperSettings: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitle: 'Retour',
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          headerShown: false, // Tab navigator shows header
        }}
      />
      <Stack.Screen
        name="WhisperSettings"
        component={WhisperSettingsScreen}
        options={{
          title: 'Transcription',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
