/**
 * CapturesStackNavigator - Stack navigation for Captures flow
 *
 * Screens:
 * - CapturesList: List of all captures
 * - CaptureDetail: Full capture details with transcription
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CapturesListScreen } from '../screens/captures/CapturesListScreen';
import { CaptureDetailScreen } from '../screens/captures/CaptureDetailScreen';

export type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string };
};

const Stack = createNativeStackNavigator<CapturesStackParamList>();

export function CapturesStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitle: 'Retour',
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
          title: 'Détail',
          headerShown: true,
        }}
      />
    </Stack.Navigator>
  );
}
