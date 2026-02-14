/**
 * Component Tests: TextCaptureInput
 *
 * Story 2.2 - AC1, AC3, AC5, AC6
 * Tests failing in RED phase - waiting for implementation
 * Run: npm run test:acceptance
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TextCaptureInput } from '@/contexts/capture/ui/TextCaptureInput';
import * as Haptics from 'expo-haptics';

// Mock expo-haptics
jest.mock('expo-haptics');

describe('TextCaptureInput Component Tests', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AC1: Open Text Input Field Immediately', () => {
    it('should render text input field', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Component renders
      // THEN: Text input field is visible
      expect(getByTestId('text-input-field')).toBeTruthy();
    });

    it('should auto-focus text input on mount', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Component mounts
      const textInput = getByTestId('text-input-field');

      // THEN: TextInput has autoFocus prop
      expect(textInput.props.autoFocus).toBe(true);
    });

    it('should display placeholder text', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Text input is empty
      const textInput = getByTestId('text-input-field');

      // THEN: Placeholder is displayed
      expect(textInput.props.placeholder).toBe('Notez votre pensée...');
    });

    it('should support multiline text input', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Check text input configuration
      const textInput = getByTestId('text-input-field');

      // THEN: Multiline is enabled
      expect(textInput.props.multiline).toBe(true);
    });
  });

  describe('AC2: Save Functionality', () => {
    it('should call onSave with text content when save button pressed', async () => {
      // GIVEN: Text content is entered
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByTestId('text-input-field');
      const saveButton = getByTestId('save-text-button');

      fireEvent.changeText(textInput, 'My text capture');

      // WHEN: Save button is pressed
      fireEvent.press(saveButton);

      // THEN: onSave is called with text content
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('My text capture');
      });
    });

    it('should clear text input after save', async () => {
      // GIVEN: Text is entered and saved
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const textInput = getByTestId('text-input-field');
      fireEvent.changeText(textInput, 'To be cleared');
      fireEvent.press(getByTestId('save-text-button'));

      // WHEN: Save completes
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // THEN: Text input is cleared
      expect(textInput.props.value).toBe('');
    });
  });

  describe('AC3: Cancel with Confirmation', () => {
    it('should show confirmation dialog when canceling with unsaved text', () => {
      // GIVEN: Text content is entered
      const { getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Unsaved text');

      // WHEN: Cancel button is pressed
      fireEvent.press(getByTestId('cancel-text-button'));

      // THEN: Confirmation dialog is shown
      expect(getByText('Discard unsaved text?')).toBeTruthy();
    });

    it('should call onCancel when discard is confirmed', () => {
      // GIVEN: Confirmation dialog is shown
      const { getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Will discard');
      fireEvent.press(getByTestId('cancel-text-button'));

      // WHEN: User confirms discard
      fireEvent.press(getByText('Discard'));

      // THEN: onCancel is called
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should not call onCancel when user chooses "Keep Editing"', () => {
      // GIVEN: Confirmation dialog is shown
      const { getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Keep editing');
      fireEvent.press(getByTestId('cancel-text-button'));

      // WHEN: User chooses "Keep Editing"
      fireEvent.press(getByText('Keep Editing'));

      // THEN: onCancel is not called
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('should call onCancel immediately when text is empty', () => {
      // GIVEN: Text input is empty
      const { getByTestId, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Cancel button is pressed
      fireEvent.press(getByTestId('cancel-text-button'));

      // THEN: No confirmation dialog shown
      expect(queryByText('Discard unsaved text?')).toBeNull();

      // AND: onCancel is called immediately
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('AC5: Empty Text Validation', () => {
    it('should disable save button when text is empty', () => {
      // GIVEN: Component is mounted with empty text
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Text is empty
      const saveButton = getByTestId('save-text-button');

      // THEN: Save button is disabled
      expect(saveButton.props.disabled).toBe(true);
    });

    it('should enable save button when text is entered', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Text is entered
      fireEvent.changeText(getByTestId('text-input-field'), 'Valid text');

      // THEN: Save button is enabled
      const saveButton = getByTestId('save-text-button');
      expect(saveButton.props.disabled).toBe(false);
    });

    it('should show validation error when attempting to save empty text', () => {
      // GIVEN: Text is empty
      const { getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Save button is pressed (if somehow not disabled)
      // Force press despite disabled state
      const saveButton = getByTestId('save-text-button');
      fireEvent(saveButton, 'press');

      // THEN: Validation error is shown
      expect(getByText('Please enter some text')).toBeTruthy();
    });

    it('should clear validation error when user starts typing', () => {
      // GIVEN: Validation error is shown
      const { getByTestId, queryByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Trigger validation error
      fireEvent(getByTestId('save-text-button'), 'press');

      // WHEN: User starts typing
      fireEvent.changeText(getByTestId('text-input-field'), 'Text');

      // THEN: Validation error is cleared
      expect(queryByText('Please enter some text')).toBeNull();
    });

    it('should re-disable save button if text is cleared', () => {
      // GIVEN: Text is entered (save enabled)
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Text');

      // WHEN: Text is cleared
      fireEvent.changeText(getByTestId('text-input-field'), '');

      // THEN: Save button is disabled again
      expect(getByTestId('save-text-button').props.disabled).toBe(true);
    });
  });

  describe('AC6: Haptic Feedback on Save', () => {
    it('should trigger haptic feedback when save succeeds', async () => {
      // GIVEN: Valid text is entered
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Success');

      // WHEN: Save button is pressed
      fireEvent.press(getByTestId('save-text-button'));

      // THEN: Haptic feedback is triggered
      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalledWith(
          Haptics.ImpactFeedbackStyle.Medium
        );
      });
    });

    it('should show save animation on successful save', async () => {
      // GIVEN: Valid text is entered
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      fireEvent.changeText(getByTestId('text-input-field'), 'Animated');
      fireEvent.press(getByTestId('save-text-button'));

      // WHEN: Save completes
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });

      // THEN: Save animation is visible
      expect(getByTestId('save-animation')).toBeTruthy();
    });
  });

  describe('UX Requirements', () => {
    it('should limit text input to max 5 lines before scrolling', () => {
      // GIVEN: Component is mounted
      const { getByTestId } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // WHEN: Check text input configuration
      const textInput = getByTestId('text-input-field');

      // THEN: Max height is set (approximately 5 lines)
      expect(textInput.props.style).toMatchObject({
        maxHeight: expect.any(Number), // ~5 lines height
      });
    });

    it('should display character count for long text', () => {
      // GIVEN: Long text is entered
      const { getByTestId, getByText } = render(
        <TextCaptureInput onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const longText = 'A'.repeat(500);
      fireEvent.changeText(getByTestId('text-input-field'), longText);

      // WHEN: Text exceeds threshold (e.g., 200 chars)
      // THEN: Character count is displayed
      expect(getByText('500')).toBeTruthy(); // Or "500 characters"
    });
  });
});
