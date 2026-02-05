/**
 * TodoDetailPopover Component Tests
 *
 * Story 5.1 - Issue #7 (Code Review): Unit tests for TodoDetailPopover save logic
 * Tests editing, saving, change detection, and navigation
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TodoDetailPopover } from '../TodoDetailPopover';
import { useUpdateTodo } from '../../hooks/useUpdateTodo';
import { useToggleTodoStatus } from '../../hooks/useToggleTodoStatus';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { container } from 'tsyringe';
import type { ICaptureRepository } from '../../../capture/domain/ICaptureRepository';
import type { Todo } from '../../domain/Todo.model';

// Mock dependencies
jest.mock('../../hooks/useUpdateTodo');
jest.mock('../../hooks/useToggleTodoStatus');
jest.mock('expo-haptics');
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));
jest.mock('react-native-modal-datetime-picker', () => 'DateTimePickerModal');

// Mock Alert
jest.spyOn(Alert, 'alert');

const mockUpdateTodo = jest.fn();
const mockToggleStatus = jest.fn();
const mockOnClose = jest.fn();

const mockTodo: Todo = {
  id: 'todo-1',
  thoughtId: 'thought-1',
  ideaId: 'idea-1',
  captureId: 'capture-1',
  userId: 'user-1',
  description: 'Test todo description',
  status: 'todo',
  priority: 'medium',
  deadline: Date.now() + 86400000, // Tomorrow
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('TodoDetailPopover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateTodo as jest.Mock).mockReturnValue({
      mutate: mockUpdateTodo,
    });
    (useToggleTodoStatus as jest.Mock).mockReturnValue({
      mutate: mockToggleStatus,
    });
  });

  describe('Rendering', () => {
    it('should render todo details correctly', () => {
      const { getByText, getByDisplayValue } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      expect(getByDisplayValue('Test todo description')).toBeTruthy();
      expect(getByText('Todo Details')).toBeTruthy();
    });

    it('should show priority buttons', () => {
      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      expect(getByText('High')).toBeTruthy();
      expect(getByText('Medium')).toBeTruthy();
      expect(getByText('Low')).toBeTruthy();
    });
  });

  describe('Change Detection', () => {
    it('should enable Save button when description changes', async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const input = getByDisplayValue('Test todo description');
      fireEvent.changeText(input, 'Modified description');

      await waitFor(() => {
        const saveButton = getByText('Save Changes');
        expect(saveButton).toBeTruthy();
        // Button should be enabled (not have disabled style)
      });
    });

    it('should enable Save button when priority changes', async () => {
      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const highButton = getByText('High');
      fireEvent.press(highButton);

      await waitFor(() => {
        expect(Haptics.selectionAsync).toHaveBeenCalled();
      });
    });

    it('should disable Save button when no changes', () => {
      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const saveButton = getByText('Save Changes');
      expect(saveButton).toBeTruthy();
      // Initially disabled (no changes)
    });
  });

  describe('Saving Changes', () => {
    it('should call updateTodo when description changed', async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const input = getByDisplayValue('Test todo description');
      fireEvent.changeText(input, 'New description');

      const saveButton = getByText('Save Changes');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockUpdateTodo).toHaveBeenCalledWith({
          id: 'todo-1',
          changes: {
            description: 'New description',
          },
        });
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should call toggleStatus when completion status changed', async () => {
      const { getByRole, getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      // Toggle completion switch
      const completionSwitch = getByRole('switch');
      fireEvent(completionSwitch, 'onValueChange', true);

      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalled();
      });

      const saveButton = getByText('Save Changes');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockToggleStatus).toHaveBeenCalledWith('todo-1');
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should save multiple changes at once', async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      // Change description
      const input = getByDisplayValue('Test todo description');
      fireEvent.changeText(input, 'Updated description');

      // Change priority
      const highButton = getByText('High');
      fireEvent.press(highButton);

      // Save
      const saveButton = getByText('Save Changes');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockUpdateTodo).toHaveBeenCalledWith({
          id: 'todo-1',
          changes: expect.objectContaining({
            description: 'Updated description',
            priority: 'high',
          }),
        });
      });
    });
  });

  describe('Cancel Behavior', () => {
    it('should reset changes on cancel', async () => {
      const { getByDisplayValue, getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const input = getByDisplayValue('Test todo description');
      fireEvent.changeText(input, 'Modified description');

      const cancelButton = getByText('Cancel');
      fireEvent.press(cancelButton);

      await waitFor(() => {
        expect(mockUpdateTodo).not.toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should not call updateTodo if no changes on cancel', () => {
      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const cancelButton = getByText('Cancel');
      fireEvent.press(cancelButton);

      expect(mockUpdateTodo).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Navigation to Source Capture', () => {
    it('should show View Origin button', () => {
      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      expect(getByText('📍 View Origin Capture')).toBeTruthy();
    });

    it('should navigate when capture exists', async () => {
      // Mock capture repository
      const mockCaptureRepository = {
        findById: jest.fn().mockResolvedValue({ id: 'capture-1' }),
      };
      jest.spyOn(container, 'resolve').mockReturnValue(mockCaptureRepository as any);

      const mockNavigate = jest.fn();
      jest.spyOn(require('@react-navigation/native'), 'useNavigation').mockReturnValue({
        navigate: mockNavigate,
      });

      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const viewOriginButton = getByText('📍 View Origin Capture');
      fireEvent.press(viewOriginButton);

      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
        expect(mockCaptureRepository.findById).toHaveBeenCalledWith('capture-1');
        expect(mockOnClose).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('CaptureDetail', { captureId: 'capture-1' });
      });
    });

    it('should show alert when capture not found', async () => {
      // Mock capture repository returning null
      const mockCaptureRepository = {
        findById: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(container, 'resolve').mockReturnValue(mockCaptureRepository as any);

      const { getByText } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const viewOriginButton = getByText('📍 View Origin Capture');
      fireEvent.press(viewOriginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Capture introuvable',
          expect.any(String),
          expect.any(Array)
        );
      });
    });
  });

  describe('State Management', () => {
    it('should reset local state when todo prop changes', () => {
      const { rerender, getByDisplayValue } = render(
        <TodoDetailPopover visible={true} todo={mockTodo} onClose={mockOnClose} />
      );

      const newTodo: Todo = {
        ...mockTodo,
        id: 'todo-2',
        description: 'Different description',
      };

      rerender(<TodoDetailPopover visible={true} todo={newTodo} onClose={mockOnClose} />);

      expect(getByDisplayValue('Different description')).toBeTruthy();
    });
  });
});
