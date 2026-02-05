/**
 * IdeaItem Component
 *
 * Story 5.1 - Task 10: Integration with Feed Screen
 * Displays a single idea with inline todos below
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { InlineTodoList } from '../../action/ui/InlineTodoList';
import type { Idea } from '../domain/Idea.model';

interface IdeaItemProps {
  idea: Idea;
}

/**
 * IdeaItem - Single idea display with inline todos (AC1, AC7)
 * Displays idea text with InlineTodoList component below
 */
export const IdeaItem: React.FC<IdeaItemProps> = ({ idea }) => {
  const { isDark } = useTheme();

  const textColor = isDark ? '#f9fafb' : '#111827';

  return (
    <View style={styles.container}>
      {/* Idea text (AC1) */}
      <Text style={[styles.ideaText, { color: textColor }]}>
        {idea.text}
      </Text>

      {/* Inline todos (AC1) - Displayed below idea */}
      <InlineTodoList ideaId={idea.id} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  ideaText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
});
