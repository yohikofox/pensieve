/**
 * Dev Test Screen for TodoDetailPopover
 * Used to manually test the component in the app
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TodoDetailPopover } from '../../contexts/action/ui/TodoDetailPopover';
import type { Todo } from '../../contexts/action/domain/Todo.model';
import { useTheme } from '../../hooks/useTheme';
import { colors } from '../../design-system/tokens';

export const TodoDetailPopoverTestScreen: React.FC = () => {
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const [visible, setVisible] = useState(false);

  const mockTodo: Todo = {
    id: 'test-todo-1',
    thoughtId: 'test-thought-1',
    ideaId: 'test-idea-1',
    captureId: 'test-capture-1',
    userId: 'test-user-1',
    description: 'Test todo description for manual testing',
    status: 'todo',
    priority: 'high',
    deadline: Date.now() + 86400000, // Tomorrow
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TodoDetailPopover Test Screen</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.buttonText}>Open TodoDetailPopover</Text>
      </TouchableOpacity>

      <TodoDetailPopover
        visible={visible}
        todo={mockTodo}
        onClose={() => setVisible(false)}
      />
    </View>
  );
};

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? colors.neutral[100] : colors.neutral[900],
      marginBottom: 30,
      textAlign: 'center',
    },
    button: {
      backgroundColor: isDark ? colors.primary[600] : colors.primary[500],
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 8,
    },
    buttonText: {
      color: colors.neutral[0],
      fontSize: 16,
      fontWeight: '600',
    },
  });
