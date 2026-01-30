/**
 * Integration Tests: Text Capture Flow
 *
 * Tests complete flow from button tap to save
 * - AC1: Open text input immediately
 * - AC2: Save text capture
 * - AC3: Cancel with confirmation
 * - AC5: Empty text validation
 *
 * Story: 2.2 - Capture Texte Rapide
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextCaptureInput } from '../../components/capture/TextCaptureInput';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
}));

describe('Text Capture Flow Integration Tests', () => {
  const mockOnSave = jest.fn().mockResolvedValue(undefined);
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe('AC1: Complete flow - tap → type → save', () => {
    it('should complete full text capture flow', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // User types text
      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Ma nouvelle idée géniale');

      // User taps save button
      const saveButton = getByTestId('save-button');
      fireEvent.press(saveButton);

      // onSave should be called with trimmed text
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Ma nouvelle idée géniale');
      });

      // Text should be cleared after save
      await waitFor(() => {
        expect(textInput.props.value).toBe('');
      });
    });

    it('should trim whitespace from saved text', async () => {
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, '   Texte avec espaces   ');

      const saveButton = getByTestId('save-button');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Texte avec espaces');
      });
    });
  });

  describe('AC3: Cancel flow with confirmation', () => {
    it('should show confirmation dialog when canceling with unsaved text', () => {
      const { getByPlaceholderText, getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Texte non sauvegardé');

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

      // AlertDialog should be shown with confirmation message
      expect(getByText('Rejeter la capture?')).toBeTruthy();
      expect(getByText('Le texte non sauvegardé sera perdu.')).toBeTruthy();
      expect(getByText("Continuer l'édition")).toBeTruthy();
      expect(getByText('Rejeter')).toBeTruthy();

      // onCancel should NOT be called yet (waiting for user choice)
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should close without confirmation if no text entered', () => {
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

      // onCancel called immediately (no confirmation dialog shown)
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should discard text when user confirms', () => {
      const { getByPlaceholderText, getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Texte à rejeter');

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

      // AlertDialog should appear
      expect(getByText('Rejeter la capture?')).toBeTruthy();

      // Click "Rejeter" button in AlertDialog
      const rejectButton = getByText('Rejeter');
      fireEvent.press(rejectButton);

      // onCancel should be called after user confirms
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('AC5: Empty text validation', () => {
    it('should prevent save with empty text', () => {
      const { getByTestId, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const saveButton = getByTestId('save-button');

      // Button should be disabled
      expect(saveButton.props.disabled).toBe(true);

      // Trying to press should not call onSave
      fireEvent.press(saveButton);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should show error message when trying to submit empty text', () => {
      const { getByPlaceholderText, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');

      // Try to submit empty text
      fireEvent(textInput, 'submitEditing');

      // Error message should appear
      expect(queryByText('Veuillez entrer du texte')).toBeTruthy();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });
});
