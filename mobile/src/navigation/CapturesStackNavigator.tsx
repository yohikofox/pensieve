/**
 * CapturesStackNavigator - Stack navigation for Captures flow
 *
 * Screens:
 * - CapturesList: List of all captures
 * - CaptureDetail: Full capture details with transcription
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { CapturesListScreen } from '../screens/captures/CapturesListScreen';
import { CaptureDetailScreen } from '../screens/captures/CaptureDetailScreen';
import { lightStackScreenOptions, darkStackScreenOptions } from './theme';

export type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string };
};

const Stack = createNativeStackNavigator<CapturesStackParamList>();

export function CapturesStackNavigator() {
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
        name="CapturesList"
        component={CapturesListScreen}
        options={{
          title: t('navigation.headers.captures'),
        }}
      />
      <Stack.Screen
        name="CaptureDetail"
        component={CaptureDetailScreen}
        options={{
          title: t('navigation.headers.captureDetail'),
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
