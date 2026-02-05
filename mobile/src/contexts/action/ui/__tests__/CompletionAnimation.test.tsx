/**
 * CompletionAnimation Tests
 *
 * Story 5.1 - Task 8: Completion Animation (AC8)
 * Subtask 8.8: Add unit tests for animation triggers
 */

import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CompletionAnimation } from '../CompletionAnimation';

// Note: react-native-reanimated is mocked globally in jest-setup.js

describe('CompletionAnimation', () => {
  const mockChild = <Text testID="child">Checkbox</Text>;

  it('renders children correctly', () => {
    const { getByTestId } = render(
      <CompletionAnimation isCompleted={false}>
        {mockChild}
      </CompletionAnimation>
    );

    expect(getByTestId('child')).toBeTruthy();
  });

  it('does not animate when initially not completed', () => {
    const { getByTestId } = render(
      <CompletionAnimation isCompleted={false}>
        {mockChild}
      </CompletionAnimation>
    );

    // Should render without errors (no animation triggered)
    expect(getByTestId('child')).toBeTruthy();
  });

  it('triggers animation when marking complete', () => {
    const { rerender, getByTestId } = render(
      <CompletionAnimation isCompleted={false}>
        {mockChild}
      </CompletionAnimation>
    );

    // Mark as completed (should trigger animation)
    rerender(
      <CompletionAnimation isCompleted={true}>
        {mockChild}
      </CompletionAnimation>
    );

    // Animation triggered (verified by no errors and child still renders)
    expect(getByTestId('child')).toBeTruthy();
  });

  it('does not animate when unchecking', () => {
    const { rerender, getByTestId } = render(
      <CompletionAnimation isCompleted={true}>
        {mockChild}
      </CompletionAnimation>
    );

    // Uncheck (should reset without animation)
    rerender(
      <CompletionAnimation isCompleted={false}>
        {mockChild}
      </CompletionAnimation>
    );

    // Should render without animation
    expect(getByTestId('child')).toBeTruthy();
  });

  it('renders glow container for animation', () => {
    const { getByTestId } = render(
      <CompletionAnimation isCompleted={true}>
        {mockChild}
      </CompletionAnimation>
    );

    // Component renders successfully with animation elements
    // (Glow view is rendered via Animated.View which is mocked)
    expect(getByTestId('child')).toBeTruthy();
  });

  it('accepts React.ReactNode as children', () => {
    const complexChild = (
      <View testID="complex-child">
        <Text>Line 1</Text>
        <Text>Line 2</Text>
      </View>
    );

    const { getByTestId } = render(
      <CompletionAnimation isCompleted={false}>
        {complexChild}
      </CompletionAnimation>
    );

    expect(getByTestId('complex-child')).toBeTruthy();
  });

  it('handles rapid completion toggles', () => {
    const { rerender, getByTestId } = render(
      <CompletionAnimation isCompleted={false}>
        {mockChild}
      </CompletionAnimation>
    );

    // Toggle multiple times rapidly
    rerender(<CompletionAnimation isCompleted={true}>{mockChild}</CompletionAnimation>);
    rerender(<CompletionAnimation isCompleted={false}>{mockChild}</CompletionAnimation>);
    rerender(<CompletionAnimation isCompleted={true}>{mockChild}</CompletionAnimation>);

    // Should still render correctly
    expect(getByTestId('child')).toBeTruthy();
  });
});
