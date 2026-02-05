/**
 * TodoDetailPopover Component
 *
 * Story 5.1 - Task 6: Todo Detail Popover (AC6, FR20)
 * Modal/bottom sheet for viewing and editing todo details
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../hooks/useTheme';
import type { Todo, TodoPriority } from '../domain/Todo.model';
import { useUpdateTodo } from '../hooks/useUpdateTodo';
import { useToggleTodoStatus } from '../hooks/useToggleTodoStatus';
import { formatDeadline, getDeadlineColor } from '../utils/formatDeadline';

interface TodoDetailPopoverProps {
  visible: boolean;
  todo: Todo;
  onClose: () => void;
}

type CapturesStackParamList = {
  CaptureDetail: { captureId: string };
};

type NavigationProp = NativeStackNavigationProp<CapturesStackParamList>;

/**
 * TodoDetailPopover - Subtask 6.1-6.10
 * Full-featured modal for editing todo details with navigation to source capture
 */
export const TodoDetailPopover: React.FC<TodoDetailPopoverProps> = ({
  visible,
  todo,
  onClose,
}) => {
  const { isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const updateTodo = useUpdateTodo();
  const toggleStatus = useToggleTodoStatus();

  // Local state for editing
  const [description, setDescription] = useState(todo.description);
  const [priority, setPriority] = useState<TodoPriority>(todo.priority);
  const [deadline, setDeadline] = useState<number | undefined>(todo.deadline);
  const [isCompleted, setIsCompleted] = useState(todo.status === 'completed');
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Subtask 6.2: Reset local state when todo changes
  useEffect(() => {
    setDescription(todo.description);
    setPriority(todo.priority);
    setDeadline(todo.deadline);
    setIsCompleted(todo.status === 'completed');
    setHasChanges(false);
  }, [todo]);

  // Track if changes have been made
  useEffect(() => {
    const changed =
      description !== todo.description ||
      priority !== todo.priority ||
      deadline !== todo.deadline ||
      isCompleted !== (todo.status === 'completed');
    setHasChanges(changed);
  }, [description, priority, deadline, isCompleted, todo]);

  // Subtask 6.3: Save changes
  const handleSave = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const changes: Partial<Todo> = {};
    if (description !== todo.description) changes.description = description;
    if (priority !== todo.priority) changes.priority = priority;
    if (deadline !== todo.deadline) changes.deadline = deadline;

    // Update description/priority/deadline
    if (Object.keys(changes).length > 0) {
      updateTodo.mutate({ id: todo.id, changes });
    }

    // Toggle status if needed
    if (isCompleted !== (todo.status === 'completed')) {
      toggleStatus.mutate(todo.id);
    }

    onClose();
  };

  const handleCancel = () => {
    setDescription(todo.description);
    setPriority(todo.priority);
    setDeadline(todo.deadline);
    setIsCompleted(todo.status === 'completed');
    setHasChanges(false);
    onClose();
  };

  // Subtask 6.4: Deadline picker handlers
  const handleConfirmDeadline = (date: Date) => {
    setDeadline(date.getTime());
    setDatePickerVisible(false);
  };

  const handleClearDeadline = () => {
    setDeadline(undefined);
  };

  // Subtask 6.5: Priority selector handler
  const handlePriorityChange = async (newPriority: TodoPriority) => {
    await Haptics.selectionAsync();
    setPriority(newPriority);
  };

  // Subtask 6.6: Toggle complete/incomplete
  const handleToggleComplete = async (value: boolean) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsCompleted(value);
  };

  // Subtask 6.7-6.8: Navigate to source Idea/Capture (FR20)
  const handleViewOrigin = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    navigation.navigate('CaptureDetail', { captureId: todo.captureId });
  };

  const deadlineFormat = formatDeadline(deadline);
  const deadlineColor = getDeadlineColor(deadlineFormat, isDark);

  const styles = getStyles(isDark);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Todo Details</Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Subtask 6.3: Description editing */}
            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter todo description..."
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Subtask 6.4: Deadline picker */}
            <View style={styles.section}>
              <Text style={styles.label}>Deadline</Text>
              <View style={styles.deadlineRow}>
                <TouchableOpacity
                  style={styles.deadlineButton}
                  onPress={() => setDatePickerVisible(true)}
                >
                  <Text style={[styles.deadlineText, { color: deadlineColor }]}>
                    {deadlineFormat.text}
                  </Text>
                </TouchableOpacity>
                {deadline && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearDeadline}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Subtask 6.5: Priority selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityRow}>
                <TouchableOpacity
                  style={[
                    styles.priorityButton,
                    priority === 'high' && styles.priorityButtonActive,
                    { borderColor: '#dc2626' },
                  ]}
                  onPress={() => handlePriorityChange('high')}
                >
                  <Text style={styles.priorityEmoji}>🔴</Text>
                  <Text
                    style={[
                      styles.priorityLabel,
                      priority === 'high' && styles.priorityLabelActive,
                    ]}
                  >
                    High
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.priorityButton,
                    priority === 'medium' && styles.priorityButtonActive,
                    { borderColor: '#f59e0b' },
                  ]}
                  onPress={() => handlePriorityChange('medium')}
                >
                  <Text style={styles.priorityEmoji}>🟡</Text>
                  <Text
                    style={[
                      styles.priorityLabel,
                      priority === 'medium' && styles.priorityLabelActive,
                    ]}
                  >
                    Medium
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.priorityButton,
                    priority === 'low' && styles.priorityButtonActive,
                    { borderColor: '#10b981' },
                  ]}
                  onPress={() => handlePriorityChange('low')}
                >
                  <Text style={styles.priorityEmoji}>🟢</Text>
                  <Text
                    style={[
                      styles.priorityLabel,
                      priority === 'low' && styles.priorityLabelActive,
                    ]}
                  >
                    Low
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Subtask 6.6: Complete/incomplete toggle */}
            <View style={styles.section}>
              <View style={styles.toggleRow}>
                <Text style={styles.label}>Mark as completed</Text>
                <Switch
                  value={isCompleted}
                  onValueChange={handleToggleComplete}
                  trackColor={{
                    false: isDark ? '#374151' : '#d1d5db',
                    true: isDark ? '#10b981' : '#059669',
                  }}
                  thumbColor={isCompleted ? '#ffffff' : '#f3f4f6'}
                />
              </View>
            </View>

            {/* Subtask 6.7: View Origin button (FR20) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.viewOriginButton}
                onPress={handleViewOrigin}
              >
                <Text style={styles.viewOriginText}>📍 View Origin Capture</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer with Save/Cancel buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                !hasChanges && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!hasChanges}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  !hasChanges && styles.saveButtonTextDisabled,
                ]}
              >
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subtask 6.4: Date picker modal */}
        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          date={deadline ? new Date(deadline) : new Date()}
          onConfirm={handleConfirmDeadline}
          onCancel={() => setDatePickerVisible(false)}
          minimumDate={new Date()}
        />
      </View>
    </Modal>
  );
};

// Subtask 6.9: Styles with smooth transition animations
const getStyles = (isDark: boolean) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        android: {
          elevation: 5,
        },
      }),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#374151' : '#e5e7eb',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? '#f9fafb' : '#111827',
    },
    closeButton: {
      fontSize: 24,
      color: isDark ? '#9ca3af' : '#6b7280',
      fontWeight: '300',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    section: {
      marginBottom: 24,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#e5e7eb' : '#374151',
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: isDark ? '#374151' : '#f9fafb',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? '#f9fafb' : '#111827',
      borderWidth: 1,
      borderColor: isDark ? '#4b5563' : '#d1d5db',
      minHeight: 100,
    },
    deadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    deadlineButton: {
      flex: 1,
      backgroundColor: isDark ? '#374151' : '#f9fafb',
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? '#4b5563' : '#d1d5db',
    },
    deadlineText: {
      fontSize: 16,
      fontWeight: '500',
    },
    clearButton: {
      backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#f9fafb' : '#374151',
    },
    priorityRow: {
      flexDirection: 'row',
      gap: 12,
    },
    priorityButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: isDark ? '#374151' : '#f9fafb',
      borderRadius: 8,
      padding: 12,
      borderWidth: 2,
    },
    priorityButtonActive: {
      backgroundColor: isDark ? '#4b5563' : '#e5e7eb',
    },
    priorityEmoji: {
      fontSize: 18,
    },
    priorityLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#9ca3af' : '#6b7280',
    },
    priorityLabelActive: {
      color: isDark ? '#f9fafb' : '#111827',
      fontWeight: '600',
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewOriginButton: {
      backgroundColor: isDark ? '#1e40af' : '#3b82f6',
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    viewOriginText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#374151' : '#e5e7eb',
    },
    button: {
      flex: 1,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? '#374151' : '#e5e7eb',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f9fafb' : '#374151',
    },
    saveButton: {
      backgroundColor: isDark ? '#10b981' : '#059669',
    },
    saveButtonDisabled: {
      backgroundColor: isDark ? '#374151' : '#d1d5db',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    saveButtonTextDisabled: {
      color: isDark ? '#6b7280' : '#9ca3af',
    },
  });
