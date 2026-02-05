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
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Todo } from '../domain/Todo.model';
import { useToggleTodoStatus } from '../hooks/useToggleTodoStatus';
import { formatDeadline } from '../utils/formatDeadline';
import { CompletionAnimation } from './CompletionAnimation';
import { TodoDetailPopover } from './TodoDetailPopover';

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
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const toggleStatus = useToggleTodoStatus();

  const handleToggle = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Show completion animation if marking as done
    if (todo.status === 'todo') {
      setShowCompletionAnimation(true);
      setTimeout(() => setShowCompletionAnimation(false), 1000);
    }

    // Toggle status
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
          {/* Checkbox */}
          <Pressable
            onPress={handleToggle}
            className="mr-3 mt-0.5"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
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
          </Pressable>

          {/* Content */}
          <View className="flex-1">
            {/* Description */}
            <Text
              className={`text-content-primary dark:text-content-primary-dark text-base mb-1 ${
                todo.status === 'completed' ? 'line-through opacity-60' : ''
              }`}
              numberOfLines={2}
            >
              {todo.description}
            </Text>

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

        {/* Completion Animation */}
        {showCompletionAnimation && <CompletionAnimation />}
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
