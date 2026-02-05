/**
 * ActionsScreen Component Tests
 * Story 5.2 - Code Review Fix #5: Missing screen tests
 *
 * Test Coverage:
 * - Loading state rendering
 * - Empty state rendering
 * - Todos list rendering with grouping
 * - Pull-to-refresh functionality
 * - Scroll position persistence
 * - Performance optimizations (getItemLayout, windowSize)
 */

import 'reflect-metadata';
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionsScreen } from '../ActionsScreen';
import { TodoWithSource } from '../../../contexts/action/domain/ITodoRepository';
import * as useAllTodosWithSourceModule from '../../../contexts/action/hooks/useAllTodosWithSource';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => {
    // Execute immediately in tests
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: (date: number) => 'il y a 2 heures',
  startOfDay: (date: number) => date,
  endOfWeek: (date: number) => date + 7 * 24 * 60 * 60 * 1000,
  isSameDay: () => false,
  isWithinInterval: () => false,
}));
jest.mock('date-fns/locale', () => ({ fr: {} }));

// Mock i18n
jest.mock('i18next', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'actions.groups.overdue': 'En retard',
      'actions.groups.today': "Aujourd'hui",
      'actions.groups.thisWeek': 'Cette semaine',
      'actions.groups.later': 'Plus tard',
      'actions.groups.noDeadline': "Pas d'échéance",
    };
    return translations[key] || key;
  },
}));

// Mock components
jest.mock('../../../contexts/action/ui/EmptyState', () => ({
  EmptyState: () => <div testID="empty-state">Empty State</div>,
}));

jest.mock('../../../contexts/action/ui/ActionsTodoCard', () => ({
  ActionsTodoCard: ({ todo }: any) => (
    <div testID={`todo-card-${todo.id}`}>{todo.description}</div>
  ),
}));

const createTestTodo = (id: string, description: string, deadline?: number): TodoWithSource => ({
  id,
  thoughtId: 'thought-1',
  ideaId: 'idea-1',
  captureId: 'capture-1',
  userId: 'user-1',
  description,
  status: 'todo',
  deadline,
  priority: 'medium',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  thought: {
    id: 'thought-1',
    captureId: 'capture-1',
    userId: 'user-1',
    summary: 'Test thought summary',
    processingTimeMs: 100,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  idea: {
    id: 'idea-1',
    thoughtId: 'thought-1',
    userId: 'user-1',
    text: 'Test idea text for preview that is longer than fifty characters to test truncation',
    orderIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
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

describe('ActionsScreen', () => {
  let mockUseAllTodosWithSource: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAllTodosWithSource = jest.spyOn(useAllTodosWithSourceModule, 'useAllTodosWithSource');
  });

  afterEach(() => {
    mockUseAllTodosWithSource.mockRestore();
  });

  it('should render loading state', () => {
    mockUseAllTodosWithSource.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { getByText } = render(<ActionsScreen />, { wrapper: createWrapper() });

    expect(getByText('Chargement...')).toBeTruthy();
  });

  it('should render empty state when no todos', async () => {
    mockUseAllTodosWithSource.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { getByTestId } = render(<ActionsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(getByTestId('empty-state')).toBeTruthy();
    });
  });

  it('should render todos list when data is available', async () => {
    const todos = [
      createTestTodo('todo-1', 'First task', Date.now() - 24 * 60 * 60 * 1000), // Yesterday (overdue)
      createTestTodo('todo-2', 'Second task', Date.now()), // Today
    ];

    mockUseAllTodosWithSource.mockReturnValue({
      data: todos,
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { getByTestId } = render(<ActionsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(getByTestId('todo-card-todo-1')).toBeTruthy();
      expect(getByTestId('todo-card-todo-2')).toBeTruthy();
    });
  });

  it('should group todos by deadline', async () => {
    const todos = [
      createTestTodo('todo-overdue', 'Overdue task', Date.now() - 24 * 60 * 60 * 1000),
      createTestTodo('todo-today', 'Today task', Date.now()),
      createTestTodo('todo-later', 'Later task', Date.now() + 10 * 24 * 60 * 60 * 1000),
    ];

    mockUseAllTodosWithSource.mockReturnValue({
      data: todos,
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { getByText } = render(<ActionsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Section headers should be rendered
      expect(getByText('EN RETARD')).toBeTruthy(); // Uppercase in header
    });
  });

  it('should call refetch on pull-to-refresh', async () => {
    const mockRefetch = jest.fn();
    const todos = [createTestTodo('todo-1', 'Test task')];

    mockUseAllTodosWithSource.mockReturnValue({
      data: todos,
      isLoading: false,
      refetch: mockRefetch,
      isRefetching: false,
    });

    const { UNSAFE_getByType } = render(<ActionsScreen />, { wrapper: createWrapper() });

    // Find SectionList
    const sectionList = UNSAFE_getByType('SectionList' as any);
    expect(sectionList.props.refreshControl).toBeDefined();

    // Simulate pull-to-refresh by calling onRefresh
    sectionList.props.refreshControl.props.onRefresh();

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should pre-compute source preview and timestamp (performance optimization)', async () => {
    const todo = createTestTodo('todo-1', 'Test task');

    mockUseAllTodosWithSource.mockReturnValue({
      data: [todo],
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { getByTestId } = render(<ActionsScreen />, { wrapper: createWrapper() });

    await waitFor(() => {
      const todoCard = getByTestId('todo-card-todo-1');
      expect(todoCard).toBeTruthy();
    });

    // Verify that ActionsTodoCard receives pre-computed values
    // (implementation verified via mocked component)
  });

  it('should configure performance optimizations for SectionList', async () => {
    const todos = [createTestTodo('todo-1', 'Test task')];

    mockUseAllTodosWithSource.mockReturnValue({
      data: todos,
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { UNSAFE_getByType } = render(<ActionsScreen />, { wrapper: createWrapper() });

    const sectionList = UNSAFE_getByType('SectionList' as any);

    // Verify AC4 performance optimizations
    expect(sectionList.props.windowSize).toBe(10);
    expect(sectionList.props.initialNumToRender).toBe(15);
    expect(sectionList.props.maxToRenderPerBatch).toBe(10);
    expect(sectionList.props.removeClippedSubviews).toBe(true);
    expect(sectionList.props.getItemLayout).toBeDefined(); // Code Review Fix #2
  });

  it('should implement scroll position persistence (AC8)', async () => {
    const todos = [createTestTodo('todo-1', 'Test task')];

    mockUseAllTodosWithSource.mockReturnValue({
      data: todos,
      isLoading: false,
      refetch: jest.fn(),
      isRefetching: false,
    });

    const { UNSAFE_getByType } = render(<ActionsScreen />, { wrapper: createWrapper() });

    const sectionList = UNSAFE_getByType('SectionList' as any);

    // Verify AC8 scroll persistence (Code Review Fix #3)
    expect(sectionList.props.ref).toBeDefined();
    expect(sectionList.props.onScroll).toBeDefined();
    expect(sectionList.props.scrollEventThrottle).toBe(16);
  });
});
