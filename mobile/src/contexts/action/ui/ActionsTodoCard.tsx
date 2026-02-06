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
import { View, Text, Pressable } from 'react-native';
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

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleToggle = () => {
    // Haptic feedback (Code Review Fix #7: respect user preference)
    if (hapticFeedbackEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Task 4: Trigger celebration animation only when marking complete
    if (todo.status === 'todo') {
      setShowGardenCelebration(true);
    }

    // Toggle status (animation handled by CompletionAnimation component)
    toggleStatus.mutate(todo.id);
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
        className="bg-background-0 dark:bg-background-900 p-4 mb-2 rounded-lg active:opacity-80"
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
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-border-secondary dark:border-border-secondary-dark'
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
              className={`text-content-primary dark:text-content-primary-dark text-base mb-1 ${
                todo.status === 'completed' ? 'line-through' : ''
              }`}
              numberOfLines={2}
            >
              {todo.description}
            </Animated.Text>

            {/* Source Preview */}
            {sourcePreview && (
              <Text
                className="text-content-tertiary dark:text-content-tertiary-dark text-sm mb-2"
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
                <Text className="text-content-secondary dark:text-content-secondary-dark text-xs">
                  📅 {formatDeadline(todo.deadline)}
                </Text>
              )}

              {/* Source Timestamp */}
              {sourceTimestamp && (
                <Text className="text-content-tertiary dark:text-content-tertiary-dark text-xs">
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
