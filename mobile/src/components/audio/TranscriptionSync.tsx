/**
 * TranscriptionSync Component (Story 3.2b - Task 5)
 *
 * Synchronized transcription display with:
 * - Word-level timing calculation
 * - Current word highlighting during playback
 * - Auto-scroll to keep current word visible
 * - Tap-on-word-to-seek functionality
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../design-system/tokens';
import { useCaptureTheme } from '../../hooks/useCaptureTheme';

interface TranscriptionSyncProps {
  transcription: string;
  currentPosition: number; // in milliseconds
  duration: number; // in milliseconds
  onSeek?: (position: number) => void;
}

interface WordTiming {
  word: string;
  startTime: number; // in ms
  endTime: number; // in ms
  index: number;
}

export const TranscriptionSync: React.FC<TranscriptionSyncProps> = ({
  transcription,
  currentPosition,
  duration,
  onSeek,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const wordRefs = useRef<Map<number, View>>(new Map());
  const { themeColors, isDark } = useCaptureTheme();

  /**
   * Parse transcription into words and calculate timing
   */
  const words: WordTiming[] = useMemo(() => {
    if (!transcription || transcription.trim().length === 0) {
      return [];
    }

    // Split by whitespace and filter empty strings
    const rawWords = transcription
      .split(/\s+/)
      .filter((w) => w.trim().length > 0);

    if (rawWords.length === 0 || duration === 0) {
      return [];
    }

    // Calculate time per word
    const msPerWord = duration / rawWords.length;

    return rawWords.map((word, index) => {
      // Remove trailing punctuation for display but keep hyphens
      const cleanWord = word.replace(/[.,!?;:]+$/, '');

      return {
        word: cleanWord,
        startTime: index * msPerWord,
        endTime: (index + 1) * msPerWord,
        index,
      };
    });
  }, [transcription, duration]);

  /**
   * Calculate current word index based on position
   */
  const currentWordIndex = useMemo(() => {
    if (words.length === 0 || currentPosition >= duration) {
      return -1; // No word highlighted
    }

    return words.findIndex(
      (w) => currentPosition >= w.startTime && currentPosition < w.endTime
    );
  }, [words, currentPosition, duration]);

  /**
   * Auto-scroll to keep current word visible
   */
  useEffect(() => {
    if (currentWordIndex >= 0 && wordRefs.current.has(currentWordIndex)) {
      const wordView = wordRefs.current.get(currentWordIndex);
      if (wordView && scrollViewRef.current) {
        wordView.measureLayout(
          scrollViewRef.current as any,
          (x, y) => {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, y - 100), // Scroll with 100px padding
              animated: true,
            });
          },
          () => {
            // Measurement failed, ignore
          }
        );
      }
    }
  }, [currentWordIndex]);

  /**
   * Handle word tap
   */
  const handleWordPress = (wordTiming: WordTiming) => {
    if (onSeek) {
      onSeek(wordTiming.startTime);
    }
  };

  /**
   * Render words with highlighting
   */
  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      testID="transcription-scroll"
    >
      <View style={styles.container} testID="transcription-container">
        {words.map((wordTiming) => {
          const isHighlighted = wordTiming.index === currentWordIndex;

          return (
            <TouchableOpacity
              key={wordTiming.index}
              onPress={() => handleWordPress(wordTiming)}
              activeOpacity={0.7}
              testID={
                isHighlighted
                  ? `word-${wordTiming.index}-highlighted`
                  : `word-${wordTiming.index}`
              }
              ref={(ref) => {
                if (ref) {
                  wordRefs.current.set(wordTiming.index, ref as any);
                }
              }}
            >
              <Text
                style={[
                  { color: themeColors.textPrimary },
                  styles.word,
                  isHighlighted && {
                    ...styles.highlightedWord,
                    color: isDark ? colors.primary[300] : colors.primary[600],
                    backgroundColor: isDark ? `${colors.primary[500]}30` : colors.primary[50],
                  },
                ]}
              >
                {wordTiming.word}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4], // 16
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
  },
  word: {
    fontSize: typography.fontSize.lg,
    lineHeight: 24,
  },
  highlightedWord: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
  },
});
