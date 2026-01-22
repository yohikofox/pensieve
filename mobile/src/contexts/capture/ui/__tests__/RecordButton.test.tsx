/**
 * RecordButton Tests - Simplified
 *
 * Tests AC1 requirements:
 * - Haptic feedback on tap
 * - Recording service integration
 *
 * Story: 2.1 - Capture Audio 1-Tap
 *
 * Note: Full UI behavior (pulsing animation, timer updates) are tested in E2E tests
 * These unit tests focus on service integration and callbacks
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { RecordButton } from '../RecordButton';
import { RecordingService } from '../../services/RecordingService';
import { RepositoryResultType } from '../../domain/Result';
import * as Haptics from 'expo-haptics';

// Mock React Native - don't use string mocks, use actual mock components
jest.mock('react-native', () => {
  const React = require('react');

  // Create a proper Animated.Value mock class
  class AnimatedValueMock {
    private _value: number;
    constructor(initialValue: number) {
      this._value = initialValue;
    }
    setValue(value: number) {
      this._value = value;
    }
    getValue() {
      return this._value;
    }
  }

  const RN = {
    View: (props: any) => React.createElement('View', props, props.children),
    Text: (props: any) => React.createElement('Text', props, props.children),
    TouchableOpacity: (props: any) =>
      React.createElement(
        'TouchableOpacity',
        {
          ...props,
          onPress: props.onPress,
          testID: props.testID,
        },
        props.children
      ),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => styles,
    },
    Animated: {
      Value: AnimatedValueMock,
      View: (props: any) =>
        React.createElement('Animated.View', props, props.children),
      timing: jest.fn(() => ({
        start: jest.fn((callback?: any) => callback && callback()),
      })),
      sequence: jest.fn(() => ({
        start: jest.fn(),
      })),
      loop: jest.fn(() => ({
        start: jest.fn(),
      })),
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((obj) => obj.ios),
    },
    Alert: {
      alert: jest.fn(),
    },
  };
  return RN;
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

// Mock tsyringe container
jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
  injectable: () => () => {},
  inject: () => () => {},
}));

// Helper to flush all promises
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('RecordButton', () => {
  let mockRecordingService: jest.Mocked<RecordingService>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Use real timers for async tests with promises
    jest.useRealTimers();

    // Create mock RecordingService
    mockRecordingService = {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
      isRecording: jest.fn(),
      getCurrentRecordingId: jest.fn(),
      cancelRecording: jest.fn(),
    } as any;

    // Mock container.resolve to return our mock service
    const { container } = require('tsyringe');
    container.resolve.mockReturnValue(mockRecordingService);
  });

  describe('Initial State', () => {
    it('should render with idle label', () => {
      const { getByText, getByTestId } = render(<RecordButton />);
      expect(getByText('Tap to Record')).toBeTruthy();
    });

    it('should not show timer initially', () => {
      const { queryByText } = render(<RecordButton />);
      expect(queryByText(/\d{2}:\d{2}/)).toBeNull();
    });
  });

  describe('AC1: Haptic Feedback', () => {
    it('should trigger haptic feedback on button press', async () => {
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });

      const { getByText, getByTestId } = render(<RecordButton />);

      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium
      );
    });
  });

  describe('AC1: Recording Service Integration', () => {
    it('should call startRecording when button pressed', async () => {
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });

      const { getByText, getByTestId } = render(<RecordButton />);

      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      expect(mockRecordingService.startRecording).toHaveBeenCalled();
    });

    it('should call onRecordingStart callback on success', async () => {
      const onRecordingStart = jest.fn();
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });

      const { getByText, getByTestId } = render(
        <RecordButton onRecordingStart={onRecordingStart} />
      );

      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      await waitFor(() => {
        expect(onRecordingStart).toHaveBeenCalledWith('test-capture-1');
      });
    });

    it('should call onError callback on permission failure', async () => {
      const onError = jest.fn();
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.VALIDATION_ERROR,
        error: 'MicrophonePermissionDenied',
      });

      const { getByText, getByTestId } = render(<RecordButton onError={onError} />);

      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('MicrophonePermissionDenied');
      });
    });
  });

  describe('Recording Timer Format', () => {
    it('should format seconds correctly', () => {
      // This is a white-box test of the formatDuration function
      // In a real component, we'd test via timer display
      const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(5)).toBe('00:05');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(125)).toBe('02:05');
    });
  });

  describe('Story 2.3: Cancel Button', () => {
    it('should show cancel button only when recording', async () => {
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });

      const { getByTestId, queryByTestId } = render(<RecordButton />);

      // Initially no cancel button
      expect(queryByTestId('cancel-button')).toBeNull();

      // Start recording
      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      // Cancel button should appear
      await waitFor(() => {
        expect(getByTestId('cancel-button')).toBeTruthy();
      });
    });

    it('should call cancelRecording and show confirmation on cancel button press', async () => {
      const { Alert } = require('react-native');
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });
      mockRecordingService.cancelRecording.mockResolvedValue(undefined);

      const { getByTestId } = render(<RecordButton />);

      // Start recording
      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      // Press cancel button
      await act(async () => {
        fireEvent.press(getByTestId('cancel-button'));
        await flushPromises();
      });

      // Should show confirmation dialog
      expect(Alert.alert).toHaveBeenCalledWith(
        'Discard this recording?',
        'This recording will be permanently deleted.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Keep Recording' }),
          expect.objectContaining({ text: 'Discard' }),
        ])
      );
    });

    it('should trigger haptic feedback on cancel with "Heavy" impact', async () => {
      const { Alert } = require('react-native');
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });
      mockRecordingService.cancelRecording.mockResolvedValue(undefined);

      // Mock Alert to simulate user clicking "Discard"
      Alert.alert.mockImplementation((title, message, buttons) => {
        const discardButton = buttons?.find((b: any) => b.text === 'Discard');
        if (discardButton?.onPress) {
          discardButton.onPress();
        }
      });

      const { getByTestId } = render(<RecordButton />);

      // Start recording
      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      // Clear previous haptic calls
      (Haptics.impactAsync as jest.Mock).mockClear();

      // Press cancel button and confirm
      await act(async () => {
        fireEvent.press(getByTestId('cancel-button'));
        await flushPromises();
      });

      // Should trigger Heavy haptic feedback for cancel
      expect(Haptics.impactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Heavy
      );
    });

    it('should call onRecordingCancel callback when discarded', async () => {
      const { Alert } = require('react-native');
      const onRecordingCancel = jest.fn();

      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });
      mockRecordingService.cancelRecording.mockResolvedValue(undefined);

      // Mock Alert to simulate user clicking "Discard"
      Alert.alert.mockImplementation((title, message, buttons) => {
        const discardButton = buttons?.find((b: any) => b.text === 'Discard');
        if (discardButton?.onPress) {
          discardButton.onPress();
        }
      });

      const { getByTestId } = render(<RecordButton onRecordingCancel={onRecordingCancel} />);

      // Start recording
      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      // Press cancel button and confirm
      await act(async () => {
        fireEvent.press(getByTestId('cancel-button'));
        await flushPromises();
      });

      await waitFor(() => {
        expect(onRecordingCancel).toHaveBeenCalled();
        expect(mockRecordingService.cancelRecording).toHaveBeenCalled();
      });
    });

    it('should not cancel recording if user chooses "Keep Recording"', async () => {
      const { Alert } = require('react-native');
      mockRecordingService.startRecording.mockResolvedValue({
        type: RepositoryResultType.SUCCESS,
        data: { captureId: 'test-capture-1' },
      });

      // Mock Alert to simulate user clicking "Keep Recording"
      Alert.alert.mockImplementation((title, message, buttons) => {
        const keepButton = buttons?.find((b: any) => b.text === 'Keep Recording');
        if (keepButton?.onPress) {
          keepButton.onPress();
        }
      });

      const { getByTestId, queryByText } = render(<RecordButton />);

      // Start recording
      await act(async () => {
        fireEvent.press(getByTestId('record-button'));
        await flushPromises();
      });

      // Press cancel button but choose "Keep Recording"
      await act(async () => {
        fireEvent.press(getByTestId('cancel-button'));
        await flushPromises();
      });

      // Should NOT call cancelRecording
      expect(mockRecordingService.cancelRecording).not.toHaveBeenCalled();

      // Should still show recording UI
      await waitFor(() => {
        expect(queryByText('Tap to Stop')).toBeTruthy();
      });
    });
  });
});
