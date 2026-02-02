/**
 * AudioPlayer Component Tests (Story 3.2b - Task 1)
 *
 * Test Coverage:
 * - Audio loading (initial state)
 * - Play/Pause controls
 * - Seek functionality
 * - Time display (current / duration)
 * - Loading states
 * - Error handling
 *
 * TDD Cycle: Adapted for Expo SDK 54 expo-audio API
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AudioPlayer } from '../AudioPlayer';
import { ThemeProvider } from '../../../contexts/theme/ThemeProvider';

// Mock settingsStore (required by ThemeProvider)
jest.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: jest.fn((selector) => {
    const store = {
      themePreference: 'light' as const,
      setThemePreference: jest.fn(),
    };
    return selector ? selector(store) : store;
  }),
}));

// Test wrapper with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
  const result = render(<ThemeProvider>{component}</ThemeProvider>);
  return {
    ...result,
    rerender: (newComponent: React.ReactElement) =>
      result.rerender(<ThemeProvider>{newComponent}</ThemeProvider>),
  };
};

// Mock ProgressBar with proper event handlers
jest.mock('../ProgressBar', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    ProgressBar: (props: any) => {
      // Only animate if isPlaying is true (mock behavior)
      const shouldAnimate = props.isPlaying;

      return (
        <View
          testID="progress-bar"
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e: any) => {
            if (props.onSlidingStart) props.onSlidingStart();
            if (props.onValueChange) props.onValueChange(e.nativeEvent?.locationX || 0);
          }}
          onResponderMove={(e: any) => {
            if (props.onValueChange) props.onValueChange(e.nativeEvent?.locationX || 0);
          }}
          onResponderRelease={(e: any) => {
            if (props.onSlidingComplete) props.onSlidingComplete(e.nativeEvent?.locationX || 0);
          }}
        />
      );
    },
  };
});

// Mock expo-audio (Expo SDK 54 API)
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  remove: jest.fn(),
};

const mockStatus = {
  playing: false,
  currentTime: 0,
  duration: 60, // 60 seconds
  isLoaded: true,
};

jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => mockPlayer),
  useAudioPlayerStatus: jest.fn(() => mockStatus),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';

describe('AudioPlayer Component', () => {
  const mockAudioUri = 'file:///path/to/audio.m4a';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock status to defaults
    Object.assign(mockStatus, {
      playing: false,
      currentTime: 0,
      duration: 60,
      isLoaded: true,
    });

    // Reset all mocks to default behavior
    (useAudioPlayer as jest.Mock).mockReturnValue(mockPlayer);
    (useAudioPlayerStatus as jest.Mock).mockReturnValue(mockStatus);
    (setAudioModeAsync as jest.Mock).mockResolvedValue(undefined);

    // Reset mock player functions
    mockPlayer.play.mockClear();
    mockPlayer.pause.mockClear();
    mockPlayer.seekTo.mockClear();
  });

  describe('Initial State & Loading', () => {
    it('should render loading state initially when audio is not loaded', () => {
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        isLoaded: false,
      });

      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      expect(getByTestId('audio-player-loading')).toBeTruthy();
    });

    it('should configure audio mode on mount', async () => {
      renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(setAudioModeAsync).toHaveBeenCalledWith({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      });
    });

    it('should show play button when audio is loaded', async () => {
      const { getByTestId, queryByTestId } = renderWithTheme(
        <AudioPlayer audioUri={mockAudioUri} />
      );

      await waitFor(() => {
        expect(queryByTestId('audio-player-loading')).toBeNull();
        expect(getByTestId('audio-player-play-button')).toBeTruthy();
      });
    });

    it('should display initial time as 0:00 / duration', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        const timeDisplay = getByTestId('audio-player-time-display');
        const text = timeDisplay.props.children.join('');
        expect(text).toContain('0:00');
        expect(text).toContain('1:00'); // 60 seconds = 1:00
      });
    });

    it('should handle audio configuration error gracefully', async () => {
      (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to configure audio')
      );

      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('audio-player-error')).toBeTruthy();
      });
    });
  });

  describe('Play/Pause Controls', () => {
    it('should call player.play() when play button is pressed', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('audio-player-play-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('audio-player-play-button'));

      expect(mockPlayer.play).toHaveBeenCalled();
    });

    it('should show pause button when audio is playing', async () => {
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: true,
      });

      const { getByTestId, queryByTestId } = renderWithTheme(
        <AudioPlayer audioUri={mockAudioUri} />
      );

      await waitFor(() => {
        expect(queryByTestId('audio-player-play-button')).toBeNull();
        expect(getByTestId('audio-player-pause-button')).toBeTruthy();
      });
    });

    it('should call player.pause() when pause button is pressed', async () => {
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: true,
      });

      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('audio-player-pause-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('audio-player-pause-button'));

      expect(mockPlayer.pause).toHaveBeenCalled();
    });
  });

  describe('Seek Functionality', () => {
    it('should seek to new position when slider is moved', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('progress-bar')).toBeTruthy();
      });

      const progressBar = getByTestId('progress-bar');
      const newPosition = 30; // 30 seconds

      // Simulate complete gesture: grant → release
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: newPosition },
      });
      fireEvent(progressBar, 'onResponderRelease', {
        nativeEvent: { locationX: newPosition },
      });

      await waitFor(() => {
        expect(mockPlayer.seekTo).toHaveBeenCalledWith(newPosition);
      });
    });

    it('should update time display when seeking', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('progress-bar')).toBeTruthy();
      });

      const progressBar = getByTestId('progress-bar');
      const newPosition = 30; // 30 seconds

      // Simulate the full seek flow: grant (starts) → move (changes value)
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: newPosition },
      });
      fireEvent(progressBar, 'onResponderMove', {
        nativeEvent: { locationX: newPosition },
      });

      await waitFor(() => {
        const timeDisplay = getByTestId('audio-player-time-display');
        const text = timeDisplay.props.children.join('');
        expect(text).toContain('0:30'); // 30s
      });
    });

    it('should not allow seeking beyond audio duration', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('progress-bar')).toBeTruthy();
      });

      const progressBar = getByTestId('progress-bar');
      const invalidPosition = mockStatus.duration + 10; // Beyond duration

      // Simulate seeking beyond duration
      fireEvent(progressBar, 'onResponderGrant', {
        nativeEvent: { locationX: invalidPosition },
      });
      fireEvent(progressBar, 'onResponderRelease', {
        nativeEvent: { locationX: invalidPosition },
      });

      // Should clamp to max duration
      await waitFor(() => {
        expect(mockPlayer.seekTo).toHaveBeenCalledWith(mockStatus.duration);
      });
    });
  });

  describe('Time Display', () => {
    it('should format time correctly (MM:SS)', async () => {
      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        const timeDisplay = getByTestId('audio-player-time-display');
        const text = timeDisplay.props.children.join('');
        expect(text).toMatch(/\d+:\d{2}\s*\/\s*\d+:\d{2}/);
      });
    });

    it('should update current time during playback', async () => {
      // Initial render
      const { getByTestId, rerender } = renderWithTheme(
        <AudioPlayer audioUri={mockAudioUri} />
      );

      await waitFor(() => {
        expect(getByTestId('audio-player-time-display')).toBeTruthy();
      });

      // Simulate playback progress by updating mock status
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: true,
        currentTime: 15,
      });

      // Force re-render
      rerender(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        const timeDisplay = getByTestId('audio-player-time-display');
        const text = timeDisplay.props.children.join('');
        expect(text).toContain('0:15');
      });
    });
  });

  describe('Props & Callbacks', () => {
    it('should call onPlaybackEnd callback when audio finishes', async () => {
      const onPlaybackEnd = jest.fn();

      // Start with playing state
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: true,
        currentTime: 58,
      });

      const { rerender } = renderWithTheme(
        <AudioPlayer audioUri={mockAudioUri} onPlaybackEnd={onPlaybackEnd} />
      );

      // Simulate playback finishing
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: false,
        currentTime: 60,
        duration: 60,
      });

      rerender(
        <AudioPlayer audioUri={mockAudioUri} onPlaybackEnd={onPlaybackEnd} />
      );

      await waitFor(() => {
        expect(onPlaybackEnd).toHaveBeenCalled();
      });
    });

    it('should call onPositionChange callback when position updates', async () => {
      const onPositionChange = jest.fn();

      // Initial render at 0s
      const { rerender } = renderWithTheme(
        <AudioPlayer
          audioUri={mockAudioUri}
          onPositionChange={onPositionChange}
        />
      );

      await waitFor(() => {
        expect(onPositionChange).toHaveBeenCalledWith(0);
      });

      // Update to 20s
      (useAudioPlayerStatus as jest.Mock).mockReturnValue({
        ...mockStatus,
        playing: true,
        currentTime: 20,
      });

      rerender(
        <AudioPlayer
          audioUri={mockAudioUri}
          onPositionChange={onPositionChange}
        />
      );

      await waitFor(() => {
        expect(onPositionChange).toHaveBeenCalledWith(20000); // 20s in ms
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error when audio configuration fails', async () => {
      (setAudioModeAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Config failed')
      );

      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('audio-player-error')).toBeTruthy();
      });
    });

    it('should handle play errors gracefully', async () => {
      mockPlayer.play.mockImplementation(() => {
        throw new Error('Playback error');
      });

      const { getByTestId } = renderWithTheme(<AudioPlayer audioUri={mockAudioUri} />);

      await waitFor(() => {
        expect(getByTestId('audio-player-play-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('audio-player-play-button'));

      await waitFor(() => {
        expect(getByTestId('audio-player-error')).toBeTruthy();
      });
    });
  });
});
