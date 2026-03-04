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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, Alert, Animated as RNAnimated, StyleSheet, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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
import { useDeleteTodo } from '../hooks/useDeleteTodo';
import { useAbandonTodo } from '../hooks/useAbandonTodo';
import { useReactivateTodo } from '../hooks/useReactivateTodo';

interface ActionsTodoCardProps {
  todo: Todo;
  sourcePreview?: string;
  sourceTimestamp?: string;
  readonly?: boolean;
}

export const ActionsTodoCard: React.FC<ActionsTodoCardProps> = ({
  todo,
  sourcePreview,
  sourceTimestamp,
  readonly = false,
}) => {
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [showGardenCelebration, setShowGardenCelebration] = useState(false);
  const toggleStatus = useToggleTodoStatus();
  const hapticFeedbackEnabled = useSettingsStore((state) => state.hapticFeedbackEnabled);
  const swipeableRef = useRef<Swipeable>(null);
  const deleteTodo = useDeleteTodo();
  const abandonTodo = useAbandonTodo();
  const reactivateTodo = useReactivateTodo();

  // Subtask 2.4 + 2.5 + 2.6: Confirmation dialog pour le swipe-to-delete (AC2, AC3)
  const handleDeleteWithConfirmation = () => {
    Alert.alert(
      'Supprimer cette tâche ?',
      'Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => swipeableRef.current?.close(),
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            deleteTodo.mutate(todo.id, {
              onSuccess: async () => {
                if (hapticFeedbackEnabled) {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              },
            });
          },
        },
      ]
    );
  };

  // Story 8.14: Render swipe actions (abandon/reactivate + delete)
  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>,
  ) => {
    const totalWidth = 2 * 90;

    const translateX = dragX.interpolate({
      inputRange: [-totalWidth, 0],
      outputRange: [0, totalWidth],
      extrapolate: 'clamp',
    });

    if (todo.status === 'abandoned') {
      // Show: [Réactiver (green)] [Supprimer (red)]
      return (
        <RNAnimated.View style={[swipeStyles.swipeActionsContainer, { width: totalWidth, transform: [{ translateX }] }]}>
          <TouchableOpacity
            style={[swipeStyles.swipeActionButton, swipeStyles.reactivateAction]}
            onPress={() => reactivateTodo.mutate(todo.id)}
          >
            <Text style={swipeStyles.swipeActionEmoji}>↩️</Text>
            <Text style={swipeStyles.swipeActionLabel}>Réactiver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[swipeStyles.swipeActionButton, swipeStyles.deleteActionCompact]}
            onPress={handleDeleteWithConfirmation}
          >
            <Text style={swipeStyles.swipeActionEmoji}>🗑️</Text>
            <Text style={swipeStyles.swipeActionLabel}>Supprimer</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      );
    }

    // Show: [Abandonner (orange)] [Supprimer (red)]
    return (
      <RNAnimated.View style={[swipeStyles.swipeActionsContainer, { width: totalWidth, transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={[swipeStyles.swipeActionButton, swipeStyles.abandonAction]}
          onPress={() => abandonTodo.mutate(todo.id)}
        >
          <Text style={swipeStyles.swipeActionEmoji}>🚫</Text>
          <Text style={swipeStyles.swipeActionLabel}>Abandonner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[swipeStyles.swipeActionButton, swipeStyles.deleteActionCompact]}
          onPress={handleDeleteWithConfirmation}
        >
          <Text style={swipeStyles.swipeActionEmoji}>🗑️</Text>
          <Text style={swipeStyles.swipeActionLabel}>Supprimer</Text>
        </TouchableOpacity>
      </RNAnimated.View>
    );
  };

  // Task 3 + Story 8.14 Task 5: Opacity animation for completed/abandoned states
  const getOpacityForStatus = () => {
    if (todo.status === 'completed') return 0.5;
    if (todo.status === 'abandoned') return 0.6;
    return 1.0;
  };
  const opacity = useSharedValue(getOpacityForStatus());

  useEffect(() => {
    opacity.value = withTiming(getOpacityForStatus(), {
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
      {/* Subtask 2.3 + 2.8: Swipeable désactivé en mode readonly (corbeille) */}
      <Swipeable
        ref={swipeableRef}
        enabled={!readonly}
        friction={2}
        overshootRight={false}
        failOffsetY={[-15, 15]}
        rightThreshold={40}
        renderRightActions={renderRightActions}
      >
      <Pressable
        onPress={handleCardPress}
        className="bg-bg-card p-4 mb-2 rounded-lg active:opacity-80"
      >
        <View className="flex-row items-start">
          {/* Checkbox ou icône corbeille (readonly = supprimé par sync) */}
          {readonly ? (
            <View className="mr-3 mt-0.5 w-6 h-6 items-center justify-center">
              <Feather name="trash-2" size={18} color="#9ca3af" />
            </View>
          ) : todo.status === 'abandoned' ? (
            // Story 8.14 Task 5: Abandoned icon (not a checkbox, not tappable)
            <View className="mr-3 mt-0.5 w-6 h-6 items-center justify-center">
              <Text style={swipeStyles.abandonedIcon}>🚫</Text>
            </View>
          ) : (
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
          )}

          {/* Content */}
          <View className="flex-1">
            {/* Description with animated strikethrough / abandoned muted style */}
            <Animated.Text
              style={[
                animatedTextStyle,
                todo.status === 'abandoned' && swipeStyles.abandonedText,
              ]}
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
      </Swipeable>

      {/* Detail Popover */}
      <TodoDetailPopover
        todo={todo}
        visible={isDetailVisible}
        onClose={() => setIsDetailVisible(false)}
      />
    </>
  );
};

// Story 8.14: Color constants for abandoned state
const ABANDONED_ORANGE = '#F97316'; // Orange-500
const REACTIVATE_GREEN = '#22c55e'; // Green-500
const DELETE_RED = '#ef4444'; // Red-500

const swipeStyles = StyleSheet.create({
  // Story 8.14: Multi-button swipe container
  swipeActionsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  swipeActionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  abandonAction: {
    backgroundColor: ABANDONED_ORANGE,
  },
  reactivateAction: {
    backgroundColor: REACTIVATE_GREEN,
  },
  deleteActionCompact: {
    backgroundColor: DELETE_RED,
  },
  swipeActionEmoji: {
    fontSize: 18,
    color: '#ffffff',
  },
  swipeActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 3,
  },
  // Story 8.14 Task 5: Abandoned visual state
  abandonedIcon: {
    fontSize: 16,
  },
  abandonedText: {
    color: '#9ca3af', // neutral-400: muted, no strikethrough
  },
});
