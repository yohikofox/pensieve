/**
 * SettingsStackNavigator - Stack navigation for Settings flow
 *
 * Screens:
 * - SettingsMain: Main settings screen
 * - TranscriptionEngineSettings: Choose transcription engine (Whisper/Native)
 * - WhisperSettings: Whisper model configuration
 * - LLMSettings: LLM post-processing configuration
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { TranscriptionEngineSettingsScreen } from '../screens/settings/TranscriptionEngineSettingsScreen';
import { WhisperSettingsScreen } from '../screens/settings/WhisperSettingsScreen';
import { LLMSettingsScreen } from '../screens/settings/LLMSettingsScreen';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  TranscriptionEngineSettings: undefined;
  WhisperSettings: undefined;
  LLMSettings: undefined;
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
        name="TranscriptionEngineSettings"
        component={TranscriptionEngineSettingsScreen}
        options={{
          title: 'Moteur de transcription',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="WhisperSettings"
        component={WhisperSettingsScreen}
        options={{
          title: 'Modèle Whisper',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="LLMSettings"
        component={LLMSettingsScreen}
        options={{
          title: 'Amélioration IA',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
