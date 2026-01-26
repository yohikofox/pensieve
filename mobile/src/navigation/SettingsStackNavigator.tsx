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
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { TranscriptionEngineSettingsScreen } from '../screens/settings/TranscriptionEngineSettingsScreen';
import { WhisperSettingsScreen } from '../screens/settings/WhisperSettingsScreen';
import { LLMSettingsScreen } from '../screens/settings/LLMSettingsScreen';
import { ThemeSettingsScreen } from '../screens/settings/ThemeSettingsScreen';
import { lightStackScreenOptions, darkStackScreenOptions } from './theme';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  TranscriptionEngineSettings: undefined;
  WhisperSettings: undefined;
  LLMSettings: undefined;
  ThemeSettings: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const stackScreenOptions = colorScheme === 'dark' ? darkStackScreenOptions : lightStackScreenOptions;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackScreenOptions,
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{
          title: t('navigation.headers.settings'),
        }}
      />
      <Stack.Screen
        name="TranscriptionEngineSettings"
        component={TranscriptionEngineSettingsScreen}
        options={{
          title: t('navigation.headers.transcriptionEngine'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="WhisperSettings"
        component={WhisperSettingsScreen}
        options={{
          title: t('navigation.headers.whisperModel'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="LLMSettings"
        component={LLMSettingsScreen}
        options={{
          title: t('navigation.headers.aiEnhancement'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{
          title: t('navigation.headers.theme'),
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
