/**
 * InlineTodoList Component - Display todos inline with parent Idea
 *
 * Story 5.1 - Task 3: Inline Todo List Component (AC1, AC2, AC3, AC4, AC5, AC7)
 * Subtask 3.1-3.8: Fetch todos, sort, render, hide if empty, visual grouping
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTodos } from '../hooks/useTodos';
import { useToggleTodoStatus } from '../hooks/useToggleTodoStatus';
import { TodoItem } from './TodoItem';
import { TodoDetailPopover } from './TodoDetailPopover';
import { Todo } from '../domain/Todo.model';
import { useTheme } from '../../../hooks/useTheme';
import { colors } from '../../../design-system/tokens';

interface InlineTodoListProps {
  ideaId: string;
}

/**
 * InlineTodoList - Display todos for a specific idea with inline styling
 * AC1: Inline display with parent idea
 * AC2: Multiple todos sorted by priority
 * AC3: No actions - clean display (hide if empty)
 * AC6: Todo detail popover on tap
 * AC7: Consistent styling across feed
 */
export const InlineTodoList: React.FC<InlineTodoListProps> = ({ ideaId }) => {
  const { isDark } = useTheme();

  // Subtask 3.2: Fetch todos using useTodos hook
  const { data: todos, isLoading, error } = useTodos(ideaId);

  // Subtask 5.1: Toggle todo status mutation
  const toggleMutation = useToggleTodoStatus();

  // Subtask 6.1: Todo detail popover state
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  // Handle checkbox toggle (AC8)
  const handleToggle = (todoId: string) => {
    toggleMutation.mutate(todoId);
  };

  // Handle todo tap (AC6) - Open detail popover
  const handleTodoTap = (todo: Todo) => {
    setSelectedTodo(todo);
  };

  // Close popover
  const handleClosePopover = () => {
    setSelectedTodo(null);
  };

  // Subtask 3.5: AC3 - Hide section if todos array is empty
  if (!todos || todos.length === 0) {
    return null;
  }

  // Loading state (Subtask 2.3)
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.gray[900] : colors.blue[50] }]}>
        <ActivityIndicator size="small" color={isDark ? colors.blue[400] : colors.blue[600]} />
      </View>
    );
  }

  // Error state (Subtask 2.3)
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? colors.gray[900] : colors.red[50] }]}>
        <Text style={[styles.errorText, { color: isDark ? colors.red[400] : colors.red[600] }]}>
          Erreur lors du chargement des actions
        </Text>
      </View>
    );
  }

  // Subtask 3.3: Sorting is already handled by TodoRepository.findByIdeaId()
  // Issue #12 fix: Removed redundant client-side sorting (trust repository SQL sorting)
  // Repository sorts by: CASE status, CASE priority, created_at
  const sortedTodos = todos;

  const bgColor = isDark ? colors.gray[900] : colors.blue[50];
  const borderColor = isDark ? colors.gray[700] : colors.blue[200];
  const headerColor = isDark ? colors.blue[300] : colors.blue[700];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
        },
      ]}
    >
      {/* Header (Subtask 3.7: AC7 - Consistent styling) */}
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: headerColor }]}>
          Actions à réaliser ({sortedTodos.length})
        </Text>
      </View>

      {/* Todo list (Subtask 3.4: Render each todo with TodoItem) */}
      <View style={styles.todoList}>
        {sortedTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={handleToggle}
            onTap={handleTodoTap}
          />
        ))}
      </View>

      {/* Todo detail popover (Subtask 6.1: AC6) */}
      {selectedTodo && (
        <TodoDetailPopover
          visible={!!selectedTodo}
          todo={selectedTodo}
          onClose={handleClosePopover}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Subtask 3.6: Visual grouping (border, background, padding)
  container: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  header: {
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  todoList: {
    gap: 0, // Handled by TodoItem marginBottom
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
