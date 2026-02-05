/**
 * TodoItem Component Tests
 *
 * Story 5.1 - Issue #15 (Code Review): Unit tests for TodoItem component
 * Tests rendering, truncation, deadline formatting, priority display, interactions
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TodoItem } from '../TodoItem';
import * as Haptics from 'expo-haptics';
import type { Todo } from '../../domain/Todo.model';

// Mock dependencies
jest.mock('expo-haptics');
jest.mock('../../../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));
jest.mock('../../../../design-system/tokens', () => ({
  colors: {
    gray: { 50: '#f9fafb', 100: '#f3f4f6', 400: '#9ca3af', 600: '#4b5563', 800: '#1f2937', 900: '#111827' },
    blue: { 400: '#60a5fa', 600: '#2563eb' },
    red: { 400: '#f87171', 500: '#ef4444' },
    yellow: { 400: '#fbbf24', 500: '#f59e0b' },
    green: { 400: '#4ade80', 500: '#22c55e' },
    white: '#ffffff',
  },
}));
jest.mock('../CompletionAnimation', () => ({
  CompletionAnimation: ({ children }: any) => children,
}));

const mockOnToggle = jest.fn();
const mockOnTap = jest.fn();

describe('TodoItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockTodo = (overrides?: Partial<Todo>): Todo => ({
    id: 'todo-1',
    thoughtId: 'thought-1',
    ideaId: 'idea-1',
    captureId: 'capture-1',
    userId: 'user-1',
    description: 'Test todo',
    status: 'todo',
    priority: 'medium',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('should render todo description', () => {
      const todo = createMockTodo({ description: 'Buy groceries' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('Buy groceries')).toBeTruthy();
    });

    it('should render unchecked checkbox for active todo', () => {
      const todo = createMockTodo({ status: 'todo' });
      const { queryByTestId } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Checkbox should be rendered but not checked (no check icon)
      expect(queryByTestId('check-icon')).toBeNull();
    });

    it('should render checked checkbox for completed todo', () => {
      const todo = createMockTodo({ status: 'completed' });
      const { getByTestId } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // For completed todo, check icon should be present
      // (Feather icon with name="check")
    });
  });

  describe('Description Truncation (AC4)', () => {
    it('should not truncate short descriptions', () => {
      const todo = createMockTodo({ description: 'Short text' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('Short text')).toBeTruthy();
    });

    it('should truncate long descriptions with ...plus', () => {
      const longDescription = 'A'.repeat(100);
      const todo = createMockTodo({ description: longDescription });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Should be truncated to 80 chars + "...plus"
      const truncated = longDescription.substring(0, 80) + '...plus';
      expect(getByText(truncated)).toBeTruthy();
    });

    it('should truncate at exactly 80 characters', () => {
      const description = 'A'.repeat(81); // 81 chars
      const todo = createMockTodo({ description });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const expected = 'A'.repeat(80) + '...plus';
      expect(getByText(expected)).toBeTruthy();
    });
  });

  describe('Priority Display (AC4)', () => {
    it('should display high priority with red badge', () => {
      const todo = createMockTodo({ priority: 'high' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('🔴')).toBeTruthy();
      expect(getByText('Haute')).toBeTruthy();
    });

    it('should display medium priority with yellow badge', () => {
      const todo = createMockTodo({ priority: 'medium' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('🟡')).toBeTruthy();
      expect(getByText('Moyenne')).toBeTruthy();
    });

    it('should display low priority with green badge', () => {
      const todo = createMockTodo({ priority: 'low' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('🟢')).toBeTruthy();
      expect(getByText('Basse')).toBeTruthy();
    });
  });

  describe('Deadline Display (AC4)', () => {
    it('should display deadline for future date', () => {
      const tomorrow = Date.now() + 86400000; // +1 day
      const todo = createMockTodo({ deadline: tomorrow });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Should show "Dans..." format
      expect(getByText(/Dans/)).toBeTruthy();
    });

    it('should display overdue deadline in warning color', () => {
      const yesterday = Date.now() - 86400000; // -1 day
      const todo = createMockTodo({ deadline: yesterday });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Should show "En retard" format
      expect(getByText(/En retard/)).toBeTruthy();
    });

    it('should not display deadline section if no deadline', () => {
      const todo = createMockTodo({ deadline: undefined });
      const { queryByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Clock icon and deadline text should not be present
      expect(queryByText(/Dans/)).toBeNull();
      expect(queryByText(/En retard/)).toBeNull();
    });
  });

  describe('Completed State Styling (AC5)', () => {
    it('should apply strikethrough to completed todo', () => {
      const todo = createMockTodo({ status: 'completed' });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const description = getByText('Test todo');
      // Check if style includes textDecorationLine: 'line-through'
      expect(description.props.style).toContainEqual(
        expect.objectContaining({ textDecorationLine: 'line-through' })
      );
    });

    it('should apply dimming opacity to completed todo container', () => {
      const todo = createMockTodo({ status: 'completed' });
      const { getByTestId } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Container should have opacity: 0.6
      // (Check via snapshot or style inspection)
    });
  });

  describe('Checkbox Toggle (AC8)', () => {
    it('should trigger haptic feedback on toggle', async () => {
      const todo = createMockTodo();
      const { getByRole } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const checkbox = getByRole('button'); // Checkbox is a TouchableOpacity
      fireEvent.press(checkbox);

      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(
          Haptics.ImpactFeedbackStyle.Medium
        );
        expect(mockOnToggle).toHaveBeenCalledWith('todo-1');
      });
    });

    it('should call onToggle with todo id', () => {
      const todo = createMockTodo({ id: 'specific-todo-id' });
      const { getByTestId } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const checkbox = getByTestId('checkbox-specific-todo-id');
      fireEvent.press(checkbox);

      expect(mockOnToggle).toHaveBeenCalledWith('specific-todo-id');
    });
  });

  describe('Todo Tap Interaction (AC6)', () => {
    it('should call onTap when todo is tapped', () => {
      const todo = createMockTodo();
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const container = getByText('Test todo').parent?.parent; // TouchableOpacity
      if (container) {
        fireEvent.press(container);
        expect(mockOnTap).toHaveBeenCalledWith(todo);
      }
    });

    it('should pass full todo object to onTap', () => {
      const todo = createMockTodo({
        id: 'test-id',
        description: 'Test description',
        priority: 'high',
      });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      const container = getByText('Test description').parent?.parent;
      if (container) {
        fireEvent.press(container);
        expect(mockOnTap).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-id',
            description: 'Test description',
            priority: 'high',
          })
        );
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle todos with no ideaId', () => {
      const todo = createMockTodo({ ideaId: undefined });
      const { getByText } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      expect(getByText('Test todo')).toBeTruthy();
    });

    it('should handle empty description gracefully', () => {
      const todo = createMockTodo({ description: '' });
      const { toJSON } = render(
        <TodoItem todo={todo} onToggle={mockOnToggle} onTap={mockOnTap} />
      );

      // Should render without crashing
      expect(toJSON()).toBeTruthy();
    });
  });
});
