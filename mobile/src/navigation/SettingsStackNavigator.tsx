/**
 * SettingsStackNavigator - Stack navigation for Settings flow
 *
 * Screens:
 * - SettingsMain: Main settings screen
 * - TranscriptionEngineSettings: Choose transcription engine (Whisper/Native)
 * - WhisperSettings: Whisper model configuration
 * - LLMSettings: LLM post-processing configuration
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { TranscriptionEngineSettingsScreen } from '../screens/settings/TranscriptionEngineSettingsScreen';
import { WhisperSettingsScreen } from '../screens/settings/WhisperSettingsScreen';
import { LLMSettingsScreen } from '../screens/settings/LLMSettingsScreen';
import { ThemeSettingsScreen } from '../screens/settings/ThemeSettingsScreen';
import { NotificationSettingsScreen } from '../screens/settings/NotificationSettingsScreen';
import { LottieGalleryScreen } from '../screens/settings/LottieGalleryScreen';
import { TodoDetailPopoverTestScreen } from '../screens/__dev__/TodoDetailPopoverTestScreen';
import { useStackScreenOptions } from '../hooks/useNavigationTheme';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  TranscriptionEngineSettings: undefined;
  WhisperSettings: undefined;
  LLMSettings: undefined;
  ThemeSettings: undefined;
  NotificationSettings: undefined;
  LottieGallery: undefined;
  TodoDetailPopoverTest: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export function SettingsStackNavigator() {
  const { t } = useTranslation();
  const stackScreenOptions = useStackScreenOptions();

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
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: t('navigation.headers.notificationSettings'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="LottieGallery"
        component={LottieGalleryScreen}
        options={{
          title: 'Lottie Animations',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="TodoDetailPopoverTest"
        component={TodoDetailPopoverTestScreen}
        options={{
          title: 'TodoDetailPopover Test',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
