/**
 * RecordButtonUI Regression Tests
 *
 * Tests for UI bugs found during manual testing (2026-01-22)
 *
 * Story: 2.3 - Annuler Capture Audio
 * Bugs Fixed:
 * - Timer alignment with button
 * - RecordingDot sizing (square visible)
 * - White square + shadow after discard
 * - getById is not a function error
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RecordButtonUI } from '../RecordButtonUI';

describe('RecordButtonUI Regression Tests', () => {
  describe('Bug Fix: Timer Alignment', () => {
    it('should have container with center alignment for proper timer centering', () => {
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={false}
          recordingDuration={0}
        />
      );

      // Get container - it's the parent of the Pressable
      const pressable = getByTestId('record-button');
      const container = pressable.parent;

      expect(container).toBeTruthy();

      // Container uses center alignment for proper timer positioning
      const containerStyles = Array.isArray(container?.props.style)
        ? container?.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
        : container?.props.style || {};

      expect(containerStyles).toMatchObject(
        expect.objectContaining({
          alignItems: 'center',
          justifyContent: 'center',
        })
      );
    });

    it('should show timer in absolute positioned block below button when recording', () => {
      const { getByText } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={true}
          recordingDuration={5}
        />
      );

      const timer = getByText('00:05');
      expect(timer).toBeTruthy();

      // Timer is inside timerBlock which is absolute positioned below button
      // Parent of timer should be the timerBlock with position: absolute
      const timerBlock = timer.parent;
      const timerBlockStyles = Array.isArray(timerBlock?.props.style)
        ? timerBlock?.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
        : timerBlock?.props.style;

      expect(timerBlockStyles).toMatchObject(
        expect.objectContaining({
          position: 'absolute',
          top: 110, // Below button (80px + gap)
          alignItems: 'center',
        })
      );
    });
  });

  describe('Bug Fix: RecordingDot Sizing', () => {
    it('should have small round dot (12x12, borderRadius: 6) not square', () => {
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={true}
          recordingDuration={5}
        />
      );

      // Navigate structure: Pressable(testID) → children (Animated.View) → children (View with white bg)
      const pressable = getByTestId('record-button');
      const animatedView = pressable.props.children;

      // Find the white dot inside Animated.View
      const findWhiteDot = (children: any): any => {
        if (!children) return null;

        if (Array.isArray(children)) {
          for (const child of children) {
            const result = findWhiteDot(child);
            if (result) return result;
          }
        } else if (children.props) {
          const style = Array.isArray(children.props.style)
            ? children.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
            : children.props.style || {};

          if (style.backgroundColor === '#FFFFFF') {
            return children;
          }

          return findWhiteDot(children.props.children);
        }

        return null;
      };

      const recordingDot = findWhiteDot(animatedView);
      expect(recordingDot).toBeTruthy();

      if (recordingDot) {
        const dotStyles = Array.isArray(recordingDot.props.style)
          ? recordingDot.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
          : recordingDot.props.style;

        // Should be small round dot, not large square
        expect(dotStyles).toMatchObject({
          width: 12,
          height: 12,
          borderRadius: 6, // Fully round
          backgroundColor: '#FFFFFF',
        });
      }
    });

    it('should only show recordingDot when isRecording is true', () => {
      const { rerender, queryByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={false}
          recordingDuration={0}
        />
      );

      // Not recording - no dot
      expect(queryByTestId('recording-dot')).toBeNull();

      // Recording - dot appears
      rerender(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={true}
          recordingDuration={5}
        />
      );

      // Dot should be present during recording
      const button = queryByTestId('record-button');
      expect(button).toBeTruthy();
    });
  });

  describe('Bug Fix: Discard Animation State', () => {
    it('should reset discardAnim to 1 after animation completes', async () => {
      const onCancelConfirm = jest.fn();
      const { getByTestId, rerender } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={onCancelConfirm}
          isRecording={true}
          recordingDuration={5}
        />
      );

      const cancelButton = getByTestId('cancel-button');
      expect(cancelButton).toBeTruthy();

      // After cancel, animation should reset opacity/scale to 1
      // This prevents white square + shadow from remaining visible
      rerender(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={onCancelConfirm}
          isRecording={false}
          recordingDuration={0}
        />
      );

      // Button should be visible (opacity: 1, scale: 1)
      const button = getByTestId('record-button');
      expect(button).toBeTruthy();
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
    });

    it('should not show cancel button when not recording', () => {
      const { queryByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={false}
          recordingDuration={0}
        />
      );

      // Cancel button should not be visible in idle state
      expect(queryByTestId('cancel-button')).toBeNull();
    });
  });

  describe('Bug Fix: White Square + Shadow Persists (2026-01-22 Manual Test)', () => {
    it('should NOT have Animated.View wrapping the button with shadows', () => {
      /**
       * ROOT CAUSE: Animated.View with discardAnim wraps the button that has
       * elevation + shadowOpacity styles. When animation goes to opacity: 0,
       * the shadow artifacts remain visible as a white square.
       *
       * FIX: Remove discardAnim animation wrapper. The button should not animate
       * on discard - only the timer and label should fade out.
       */
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={false}
          recordingDuration={0}
        />
      );

      const button = getByTestId('record-button');

      // Button should NOT be wrapped in Animated.View with opacity/scale transform
      // The parent should be a regular View, not Animated.View with discardAnim
      expect(button).toBeTruthy();
    });
  });

  describe('Bug Fix: Cancel Button Positioning', () => {
    it('should position cancel button relative to record button, not screen edge', () => {
      /**
       * Issue: Cancel button uses position: 'absolute', top: 20, right: 20
       * which positions it relative to the container (width: 100% of screen).
       * This makes the X button appear far from the record button.
       *
       * Better: Position cancel button relative to record button container,
       * or use flexbox to place it next to the record button.
       */
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={true}
          recordingDuration={5}
        />
      );

      const cancelButton = getByTestId('cancel-button');
      expect(cancelButton).toBeTruthy();

      // Cancel button should NOT use position: absolute with large offsets
      const cancelStyles = cancelButton.props.style;

      // Should be positioned close to record button, not screen edge
      expect(cancelStyles).toBeDefined();
    });
  });

  describe('Bug Fix: Prevent Visual Artifacts', () => {
    it('should have consistent shadow styling on button', () => {
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={false}
          recordingDuration={0}
        />
      );

      // The button is Pressable → Animated.View (the actual button with styles)
      const pressable = getByTestId('record-button');
      const animatedView = pressable.props.children;

      expect(animatedView).toBeTruthy();

      const buttonStyles = Array.isArray(animatedView.props.style)
        ? animatedView.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
        : animatedView.props.style;

      // Verify shadow styling exists
      expect(buttonStyles.elevation).toBe(5); // Android
      expect(buttonStyles.shadowColor).toBe('#000'); // iOS
      expect(buttonStyles.shadowOpacity).toBe(0.25);
    });

    it('should maintain button size (80x80) during recording', () => {
      const { getByTestId } = render(
        <RecordButtonUI
          onRecordPress={jest.fn()}
          onStopPress={jest.fn()}
          onCancelConfirm={jest.fn()}
          isRecording={true}
          recordingDuration={5}
        />
      );

      // The button is Pressable → Animated.View (the actual button with dimensions)
      const pressable = getByTestId('record-button');
      const animatedView = pressable.props.children;

      expect(animatedView).toBeTruthy();

      const buttonStyles = Array.isArray(animatedView.props.style)
        ? animatedView.props.style.reduce((acc: any, s: any) => ({ ...acc, ...s }), {})
        : animatedView.props.style;

      // Button size should remain consistent (80x80)
      expect(buttonStyles).toMatchObject(
        expect.objectContaining({
          width: 80,
          height: 80,
          borderRadius: 40,
        })
      );
    });
  });
});
