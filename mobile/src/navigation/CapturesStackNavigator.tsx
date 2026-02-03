/**
 * CapturesStackNavigator - Stack navigation for Captures flow
 *
 * Screens:
 * - CapturesList: List of all captures
 * - CaptureDetail: Full capture details with transcription
 *
 * Story 3.4 Features:
 * - AC2: Hero transition animation (300ms timing via LayoutAnimation)
 * - AC6: Platform-specific navigation gestures
 *   - iOS: Edge swipe back enabled
 *   - Android: Hardware back button + edge swipe
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { CapturesListScreen } from '../screens/captures/CapturesListScreen';
import { CaptureDetailScreen } from '../screens/captures/CaptureDetailScreen';
import { lightStackScreenOptions, darkStackScreenOptions } from './theme';
import { useTheme } from '../hooks/useTheme';

export type CapturesStackParamList = {
  CapturesList: undefined;
  CaptureDetail: { captureId: string };
};

const Stack = createNativeStackNavigator<CapturesStackParamList>();

export function CapturesStackNavigator() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const stackScreenOptions = isDark ? darkStackScreenOptions : lightStackScreenOptions;

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

          // Story 3.4 AC2: Hero transition animation (Option B - LayoutAnimation)
          // The 300ms timing is controlled by LayoutAnimation in CapturesListScreen.handleCapturePress
          animation: 'default', // Smooth slide transition
          presentation: Platform.OS === 'ios' ? 'card' : 'modal',

          // Story 3.4 AC6: Platform-specific navigation gestures
          gestureEnabled: true, // Enable swipe-back gesture
          fullScreenGestureEnabled: Platform.OS === 'ios', // iOS: swipe from anywhere on screen
          gestureDirection: 'horizontal', // Horizontal swipe for back navigation
          animationTypeForReplace: 'push', // Smooth transition when replacing screen
        }}
      />
    </Stack.Navigator>
  );
}
