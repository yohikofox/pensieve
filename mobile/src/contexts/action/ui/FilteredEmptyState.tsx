/**
 * FilteredEmptyState Component
 * Story 5.3 - AC9, Task 8: Contextual empty states for filters
 *
 * Displays different empty state messages based on active filter:
 * - "Toutes": No actions at all
 * - "À faire": All actions completed (encouraging message)
 * - "Faites": No completed actions yet
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FilterType } from '../hooks/useFilterState';
import { useTheme } from '../../../hooks/useTheme';
import { colors } from '../../../design-system/tokens';

export interface FilteredEmptyStateProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

interface EmptyStateContent {
  title: string;
  message: string;
  actionLabel?: string;
  actionFilter?: FilterType;
}

const EMPTY_STATE_CONTENT: Record<FilterType, EmptyStateContent> = {
  all: {
    title: 'Aucune action',
    message: "Vous n'avez aucune action pour le moment.\nLes actions extraites de vos pensées apparaîtront ici.",
  },
  active: {
    title: 'Tout est fait !',
    message: 'Toutes vos actions sont terminées.\nProfitez de ce moment !',
    actionLabel: 'Voir les actions complétées',
    actionFilter: 'completed',
  },
  completed: {
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
  const { isDark } = useTheme();
  const styles = useMemo(() => createStyles(isDark), [isDark]);
  const content = EMPTY_STATE_CONTENT[filter];

  return (
    <View style={styles.container}>
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

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: isDark ? colors.neutral[100] : colors.neutral[900],
      textAlign: 'center',
      marginBottom: 12,
      marginTop: 32,
    },
    message: {
      fontSize: 16,
      color: isDark ? colors.neutral[400] : colors.neutral[500],
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 24,
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: isDark ? colors.primary[600] : colors.primary[500],
      // Shadow for iOS
      shadowColor: isDark ? colors.primary[400] : colors.primary[500],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.2,
      shadowRadius: 4,
      // Elevation for Android
      elevation: 2,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.neutral[0],
    },
  });
