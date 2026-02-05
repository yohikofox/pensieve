/**
 * EmptyState Component
 * Story 5.2 - Subtask 2.4-2.5: Empty state for Actions screen
 *
 * AC5: Empty state with "Jardin d'idées" metaphor and subtle animation
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

export const EmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(300)}
      className="flex-1 items-center justify-center px-8"
    >
      {/* Illustration placeholder - TODO: Add Lottie animation */}
      <View className="w-32 h-32 bg-primary-100 dark:bg-primary-900/20 rounded-full items-center justify-center mb-6">
        <Text className="text-6xl">🌸</Text>
      </View>

      {/* Title */}
      <Text className="text-content-primary dark:text-content-primary-dark text-xl font-bold text-center mb-2">
        {t('actions.empty.title')}
      </Text>

      {/* Description */}
      <Text className="text-content-secondary dark:text-content-secondary-dark text-base text-center">
        {t('actions.empty.description')}
      </Text>
    </Animated.View>
  );
};
