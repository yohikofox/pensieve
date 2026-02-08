/**
 * ActionsTodoCard Component
 * Story 5.2 - Task 6: Todo card optimized for Actions tab
 *
 * AC6: Todo card preview with source context
 * - Checkbox, description, deadline, priority badge
 * - Truncated preview of source Idea/Capture
 * - Relative timestamp ("3 hours ago")
 * - Tap to open TodoDetailPopover
 * - Checkbox toggle with completion animation
 *
 * Code Review Fix #7: Haptic feedback respects user preferences
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Todo } from '../domain/Todo.model';
import { useToggleTodoStatus } from '../hooks/useToggleTodoStatus';
import { formatDeadline } from '../utils/formatDeadline';
import { CompletionAnimation } from './CompletionAnimation';
import { GardenCelebrationAnimation } from './GardenCelebrationAnimation';
import { TodoDetailPopover } from './TodoDetailPopover';
import { useSettingsStore } from '../../../stores/settingsStore';

interface ActionsTodoCardProps {
  todo: Todo;
  sourcePreview?: string;
  sourceTimestamp?: string;
}

export const ActionsTodoCard: React.FC<ActionsTodoCardProps> = ({
  todo,
  sourcePreview,
  sourceTimestamp,
}) => {
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [showGardenCelebration, setShowGardenCelebration] = useState(false);
  const toggleStatus = useToggleTodoStatus();
  const hapticFeedbackEnabled = useSettingsStore((state) => state.hapticFeedbackEnabled);

  // Task 3: Strikethrough animation with Reanimated
  const opacity = useSharedValue(todo.status === 'completed' ? 0.5 : 1.0);

  useEffect(() => {
    // Animate opacity when status changes
    opacity.value = withTiming(todo.status === 'completed' ? 0.5 : 1.0, {
      duration: 200,
    });
  }, [todo.status]);

  // CODE REVIEW FIX #7: Cleanup celebration animation on unmount
  useEffect(() => {
    return () => {
      // Reset celebration state if component unmounts during animation
      setShowGardenCelebration(false);
    };
  }, []);

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleToggle = () => {
    const wasCompleted = todo.status === 'completed';

    // CODE REVIEW FIX #2 + #9: Haptic and animation AFTER successful mutation
    toggleStatus.mutate(todo.id, {
      onSuccess: () => {
        // Haptic feedback (respect user preference)
        if (hapticFeedbackEnabled) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        // Trigger celebration animation only when marking complete (not on uncomplete)
        if (!wasCompleted) {
          setShowGardenCelebration(true);
        }
      },
      onError: (error) => {
        // CODE REVIEW FIX #2: Error handling with user feedback
        console.error('[ActionsTodoCard] Failed to toggle todo status:', error);
        Alert.alert(
          'Erreur',
          'Impossible de modifier le statut de l\'action. Veuillez réessayer.',
          [{ text: 'OK', style: 'default' }]
        );
      },
    });
  };

  const handleCardPress = () => {
    setIsDetailVisible(true);
  };

  const getPriorityColor = () => {
    switch (todo.priority) {
      case 'high':
        return 'bg-error-500';
      case 'medium':
        return 'bg-warning-500';
      case 'low':
        return 'bg-success-500';
    }
  };

  const getPriorityLabel = () => {
    switch (todo.priority) {
      case 'high':
        return 'Haute';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Basse';
    }
  };

  return (
    <>
      <Pressable
        onPress={handleCardPress}
        className="bg-bg-card p-4 mb-2 rounded-lg active:opacity-80"
      >
        <View className="flex-row items-start">
          {/* Checkbox with completion animation */}
          <Pressable
            onPress={handleToggle}
            className="mr-3 mt-0.5"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CompletionAnimation isCompleted={todo.status === 'completed'}>
              <View
                className={`w-6 h-6 rounded border-2 items-center justify-center ${
                  todo.status === 'completed'
                    ? 'bg-primary-action border-primary-action'
                    : 'border-border-default'
                }`}
              >
                {todo.status === 'completed' && (
                  <Feather name="check" size={16} color="white" />
                )}
              </View>
            </CompletionAnimation>
          </Pressable>

          {/* Content */}
          <View className="flex-1">
            {/* Description with animated strikethrough */}
            <Animated.Text
              style={animatedTextStyle}
              className={`text-text-primary text-base mb-1 ${
                todo.status === 'completed' ? 'line-through' : ''
              }`}
              numberOfLines={2}
            >
              {todo.description}
            </Animated.Text>

            {/* Source Preview */}
            {sourcePreview && (
              <Text
                className="text-text-tertiary text-sm mb-2"
                numberOfLines={1}
              >
                {sourcePreview}
              </Text>
            )}

            {/* Metadata Row */}
            <View className="flex-row items-center flex-wrap gap-2">
              {/* Priority Badge */}
              <View
                className={`${getPriorityColor()} px-2 py-0.5 rounded-full`}
              >
                <Text className="text-white text-xs font-medium">
                  {getPriorityLabel()}
                </Text>
              </View>

              {/* Deadline */}
              {todo.deadline && (
                <Text className="text-text-secondary text-xs">
                  📅 {formatDeadline(todo.deadline).text}
                </Text>
              )}

              {/* Contact */}
              {todo.contact && (
                <Text className="text-text-secondary text-xs">
                  👤 {todo.contact}
                </Text>
              )}

              {/* Source Timestamp */}
              {sourceTimestamp && (
                <Text className="text-text-tertiary text-xs">
                  {sourceTimestamp}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Task 4: Garden Celebration Animation (AC9 - Jardin d'idées) */}
        {showGardenCelebration && (
          <GardenCelebrationAnimation
            trigger={showGardenCelebration}
            onComplete={() => setShowGardenCelebration(false)}
          />
        )}
      </Pressable>

      {/* Detail Popover */}
      <TodoDetailPopover
        todo={todo}
        visible={isDetailVisible}
        onClose={() => setIsDetailVisible(false)}
      />
    </>
  );
};
