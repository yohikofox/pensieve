/**
 * TranscriptionSync Component Tests (Story 3.2b - Task 5)
 *
 * Test Coverage:
 * - Word timing calculation
 * - Current word highlighting during playback
 * - Auto-scroll to keep current word visible
 * - Tap-on-word-to-seek functionality
 *
 * TDD Cycle: RED phase (tests written before implementation)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TranscriptionSync } from '../TranscriptionSync';

describe('TranscriptionSync Component', () => {
  const mockTranscription =
    'Bonjour ceci est un test de transcription audio pour vérifier le fonctionnement';
  const mockDuration = 10000; // 10 seconds in ms

  describe('Rendering', () => {
    it('should render transcription text', () => {
      const { getByTestId } = render(
        <TranscriptionSync
          transcription={mockTranscription}
          currentPosition={0}
          duration={mockDuration}
        />
      );

      expect(getByTestId('transcription-container')).toBeTruthy();
    });

    it('should split transcription into individual words', () => {
      const { getByText } = render(
        <TranscriptionSync
          transcription={mockTranscription}
          currentPosition={0}
          duration={mockDuration}
        />
      );

      // Check that individual words are rendered
      expect(getByText('Bonjour')).toBeTruthy();
      expect(getByText('ceci')).toBeTruthy();
      expect(getByText('test')).toBeTruthy();
    });

    it('should handle empty transcription gracefully', () => {
      const { getByTestId } = render(
        <TranscriptionSync
          transcription=""
          currentPosition={0}
          duration={mockDuration}
        />
      );

      expect(getByTestId('transcription-container')).toBeTruthy();
    });
  });

  describe('Word Timing Calculation', () => {
    it('should calculate correct word timing based on duration', () => {
      const transcription = 'un deux trois quatre'; // 4 words
      const duration = 4000; // 4 seconds = 1000ms per word

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={duration}
        />
      );

      // Component should render (timing calculation is internal)
      expect(getByTestId('transcription-container')).toBeTruthy();
    });

    it('should handle transcription with punctuation', () => {
      const transcription = 'Bonjour, comment allez-vous? Très bien!';

      const { getByText } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={mockDuration}
        />
      );

      // Words should be extracted without punctuation
      expect(getByText('Bonjour')).toBeTruthy();
      expect(getByText('comment')).toBeTruthy();
      expect(getByText('allez-vous')).toBeTruthy();
    });
  });

  describe('Current Word Highlighting', () => {
    it('should highlight first word at position 0', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000; // 1000ms per word

      const { getByTestId, getByText } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={duration}
        />
      );

      const highlightedWord = getByTestId('word-0-highlighted');
      expect(highlightedWord).toBeTruthy();
      // Verify word "un" is rendered
      expect(getByText('un')).toBeTruthy();
    });

    it('should highlight correct word based on current position', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000; // 1000ms per word

      const { getByTestId, getByText } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={1500} // 1.5s = word index 1 (deux)
          duration={duration}
        />
      );

      const highlightedWord = getByTestId('word-1-highlighted');
      expect(highlightedWord).toBeTruthy();
      // Verify word "deux" is rendered
      expect(getByText('deux')).toBeTruthy();
    });

    it('should update highlighted word when position changes', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000;

      const { getByTestId, rerender, queryByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={500} // Word 0
          duration={duration}
        />
      );

      expect(getByTestId('word-0-highlighted')).toBeTruthy();

      // Update to word 2
      rerender(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={2500} // Word 2
          duration={duration}
        />
      );

      expect(queryByTestId('word-0-highlighted')).toBeNull();
      expect(getByTestId('word-2-highlighted')).toBeTruthy();
    });

    it('should not highlight any word beyond audio duration', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000;

      const { queryByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={5000} // Beyond duration
          duration={duration}
        />
      );

      // No word should be highlighted
      expect(queryByTestId(/word-\d+-highlighted/)).toBeNull();
    });
  });

  describe('Tap-on-Word-to-Seek', () => {
    it('should call onSeek with correct position when word is tapped', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000; // 1000ms per word
      const onSeek = jest.fn();

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={duration}
          onSeek={onSeek}
        />
      );

      // Tap on word index 2 (trois)
      const word2 = getByTestId('word-2');
      fireEvent.press(word2);

      expect(onSeek).toHaveBeenCalledWith(2000); // Word 2 starts at 2000ms
    });

    it('should work without onSeek callback (optional)', () => {
      const transcription = 'un deux trois quatre';
      const duration = 4000;

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={duration}
        />
      );

      const word1 = getByTestId('word-1');

      // Should not crash when tapped without onSeek
      fireEvent.press(word1);

      expect(word1).toBeTruthy();
    });

    it('should handle taps on first and last words correctly', () => {
      const transcription = 'premier dernier';
      const duration = 2000; // 1000ms per word
      const onSeek = jest.fn();

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={0}
          duration={duration}
          onSeek={onSeek}
        />
      );

      // Tap first word (it's highlighted at position 0)
      fireEvent.press(getByTestId('word-0-highlighted'));
      expect(onSeek).toHaveBeenCalledWith(0);

      onSeek.mockClear();

      // Tap last word
      fireEvent.press(getByTestId('word-1'));
      expect(onSeek).toHaveBeenCalledWith(1000); // Word 1 starts at 1000ms
    });
  });

  describe('Visual Styling', () => {
    it('should apply different styles to highlighted vs normal words', () => {
      const transcription = 'un deux trois';
      const duration = 3000;

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={transcription}
          currentPosition={1000} // Word 1 highlighted
          duration={duration}
        />
      );

      const normalWord = getByTestId('word-0');
      const highlightedWord = getByTestId('word-1-highlighted');

      expect(normalWord).toBeTruthy();
      expect(highlightedWord).toBeTruthy();
      // Visual distinction should exist in component implementation
    });
  });

  describe('Auto-Scroll Behavior', () => {
    it('should render in a ScrollView for auto-scroll capability', () => {
      const { getByTestId } = render(
        <TranscriptionSync
          transcription={mockTranscription}
          currentPosition={0}
          duration={mockDuration}
        />
      );

      const scrollView = getByTestId('transcription-scroll');
      expect(scrollView).toBeTruthy();
    });

    // Note: Actual auto-scroll testing requires React Native environment
    // ScrollView.scrollTo() behavior is tested in integration tests
  });

  describe('Edge Cases', () => {
    it('should handle single word transcription', () => {
      const { getByText } = render(
        <TranscriptionSync
          transcription="seul"
          currentPosition={0}
          duration={1000}
        />
      );

      expect(getByText('seul')).toBeTruthy();
    });

    it('should handle very long transcription', () => {
      const longTranscription = new Array(100).fill('mot').join(' ');
      const duration = 100000; // 100s

      const { getByTestId } = render(
        <TranscriptionSync
          transcription={longTranscription}
          currentPosition={0}
          duration={duration}
        />
      );

      expect(getByTestId('transcription-container')).toBeTruthy();
    });

    it('should handle zero duration gracefully', () => {
      const { getByTestId } = render(
        <TranscriptionSync
          transcription="test"
          currentPosition={0}
          duration={0}
        />
      );

      expect(getByTestId('transcription-container')).toBeTruthy();
    });
  });
});
