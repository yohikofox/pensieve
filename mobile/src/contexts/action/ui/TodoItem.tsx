/**
 * TodoItem Component - Display individual todo with checkbox and details
 *
 * Story 5.1 - Task 4: TodoItem Component (AC4, AC5, AC8)
 * Subtask 4.1: Create TodoItem component (receives todo, onToggle, onTap props)
 * Subtask 4.2-4.9: Render checkbox, description, deadline, priority, styling
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Todo, TodoPriority } from '../domain/Todo.model';
import { useTheme } from '../../../hooks/useTheme';
import { colors } from '../../../design-system/tokens';
import { CompletionAnimation } from './CompletionAnimation';
import { formatDeadline, getDeadlineColor } from '../utils/formatDeadline';

interface TodoItemProps {
  todo: Todo;
  onToggle: (todoId: string) => void;
  onTap: (todo: Todo) => void;
}

/**
 * TodoItem - Single todo display with checkbox, description, deadline, priority
 * AC4: Todo detail with deadline and priority
 * AC5: Completed todo visual state (strikethrough, dimmed)
 * AC8: Checkbox toggle with haptic feedback
 */
export const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onTap }) => {
  const { isDark } = useTheme();

  // Determine if todo is completed
  const isCompleted = todo.status === 'completed';

  // Use formatDeadline utility (Issue #6 fix: removed duplication)
  const deadlineFormat = formatDeadline(todo.deadline);

  // Get priority badge color
  const getPriorityColor = (priority: TodoPriority): string => {
    switch (priority) {
      case 'high':
        return isDark ? colors.red[400] : colors.red[500];
      case 'medium':
        return isDark ? colors.yellow[400] : colors.yellow[500];
      case 'low':
        return isDark ? colors.green[400] : colors.green[500];
    }
  };

  // Get priority emoji
  const getPriorityEmoji = (priority: TodoPriority): string => {
    switch (priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
    }
  };

  // Handle checkbox toggle (Subtask 4.9: AC8)
  const handleToggle = async () => {
    // Trigger haptic feedback (medium impact)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    onToggle(todo.id);
  };

  // Truncate description if too long (Subtask 4.3: AC4)
  const truncateDescription = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...plus`;
  };

  const bgColor = isDark ? colors.gray[800] : colors.gray[50];
  const textColor = isDark ? colors.gray[100] : colors.gray[900];
  const mutedColor = isDark ? colors.gray[400] : colors.gray[600];
  const priorityColor = getPriorityColor(todo.priority);
  const deadlineColor = getDeadlineColor(deadlineFormat, isDark);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: bgColor },
        isCompleted && styles.completedContainer,
      ]}
      onPress={() => onTap(todo)}
      activeOpacity={0.7}
    >
      {/* Checkbox with completion animation (Subtask 4.2: AC8, Task 8) */}
      <TouchableOpacity
        onPress={handleToggle}
        style={styles.checkboxContainer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <CompletionAnimation isCompleted={isCompleted}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: isCompleted ? priorityColor : mutedColor,
                backgroundColor: isCompleted ? priorityColor : 'transparent',
              },
            ]}
          >
            {isCompleted && <Feather name="check" size={14} color={colors.white} />}
          </View>
        </CompletionAnimation>
      </TouchableOpacity>

      {/* Todo content */}
      <View style={styles.content}>
        {/* Description (Subtask 4.3: AC4) */}
        <Text
          style={[
            styles.description,
            { color: textColor },
            isCompleted && styles.completedText,
          ]}
          numberOfLines={2}
        >
          {truncateDescription(todo.description)}
        </Text>

        {/* Deadline and Priority row (Subtask 4.4, 4.5, 4.7: AC4) */}
        <View style={styles.metaRow}>
          {/* Deadline */}
          {todo.deadline && (
            <View style={styles.deadlineContainer}>
              <Feather
                name="clock"
                size={12}
                color={deadlineColor}
                style={styles.icon}
              />
              <Text
                style={[
                  styles.deadline,
                  { color: deadlineColor },
                ]}
              >
                {deadlineFormat.text}
              </Text>
            </View>
          )}

          {/* Priority Badge (Subtask 4.5: AC4) */}
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityEmoji}>{getPriorityEmoji(todo.priority)}</Text>
            <Text style={[styles.priorityText, { color: priorityColor }]}>
              {todo.priority === 'high' ? 'Haute' : todo.priority === 'medium' ? 'Moyenne' : 'Basse'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  completedContainer: {
    opacity: 0.6, // Subtask 4.6: AC5 - dimmed
  },
  checkboxContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  completedText: {
    textDecorationLine: 'line-through', // Subtask 4.6: AC5 - strikethrough
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  deadline: {
    fontSize: 12,
    lineHeight: 16,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityEmoji: {
    fontSize: 10,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
