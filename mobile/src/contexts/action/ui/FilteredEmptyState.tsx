/**
 * FilteredEmptyState Component
 * Story 5.3 - AC9, Task 8: Contextual empty states for filters
 *
 * Displays different empty state messages based on active filter:
 * - "Toutes": No actions at all
 * - "À faire": All actions completed (encouraging message)
 * - "Faites": No completed actions yet
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FilterType } from '../hooks/useFilterState';

export interface FilteredEmptyStateProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

interface EmptyStateContent {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionFilter?: FilterType;
}

const EMPTY_STATE_CONTENT: Record<FilterType, EmptyStateContent> = {
  all: {
    icon: '📝',
    title: 'Aucune action',
    message: "Vous n'avez aucune action pour le moment.\nLes actions extraites de vos pensées apparaîtront ici.",
  },
  active: {
    icon: '🎉',
    title: 'Tout est fait !',
    message: 'Toutes vos actions sont terminées.\nProfitez de ce moment !',
    actionLabel: 'Voir les actions complétées',
    actionFilter: 'completed',
  },
  completed: {
    icon: '✅',
    title: 'Aucune action complétée',
    message: "Vous n'avez pas encore complété d'actions.\nCommencez par en accomplir une !",
    actionLabel: 'Voir les actions à faire',
    actionFilter: 'active',
  },
};

export const FilteredEmptyState: React.FC<FilteredEmptyStateProps> = ({
  filter,
  onFilterChange,
}) => {
  const content = EMPTY_STATE_CONTENT[filter];

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Text style={styles.icon}>{content.icon}</Text>

      {/* Title */}
      <Text style={styles.title}>{content.title}</Text>

      {/* Message */}
      <Text style={styles.message}>{content.message}</Text>

      {/* Action button (if applicable) */}
      {content.actionLabel && content.actionFilter && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => onFilterChange(content.actionFilter!)}
          accessibilityRole="button"
          accessibilityLabel={content.actionLabel}
        >
          <Text style={styles.buttonText}>{content.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    // Shadow for iOS
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
