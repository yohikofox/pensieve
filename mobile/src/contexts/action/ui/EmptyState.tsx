/**
 * EmptyState Component
 * Story 5.2 - Subtask 2.4-2.5: Empty state for Actions screen
 *
 * AC5: Empty state with "Jardin d'idées" metaphor and subtle animation
 *
 * Code Review Fix #6: AC5 implementation decision
 * - Reanimated fade-in animation (600ms) provides subtle life to empty state
 * - Emoji-based illustration (🌸) chosen for simplicity and performance
 * - Lottie animation deferred: adds ~500KB bundle size, may implement in future iteration
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
      {/* Garden illustration with subtle animation (AC5) */}
      <View className="w-32 h-32 bg-primary-subtle rounded-full items-center justify-center mb-6">
        <Text className="text-6xl">🌸</Text>
      </View>

      {/* Title */}
      <Text className="text-text-primary text-xl font-bold text-center mb-2">
        {t('actions.empty.title')}
      </Text>

      {/* Description */}
      <Text className="text-text-secondary text-base text-center">
        {t('actions.empty.description')}
      </Text>
    </Animated.View>
  );
};
