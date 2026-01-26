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
import { CapturesListScreen } from '../screens/captures/CapturesListScreen';
import { CaptureDetailScreen } from '../screens/captures/CaptureDetailScreen';
import { stackScreenOptions } from './theme';

export type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string };
};

const Stack = createNativeStackNavigator<CapturesStackParamList>();

export function CapturesStackNavigator() {
  const { t } = useTranslation();

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
          headerShown: false, // Tab navigator shows header
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
