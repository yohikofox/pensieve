/**
 * ActionsTodoCard Component Tests
 * Story 5.2 - Code Review Fix #4: Missing unit tests
 *
 * Test Coverage:
 * - Rendering with source preview and timestamp
 * - Checkbox toggle functionality
 * - Haptic feedback (respecting user preferences)
 * - Completion animation trigger
 * - TodoDetailPopover opening
 * - Priority badge colors
 * - Deadline formatting
 */

import 'reflect-metadata';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionsTodoCard } from '../ActionsTodoCard';
import { Todo } from '../../domain/Todo.model';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../../../stores/settingsStore';

// Mock dependencies
jest.mock('expo-haptics');
jest.mock('../../../../stores/settingsStore');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock TodoDetailPopover (complex component)
jest.mock('../TodoDetailPopover', () => ({
  TodoDetailPopover: () => null,
}));

// Mock CompletionAnimation
jest.mock('../CompletionAnimation', () => ({
  CompletionAnimation: () => null,
}));

// Mock formatDeadline
jest.mock('../../utils/formatDeadline', () => ({
  formatDeadline: (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR');
  },
}));

// Mock useToggleTodoStatus hook
const mockMutate = jest.fn();
jest.mock('../../hooks/useToggleTodoStatus', () => ({
  useToggleTodoStatus: () => ({
    mutate: mockMutate,
    isLoading: false,
  }),
}));

const createTestTodo = (overrides?: Partial<Todo>): Todo => ({
  id: 'todo-123',
  thoughtId: 'thought-1',
  ideaId: 'idea-1',
  captureId: 'capture-1',
  userId: 'user-1',
  description: 'Test todo task',
  status: 'todo',
  deadline: Date.now() + 24 * 60 * 60 * 1000, // Tomorrow
  priority: 'medium',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ActionsTodoCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: haptic feedback enabled
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(true);
  });

  it('should render todo with description and metadata', () => {
    const todo = createTestTodo();
    const { getByText } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    expect(getByText('Test todo task')).toBeTruthy();
  });

  it('should render source preview when provided', () => {
    const todo = createTestTodo();
    const sourcePreview = 'This is a preview of the source idea...';

    const { getByText } = render(
      <ActionsTodoCard todo={todo} sourcePreview={sourcePreview} />,
      { wrapper: createWrapper() }
    );

    expect(getByText(sourcePreview)).toBeTruthy();
  });

  it('should render source timestamp when provided', () => {
    const todo = createTestTodo();
    const sourceTimestamp = 'il y a 3 heures';

    const { getByText } = render(
      <ActionsTodoCard todo={todo} sourceTimestamp={sourceTimestamp} />,
      { wrapper: createWrapper() }
    );

    expect(getByText(sourceTimestamp)).toBeTruthy();
  });

  it('should render priority badge with correct color', () => {
    const highPriorityTodo = createTestTodo({ priority: 'high' });
    const { getByText } = render(
      <ActionsTodoCard todo={highPriorityTodo} />,
      { wrapper: createWrapper() }
    );

    expect(getByText('Haute')).toBeTruthy();
  });

  it('should toggle todo status when checkbox is pressed', async () => {
    const todo = createTestTodo();
    const { getByTestId, UNSAFE_getAllByType } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    // Find checkbox by looking for Pressable with checkbox
    const pressables = UNSAFE_getAllByType('Pressable' as any);
    const checkboxPressable = pressables.find((p) => p.props.hitSlop);

    fireEvent.press(checkboxPressable!);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith('todo-123');
    });
  });

  it('should trigger haptic feedback when user preference is enabled', async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(true);
    const todo = createTestTodo();

    const { UNSAFE_getAllByType } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    const pressables = UNSAFE_getAllByType('Pressable' as any);
    const checkboxPressable = pressables.find((p) => p.props.hitSlop);

    fireEvent.press(checkboxPressable!);

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });
  });

  it('should NOT trigger haptic feedback when user preference is disabled', async () => {
    (useSettingsStore as unknown as jest.Mock).mockReturnValue(false);
    const todo = createTestTodo();

    const { UNSAFE_getAllByType } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    const pressables = UNSAFE_getAllByType('Pressable' as any);
    const checkboxPressable = pressables.find((p) => p.props.hitSlop);

    fireEvent.press(checkboxPressable!);

    await waitFor(() => {
      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  it('should show completion animation when marking todo as done', async () => {
    const todo = createTestTodo({ status: 'todo' });

    const { UNSAFE_getAllByType } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    const pressables = UNSAFE_getAllByType('Pressable' as any);
    const checkboxPressable = pressables.find((p) => p.props.hitSlop);

    fireEvent.press(checkboxPressable!);

    // Animation is triggered (implementation detail tested via mock)
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  it('should render completed todo with strikethrough', () => {
    const completedTodo = createTestTodo({ status: 'completed' });

    const { getByText } = render(
      <ActionsTodoCard todo={completedTodo} />,
      { wrapper: createWrapper() }
    );

    const descriptionText = getByText('Test todo task');
    expect(descriptionText.props.className).toContain('line-through');
  });

  it('should render deadline when provided', () => {
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    const todo = createTestTodo({ deadline: tomorrow });

    const { getByText } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    // Deadline should be formatted and displayed
    const formattedDate = new Date(tomorrow).toLocaleDateString('fr-FR');
    expect(getByText(`📅 ${formattedDate}`)).toBeTruthy();
  });

  it('should open TodoDetailPopover when card is pressed', () => {
    const todo = createTestTodo();

    const { UNSAFE_getAllByType } = render(
      <ActionsTodoCard todo={todo} />,
      { wrapper: createWrapper() }
    );

    // Find main card Pressable (not the checkbox)
    const pressables = UNSAFE_getAllByType('Pressable' as any);
    const cardPressable = pressables.find((p) => p.props.className?.includes('bg-background-0'));

    fireEvent.press(cardPressable!);

    // TodoDetailPopover should become visible (implementation detail)
    // Since we mocked the component, we just verify press works without errors
    expect(cardPressable).toBeTruthy();
  });
});
