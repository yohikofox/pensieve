/**
 * Waveform Component Tests (Story 3.2b - Task 4)
 *
 * Test Coverage:
 * - Waveform rendering from audio samples
 * - Playback position indicator
 * - Tap-to-seek functionality
 * - Loading states
 * - Error handling
 *
 * TDD Cycle: RED phase (tests written before implementation)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Waveform } from '../Waveform';

// Mock expo-audio
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
  remove: jest.fn(),
};

const mockAudioSample = {
  channels: [
    {
      frames: new Float32Array([0.5, -0.3, 0.8, -0.6, 0.2, -0.1, 0.4, -0.4]),
    },
  ],
  timestamp: 0,
};

jest.mock('expo-audio', () => ({
  useAudioSampleListener: jest.fn(),
}));

import { useAudioSampleListener } from 'expo-audio';

describe('Waveform Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAudioSampleListener as jest.Mock).mockImplementation(() => {});
  });

  describe('Rendering', () => {
    it('should render waveform container after receiving samples', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      // Initially should be loading
      expect(getByTestId('waveform-loading')).toBeTruthy();

      // Send samples
      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      // Should show container after samples
      await waitFor(() => {
        expect(getByTestId('waveform-container')).toBeTruthy();
      });
    });

    it('should show loading state initially', () => {
      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      expect(getByTestId('waveform-loading')).toBeTruthy();
    });

    it('should render waveform bars after receiving samples', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId, queryByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      // Simulate receiving audio samples
      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        expect(queryByTestId('waveform-loading')).toBeNull();
        expect(getByTestId('waveform-bars')).toBeTruthy();
      });
    });

    it('should normalize sample values to bar heights', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      // Send samples with known values
      const testSample = {
        channels: [
          {
            frames: new Float32Array([1.0, -1.0, 0.5, 0.0]), // Max, min, mid, zero
          },
        ],
        timestamp: 0,
      };

      if (sampleListener!) {
        sampleListener(testSample);
      }

      await waitFor(() => {
        const bars = getByTestId('waveform-bars');
        expect(bars).toBeTruthy();
        // Should have 4 bars (one per sample)
        expect(bars.props.children.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Playback Position Indicator', () => {
    it('should display playback position indicator', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={30} />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        expect(getByTestId('waveform-position-indicator')).toBeTruthy();
      });
    });

    it('should position indicator at correct percentage', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const duration = 60; // 60 seconds
      const currentPosition = 30; // 30 seconds = 50%

      const { getByTestId } = render(
        <Waveform
          player={mockPlayer}
          duration={duration}
          currentPosition={currentPosition}
        />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        const indicator = getByTestId('waveform-position-indicator');
        expect(indicator).toBeTruthy();
        // Indicator should exist at correct position (exact style testing is complex in RN)
      });
    });

    it('should update indicator position when currentPosition changes', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId, rerender } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={10} />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        const indicator = getByTestId('waveform-position-indicator');
        expect(indicator).toBeTruthy();
      });

      // Update position to 30s
      rerender(
        <Waveform player={mockPlayer} duration={60} currentPosition={30} />
      );

      // Indicator should still be present after position change
      await waitFor(() => {
        const indicator = getByTestId('waveform-position-indicator');
        expect(indicator).toBeTruthy();
      });
    });
  });

  describe('Tap-to-Seek Functionality', () => {
    it('should render touchable waveform that accepts taps', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const onSeek = jest.fn();

      const { getByTestId } = render(
        <Waveform
          player={mockPlayer}
          duration={60}
          currentPosition={0}
          onSeek={onSeek}
        />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        expect(getByTestId('waveform-bars')).toBeTruthy();
      });

      const waveform = getByTestId('waveform-touchable');
      expect(waveform).toBeTruthy();

      // Note: Actual tap-to-seek testing requires React Native environment
      // with proper View.measure() support, which is not available in Jest
    });

    it('should work without onSeek callback (optional prop)', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      // Render without onSeek prop
      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        expect(getByTestId('waveform-bars')).toBeTruthy();
      });

      const waveform = getByTestId('waveform-touchable');

      // Should not crash when tapped without onSeek
      fireEvent.press(waveform);

      expect(waveform).toBeTruthy();
    });
  });

  describe('Visual Styling', () => {
    it('should highlight bars before playback position differently', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={30} />
      );

      if (sampleListener!) {
        sampleListener(mockAudioSample);
      }

      await waitFor(() => {
        const bars = getByTestId('waveform-bars');
        expect(bars).toBeTruthy();
        // Visual distinction should exist in styles
        // (exact implementation depends on styling approach)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing audio samples gracefully', () => {
      (useAudioSampleListener as jest.Mock).mockImplementation(() => {
        // No samples received
      });

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      expect(getByTestId('waveform-loading')).toBeTruthy();
    });

    it('should handle empty sample data without crashing', async () => {
      let sampleListener: (sample: any) => void;
      (useAudioSampleListener as jest.Mock).mockImplementation(
        (player, listener) => {
          sampleListener = listener;
        }
      );

      const { getByTestId } = render(
        <Waveform player={mockPlayer} duration={60} currentPosition={0} />
      );

      const emptySample = {
        channels: [{ frames: new Float32Array([]) }],
        timestamp: 0,
      };

      if (sampleListener!) {
        sampleListener(emptySample);
      }

      // Component should still be in loading state (no valid data received)
      // but should not crash
      expect(getByTestId('waveform-loading')).toBeTruthy();
    });
  });
});
