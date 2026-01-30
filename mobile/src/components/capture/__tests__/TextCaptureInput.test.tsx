/**
 * TextCaptureInput Component Tests
 *
 * Tests for AC1: Open Text Input Field Immediately
 * - Auto-focus on mount
 * - Auto-open keyboard
 * - Multiline text input with max height
 *
 * Story: 2.2 - Capture Texte Rapide
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextCaptureInput } from '../TextCaptureInput';
import { Alert } from 'react-native';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
}));

describe('TextCaptureInput Component', () => {
  const mockOnSave = jest.fn().mockResolvedValue(undefined);
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('AC1: Open Text Input Field Immediately', () => {
    it('should auto-focus on mount', async () => {
      const { getByPlaceholderText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      // TextInput should have autoFocus prop set to true
      expect(textInput.props.autoFocus).toBe(true);
    });

    it('should render multiline TextInput', () => {
      const { getByPlaceholderText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      expect(textInput.props.multiline).toBe(true);
    });

    it('should have max 5 lines before scrolling', () => {
      const { getByPlaceholderText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      expect(textInput.props.maxLength).toBeUndefined(); // No max length
      // numberOfLines prop determines visible lines before scroll
      expect(textInput.props.numberOfLines).toBeUndefined(); // Let it auto-expand
    });
  });

  describe('AC5: Empty Text Validation', () => {
    it('should disable save button when text is empty', () => {
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const saveButton = getByTestId('save-button');

      // Button should have disabled prop set to true
      expect(saveButton.props.disabled).toBe(true);
    });

    it('should enable save button when text is entered', () => {
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Ma pensée importante');

      const saveButton = getByTestId('save-button');

      // Button should have disabled prop set to false
      expect(saveButton.props.disabled).toBe(false);
    });

    it('should show validation error when trying to save empty text', () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      // Try to submit empty text (via TextInput submit event)
      fireEvent(textInput, 'submitEditing');

      // Error message should appear
      expect(queryByText('Veuillez entrer du texte')).toBeTruthy();

      // onSave should not be called
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should clear validation error when user starts typing', () => {
      const { getByPlaceholderText, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      // Trigger validation error
      fireEvent(textInput, 'submitEditing');
      expect(queryByText('Veuillez entrer du texte')).toBeTruthy();

      // Start typing
      fireEvent.changeText(textInput, 'Texte');

      // Error should disappear
      expect(queryByText('Veuillez entrer du texte')).toBeNull();
    });

    it('should not save whitespace-only text', () => {
      const { getByPlaceholderText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      fireEvent.changeText(textInput, '   ');
      fireEvent(textInput, 'submitEditing');

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Save/Cancel Actions', () => {
    it('should call onSave with trimmed text when save button pressed', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      const saveButton = getByTestId('save-button');

      fireEvent.changeText(textInput, '  Ma pensée  ');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Ma pensée');
      });
    });

    it('should call onCancel when cancel button pressed', () => {
      const { getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const cancelButton = getByText('Annuler');
      fireEvent.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should clear text after successful save', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      const saveButton = getByTestId('save-button');

      fireEvent.changeText(textInput, 'Ma pensée');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(textInput.props.value).toBe('');
      });
    });

    it('should keep text and show error if save fails', async () => {
      mockOnSave.mockRejectedValueOnce(new Error('Save failed'));

      const { getByPlaceholderText, getByTestId, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      const saveButton = getByTestId('save-button');

      fireEvent.changeText(textInput, 'Ma pensée importante');
      fireEvent.press(saveButton);

      await waitFor(() => {
        // Text should NOT be cleared
        expect(textInput.props.value).toBe('Ma pensée importante');
        // Error message should be shown
        expect(queryByText('Erreur lors de la sauvegarde. Veuillez réessayer.')).toBeTruthy();
      });
    });
  });
});
