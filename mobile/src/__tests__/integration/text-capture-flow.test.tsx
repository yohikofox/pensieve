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
import { Alert } from 'react-native';
import { TextCaptureInput } from '../../components/capture/TextCaptureInput';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Medium: 'medium',
  },
}));

// Mock React Native
jest.mock('react-native', () => {
  const React = require('react');
  const RN = {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TextInput: (props: any) =>
      React.createElement('TextInput', {
        ...props,
        testID: props.testID,
        onChangeText: props.onChangeText,
        onSubmitEditing: props.onSubmitEditing,
      }),
    TouchableOpacity: (props: any) =>
      React.createElement(
        'TouchableOpacity',
        {
          ...props,
          onPress: props.onPress,
          testID: props.testID,
          disabled: props.disabled,
        },
        props.children
      ),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Keyboard: {
      dismiss: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    Animated: {
      View: (props: any) => React.createElement('Animated.View', props, props.children),
      Value: jest.fn(function(initialValue: number) {
        this.setValue = jest.fn();
        return this;
      }),
      timing: jest.fn(() => ({
        start: jest.fn((callback?: any) => callback && callback()),
      })),
      spring: jest.fn(() => ({
        start: jest.fn((callback?: any) => callback && callback()),
      })),
      parallel: jest.fn((animations: any[]) => ({
        start: jest.fn((callback?: any) => callback && callback()),
      })),
    },
  };
  return RN;
});

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
      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Texte non sauvegardé');

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

      // Alert should be shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Rejeter la capture?',
        'Le texte non sauvegardé sera perdu.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Continuer l\'édition' }),
          expect.objectContaining({ text: 'Rejeter' }),
        ])
      );

      // onCancel should NOT be called yet (waiting for user choice)
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should close without confirmation if no text entered', () => {
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

      // No alert shown
      expect(Alert.alert).not.toHaveBeenCalled();

      // onCancel called immediately
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should discard text when user confirms', () => {
      // Mock Alert.alert to simulate user clicking "Rejeter"
      (Alert.alert as jest.Mock).mockImplementation(
        (title, message, buttons) => {
          // Find and call the "Rejeter" button's onPress
          const rejectButton = buttons?.find((b: any) => b.text === 'Rejeter');
          if (rejectButton?.onPress) {
            rejectButton.onPress();
          }
        }
      );

      const { getByPlaceholderText, getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByPlaceholderText('Notez votre pensée...');
      fireEvent.changeText(textInput, 'Texte à rejeter');

      const cancelButton = getByTestId('cancel-button');
      fireEvent.press(cancelButton);

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
