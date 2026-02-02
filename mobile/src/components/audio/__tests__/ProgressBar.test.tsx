/**
 * ProgressBar Component Tests (Story 3.2b - Custom Progress Bar)
 *
 * Test Coverage:
 * - Rendering with different progress values
 * - Tap to seek functionality
 * - Drag to seek functionality
 * - Edge cases (0%, 100%, invalid values)
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar Component', () => {
  const defaultProps = {
    value: 30,
    duration: 100,
    isPlaying: false,
    isDark: false,
  };

  describe('Rendering', () => {
    it('should render progress bar', () => {
      const { getByTestId } = render(<ProgressBar {...defaultProps} />);
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should render with 0% progress', () => {
      const { getByTestId } = render(
        <ProgressBar value={0} duration={100} isPlaying={false} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should render with 100% progress', () => {
      const { getByTestId } = render(
        <ProgressBar value={100} duration={100} isPlaying={false} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should handle zero duration gracefully', () => {
      const { getByTestId } = render(
        <ProgressBar value={0} duration={0} isPlaying={false} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });
  });

  describe('Tap to Seek', () => {
    it('should call onSlidingStart when tapped', () => {
      const onSlidingStart = jest.fn();
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} onSlidingStart={onSlidingStart} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 50 },
      });

      expect(onSlidingStart).toHaveBeenCalled();
    });

    it('should call onValueChange when tapped', () => {
      const onValueChange = jest.fn();
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} onValueChange={onValueChange} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 50 },
      });

      expect(onValueChange).toHaveBeenCalled();
    });

    it('should call onSlidingComplete when tap released', () => {
      const onSlidingComplete = jest.fn();
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} onSlidingComplete={onSlidingComplete} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 50 },
      });
      fireEvent(progressBar, 'onResponderRelease', {
        nativeEvent: { locationX: 50 },
      });

      expect(onSlidingComplete).toHaveBeenCalled();
    });
  });

  describe('Drag to Seek', () => {
    it('should call onValueChange during drag', () => {
      const onValueChange = jest.fn();
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} onValueChange={onValueChange} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 25 },
      });
      fireEvent(progressBar, 'onResponderMove', {
        nativeEvent: { locationX: 50 },
      });
      fireEvent(progressBar, 'onResponderMove', {
        nativeEvent: { locationX: 75 },
      });

      // Should be called for grant + 2 moves = 3 times
      expect(onValueChange).toHaveBeenCalledTimes(3);
    });

    it('should handle drag termination gracefully', () => {
      const onSlidingComplete = jest.fn();
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} onSlidingComplete={onSlidingComplete} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 50 },
      });
      fireEvent(progressBar, 'onResponderTerminate');

      // onSlidingComplete should NOT be called on termination
      expect(onSlidingComplete).not.toHaveBeenCalled();
    });
  });

  describe('Theme Support', () => {
    it('should render with light theme', () => {
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should render with dark theme', () => {
      const { getByTestId } = render(
        <ProgressBar {...defaultProps} isDark={true} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle value greater than duration', () => {
      const { getByTestId } = render(
        <ProgressBar value={150} duration={100} isPlaying={false} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should handle negative value', () => {
      const { getByTestId } = render(
        <ProgressBar value={-10} duration={100} isPlaying={false} isDark={false} />
      );
      expect(getByTestId('progress-bar')).toBeTruthy();
    });

    it('should work without callbacks', () => {
      const { getByTestId } = render(
        <ProgressBar value={30} duration={100} isPlaying={false} isDark={false} />
      );

      const progressBar = getByTestId('progress-bar');
      fireEvent(progressBar, 'onStartShouldSetResponder');
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: 50 },
      });
      fireEvent(progressBar, 'onResponderRelease', {
        nativeEvent: { locationX: 50 },
      });

      // Should not crash without callbacks
      expect(getByTestId('progress-bar')).toBeTruthy();
    });
  });
});
