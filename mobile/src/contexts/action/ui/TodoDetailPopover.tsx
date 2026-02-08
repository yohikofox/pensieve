/**
 * TodoDetailPopover Component
 *
 * Story 5.1 - Task 6: Todo Detail Popover (AC6, FR20)
 * Modal/bottom sheet for viewing and editing todo details
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp as RNNavigationProp } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import * as Haptics from 'expo-haptics';
import { container } from 'tsyringe';
import { useTheme } from '../../../hooks/useTheme';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Todo, TodoPriority } from '../domain/Todo.model';
import { useUpdateTodo } from '../hooks/useUpdateTodo';
import { useToggleTodoStatus } from '../hooks/useToggleTodoStatus';
import { useDeleteTodo } from '../hooks/useDeleteTodo';
import { formatDeadline, getDeadlineColor } from '../utils/formatDeadline';
import { TOKENS } from '../../../infrastructure/di/tokens';
import type { ICaptureRepository } from '../../capture/domain/ICaptureRepository';
import {
  colors,
  getPrimaryPaletteForColorScheme,
  getBackgroundColorsForColorScheme,
  type ColorScheme,
} from '../../../design-system/tokens';

interface TodoDetailPopoverProps {
  visible: boolean;
  todo: Todo;
  onClose: () => void;
}

type MainTabParamList = {
  Captures: {
    screen: string;
    params: {
      captureId: string;
      highlightIdeaId?: string;
      highlightTodoId?: string;
    };
  };
};

type NavigationProp = RNNavigationProp<MainTabParamList>;

/**
 * TodoDetailPopover - Subtask 6.1-6.10
 * Full-featured modal for editing todo details with navigation to source capture
 */
export const TodoDetailPopover: React.FC<TodoDetailPopoverProps> = ({
  visible,
  todo,
  onClose,
}) => {
  const { isDark, colorSchemePreference } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const debugMode = useSettingsStore((state) => state.debugMode);
  const updateTodo = useUpdateTodo();
  const toggleStatus = useToggleTodoStatus();
  const deleteTodo = useDeleteTodo();

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
    // CODE REVIEW FIX #8: Validate description is not empty
    const trimmedDescription = description.trim();
    if (trimmedDescription === '') {
      Alert.alert(
        'Description requise',
        'La description de l\'action ne peut pas être vide.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    const changes: Partial<Todo> = {};
    if (trimmedDescription !== todo.description) changes.description = trimmedDescription;
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

    // CODE REVIEW FIX #12: Haptic AFTER successful save (not before)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
    // CODE REVIEW FIX #12: Set state first, then haptic feedback
    setIsCompleted(value);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Subtask 6.7-6.8 + 7.7: Navigate to source Idea/Capture (FR20) with error handling
  const handleViewOrigin = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Task 7.7: Verify capture exists before navigating
      const captureRepository = container.resolve<ICaptureRepository>(TOKENS.ICaptureRepository);
      const capture = await captureRepository.findById(todo.captureId);

      if (!capture) {
        // Capture not found or deleted - show error alert
        Alert.alert(
          'Capture introuvable',
          'La capture d\'origine n\'existe plus ou a été supprimée.',
          [
            {
              text: 'OK',
              style: 'default',
            },
          ]
        );
        return;
      }

      // Capture exists - navigate to detail screen with highlight params (Story 5.4 - AC7, AC8)
      // CODE REVIEW FIX #3: Only pass highlightIdeaId if ideaId is defined
      onClose();
      navigation.navigate('Captures', {
        screen: 'CaptureDetail',
        params: {
          captureId: todo.captureId,
          ...(todo.ideaId && { highlightIdeaId: todo.ideaId }),
          highlightTodoId: todo.id,
        },
      });
    } catch (error) {
      // Navigation or database error
      console.error('[TodoDetailPopover] Error navigating to capture:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'accéder à la capture d\'origine. Veuillez réessayer.',
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Supprimer cette action ?',
      'Cette action sera définitivement supprimée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            deleteTodo.mutate(todo.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
          },
        },
      ]
    );
  };

  const deadlineFormat = formatDeadline(deadline);
  const deadlineColor = getDeadlineColor(deadlineFormat, isDark);

  const styles = useMemo(() => createStyles(isDark, colorSchemePreference), [isDark, colorSchemePreference]);

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
                placeholderTextColor={isDark ? colors.neutral[400] : colors.neutral[500]}
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

            {/* Contact (read-only) */}
            {todo.contact && (
              <View style={styles.section}>
                <Text style={styles.label}>Contact</Text>
                <Text style={styles.contactDisplay}>👤 {todo.contact}</Text>
              </View>
            )}

            {/* Subtask 6.5: Priority selector */}
            <View style={styles.section}>
              <Text style={styles.label}>Priority</Text>
              <View style={styles.priorityRow}>
                <TouchableOpacity
                  style={[
                    styles.priorityButton,
                    priority === 'high' && styles.priorityButtonActive,
                    { borderColor: colors.error[600] },
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
                    { borderColor: colors.warning[500] },
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
                    { borderColor: colors.success[500] },
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
                    false: isDark ? colors.neutral[700] : colors.neutral[300],
                    true: colors.success[isDark ? 500 : 600],
                  }}
                  thumbColor={isCompleted ? colors.neutral[0] : colors.neutral[100]}
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

            {/* Delete button - debug mode only */}
            {debugMode && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Supprimer</Text>
                </TouchableOpacity>
              </View>
            )}
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
const createStyles = (isDark: boolean, colorScheme: ColorScheme) => {
  const primaryPalette = getPrimaryPaletteForColorScheme(colorScheme);
  const backgrounds = getBackgroundColorsForColorScheme(colorScheme, isDark);

  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: backgrounds.elevated,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      ...Platform.select({
        ios: {
          shadowColor: colors.neutral[1000],
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
      borderBottomColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDark ? colors.neutral[50] : colors.neutral[900],
    },
    closeButton: {
      fontSize: 24,
      color: isDark ? colors.neutral[400] : colors.neutral[500],
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
      color: isDark ? colors.neutral[200] : colors.neutral[700],
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: backgrounds.input,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: isDark ? colors.neutral[50] : colors.neutral[900],
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
      minHeight: 100,
    },
    contactDisplay: {
      fontSize: 16,
      color: isDark ? colors.neutral[300] : colors.neutral[600],
      backgroundColor: backgrounds.input,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
    },
    deadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    deadlineButton: {
      flex: 1,
      backgroundColor: backgrounds.input,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: isDark ? colors.neutral[600] : colors.neutral[300],
    },
    deadlineText: {
      fontSize: 16,
      fontWeight: '500',
    },
    clearButton: {
      backgroundColor: backgrounds.subtle,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.neutral[50] : colors.neutral[700],
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
      backgroundColor: backgrounds.input,
      borderRadius: 8,
      padding: 12,
      borderWidth: 2,
    },
    priorityButtonActive: {
      backgroundColor: backgrounds.subtle,
    },
    priorityEmoji: {
      fontSize: 18,
    },
    priorityLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? colors.neutral[400] : colors.neutral[500],
    },
    priorityLabelActive: {
      color: isDark ? colors.neutral[50] : colors.neutral[900],
      fontWeight: '600',
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    viewOriginButton: {
      backgroundColor: primaryPalette[isDark ? 800 : 500],
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    viewOriginText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.neutral[0],
    },
    deleteButton: {
      backgroundColor: isDark ? colors.error[900] : colors.error[50],
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.error[600],
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.error[600],
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: isDark ? colors.neutral[700] : colors.neutral[200],
    },
    button: {
      flex: 1,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: backgrounds.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? colors.neutral[50] : colors.neutral[700],
    },
    saveButton: {
      backgroundColor: colors.success[isDark ? 500 : 600],
    },
    saveButtonDisabled: {
      backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300],
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.neutral[0],
    },
    saveButtonTextDisabled: {
      color: isDark ? colors.neutral[500] : colors.neutral[400],
    },
  });
};
